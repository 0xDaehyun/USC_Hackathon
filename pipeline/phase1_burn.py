"""Phase 1: burn-area segmentation for the January 2025 Palisades/Eaton fires.

Strategy (in fail-safe order):
1. Download pre/post-fire Sentinel-2 L2A scenes (Earth Search STAC, public
   AWS COGs) and assemble 6-band HLS-style stacks (B02,B03,B04,B8A,B11,B12).
2. Try zero-shot inference with the pre-trained
   ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars model via its bundled
   inference.py (requires terratorch).
3. If Prithvi is unavailable, fall back to a deterministic dNBR threshold
   (USGS moderate-severity cutoff), which is a standard pre-calculated
   product, not a trained model.
4. If imagery cannot be fetched at all, emit a dummy placeholder raster.

Outputs:
- outputs/burn_mask.tif        (uint8, 1 = burned)
- outputs/burn_mask.meta.json  (method + provenance)
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from common import (
    BBOX,
    CACHE_DIR,
    OUTPUT_DIR,
    POST_FIRE_WINDOW,
    PRE_FIRE_WINDOW,
    log,
    log_exception,
    retry,
    write_dummy_raster,
    write_metadata,
)

STAC_URL = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"
# Earth Search asset keys matching the six Prithvi/HLS bands.
BAND_ASSETS = ["blue", "green", "red", "nir08", "swir16", "swir22"]
MAX_CLOUD = 20
HF_REPO = "ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars"

BURN_MASK = OUTPUT_DIR / "burn_mask.tif"
DNBR_THRESHOLD = 0.27  # USGS moderate burn severity


def find_best_item(client, window: tuple[str, str]):
    search = client.search(
        collections=[COLLECTION],
        bbox=BBOX,
        datetime=f"{window[0]}/{window[1]}",
        query={"eo:cloud_cover": {"lt": MAX_CLOUD}},
        max_items=50,
    )
    items = list(search.items())
    if not items:
        raise RuntimeError(f"No Sentinel-2 scenes with <{MAX_CLOUD}% cloud in {window}")
    # Prefer scenes whose footprint covers most of the bbox, then lowest cloud.
    from shapely.geometry import box, shape

    aoi = box(*BBOX)

    def coverage(item) -> float:
        return shape(item.geometry).intersection(aoi).area / aoi.area

    items.sort(key=lambda i: (-round(coverage(i), 2), i.properties["eo:cloud_cover"]))
    best = items[0]
    log(
        f"Selected scene {best.id} (cloud {best.properties['eo:cloud_cover']:.1f}%, "
        f"bbox coverage {coverage(best) * 100:.0f}%) for window {window}"
    )
    return best


def build_stack(item, label: str) -> Path:
    """Clip the six bands to the AOI, resample to a common 20 m grid, save int16."""
    import numpy as np
    import rioxarray

    out_path = CACHE_DIR / f"s2_{label}_stack.tif"
    if out_path.exists():
        log(f"Using cached stack {out_path.name}")
        return out_path

    layers = []
    for band in BAND_ASSETS:
        href = item.assets[band].href
        da = rioxarray.open_rasterio(href, masked=True).squeeze("band", drop=True)
        da = da.rio.clip_box(*BBOX, crs="EPSG:4326")
        layers.append((band, da))

    # Use swir16 (20 m) as the reference grid so we downsample instead of upsample.
    ref = dict(layers)["swir16"]
    stacked = []
    for band, da in layers:
        if da.rio.transform() != ref.rio.transform() or da.shape != ref.shape:
            da = da.rio.reproject_match(ref)
        stacked.append(da)

    import xarray as xr

    cube = xr.concat(stacked, dim="band")
    values = cube.values

    # Harmonize processing-baseline >= 04.00 radiometric offset (-1000) so the
    # data matches the pre-2022 HLS-like reflectance scaling. Logged assumption.
    when = item.properties.get("datetime", "")
    if when >= "2022-01-25":
        values = np.clip(values - 1000.0, 0, None)
        log(f"Applied Sentinel-2 BOA offset correction (-1000) to {label} stack")

    cube = cube.copy(data=values.astype("float32"))
    cube = cube.fillna(0).astype("int16")
    cube.rio.write_nodata(0, inplace=True)
    cube.rio.to_raster(out_path, driver="GTiff", compress="deflate")
    log(f"Wrote {label} 6-band stack: {out_path.name} shape={cube.shape}")
    return out_path


def try_prithvi(post_stack: Path) -> Path | None:
    """Attempt zero-shot Prithvi BurnScars inference. Returns mask path or None."""
    try:
        import terratorch  # noqa: F401
    except ImportError:
        log(
            "terratorch is not importable; skipping Prithvi inference and "
            "falling back to deterministic dNBR.",
            level="WARN",
        )
        return None

    from huggingface_hub import snapshot_download

    def download():
        return snapshot_download(HF_REPO, local_dir=CACHE_DIR / "prithvi_burnscars")

    repo_dir = Path(retry(download, label="Prithvi model download"))
    pred_dir = CACHE_DIR / "prithvi_pred"
    pred_dir.mkdir(exist_ok=True)

    cmd = [
        sys.executable,
        str(repo_dir / "inference.py"),
        "--data_file",
        str(post_stack),
        "--config",
        str(repo_dir / "burn_scars_config.yaml"),
        "--checkpoint",
        str(repo_dir / "Prithvi_EO_V2_300M_BurnScars.pt"),
        "--output_dir",
        str(pred_dir),
    ]

    def run():
        result = subprocess.run(
            cmd,
            cwd=repo_dir,
            capture_output=True,
            text=True,
            timeout=3600,
        )
        if result.returncode != 0:
            raise RuntimeError(f"inference.py failed: {result.stderr[-2000:]}")
        # inference.py names outputs pred_<input>.tiff (plus an rgb_pred_ preview).
        preds = sorted(
            p for p in pred_dir.glob("*pred*.tif*") if not p.name.startswith("rgb_")
        )
        if not preds:
            raise RuntimeError("inference.py produced no pred_*.tif(f) output")
        return preds[0]

    try:
        pred = retry(run, label="Prithvi inference")
        log(f"Prithvi inference succeeded: {pred.name}")
        return pred
    except Exception as error:  # noqa: BLE001
        log_exception("Prithvi inference exhausted retries; using dNBR fallback", error)
        return None


def compute_dnbr_mask(pre_stack: Path, post_stack: Path):
    """Return (uint8 mask array, rasterio profile) from the dNBR threshold."""
    import numpy as np
    import rasterio
    import rioxarray

    pre = rioxarray.open_rasterio(pre_stack, masked=True)
    post = rioxarray.open_rasterio(post_stack, masked=True)
    pre = pre.rio.reproject_match(post)

    def nbr(cube):
        nir = cube.sel(band=4).values.astype("float32")
        swir22 = cube.sel(band=6).values.astype("float32")
        denom = nir + swir22
        return np.where(denom > 0, (nir - swir22) / denom, np.nan)

    dnbr = nbr(pre) - nbr(post)
    mask = (dnbr > DNBR_THRESHOLD).astype("uint8")
    log(
        f"dNBR mask: {int(mask.sum())} burned pixels of {mask.size} "
        f"({100 * mask.sum() / mask.size:.1f}%) at threshold {DNBR_THRESHOLD}"
    )
    with rasterio.open(post_stack) as src:
        profile = src.profile
    profile.update(count=1, dtype="uint8", nodata=255)
    return mask, profile


def write_mask(mask, profile) -> Path:
    import rasterio

    with rasterio.open(BURN_MASK, "w", **profile) as dst:
        dst.write(mask, 1)
    return BURN_MASK


def validate_prithvi_mask(pred_path: Path, dnbr_arr) -> "object | None":
    """Return the Prithvi mask array if it passes plausibility gates, else None.

    Gates (all logged):
    - burned fraction must be within 0.1%..50% of the AOI, and
    - at least 30% of Prithvi burn pixels must be confirmed by the
      deterministic dNBR mask. Zero-shot output on Sentinel-2-assembled
      stacks can show tiling artifacts when preprocessing does not match the
      model's HLS training data; the dNBR agreement gate catches that.
    """
    import numpy as np
    import rasterio

    with rasterio.open(pred_path) as src:
        mask = (src.read(1) > 0).astype("uint8")

    fraction = float(mask.mean())
    log(f"Prithvi burned fraction over AOI: {fraction * 100:.2f}%")
    if fraction < 0.001 or fraction > 0.5:
        log(
            "Prithvi mask outside plausible range (0.1%..50%); rejecting.",
            level="WARN",
        )
        return None

    if mask.shape == dnbr_arr.shape:
        confirmed = np.logical_and(mask > 0, dnbr_arr > 0).sum() / max(mask.sum(), 1)
        log(f"Prithvi vs dNBR agreement: {confirmed * 100:.0f}% of Prithvi pixels confirmed")
        if confirmed < 0.3:
            log(
                "Prithvi mask rejected: <30% dNBR confirmation indicates "
                "preprocessing mismatch artifacts. Using deterministic dNBR.",
                level="WARN",
            )
            return None
    return mask


def run() -> dict:
    log("PHASE 1 START: burn area segmentation (Palisades/Eaton, Jan 2025)")

    try:
        from pystac_client import Client

        client = Client.open(STAC_URL)
        pre_item = retry(
            lambda: find_best_item(client, PRE_FIRE_WINDOW), label="STAC pre-fire search"
        )
        post_item = retry(
            lambda: find_best_item(client, POST_FIRE_WINDOW), label="STAC post-fire search"
        )
        pre_stack = retry(
            lambda: build_stack(pre_item, "pre"), label="Pre-fire stack download"
        )
        post_stack = retry(
            lambda: build_stack(post_item, "post"), label="Post-fire stack download"
        )
    except Exception as error:  # noqa: BLE001
        log_exception("PHASE 1: Sentinel-2 acquisition failed after retries", error)
        write_dummy_raster(BURN_MASK, "burn mask placeholder (imagery unavailable)")
        write_metadata(
            "burn_mask",
            {
                "method": "dummy-placeholder",
                "reason": "Sentinel-2 imagery could not be fetched",
                "humanActionRequired": True,
            },
        )
        log("PHASE 1 COMPLETE (dummy placeholder)", level="WARN")
        return {"status": "dummy"}

    dnbr_arr, profile = compute_dnbr_mask(pre_stack, post_stack)
    pred = try_prithvi(post_stack)
    accepted = validate_prithvi_mask(pred, dnbr_arr) if pred is not None else None
    if accepted is not None:
        write_mask(accepted, profile)
        method = "prithvi-eo-2.0-300m-burnscars (zero-shot, dNBR-confirmed)"
    else:
        write_mask(dnbr_arr, profile)
        method = f"dNBR threshold {DNBR_THRESHOLD} (deterministic fallback)"

    write_metadata(
        "burn_mask",
        {
            "method": method,
            "preScene": pre_item.id,
            "postScene": post_item.id,
            "bbox": BBOX,
            "modelRepo": HF_REPO if accepted is not None else None,
            "note": "Not an official burn perimeter; for hackathon analysis only.",
        },
    )
    log(f"PHASE 1 COMPLETE: {BURN_MASK.name} via {method}")
    return {"status": "ok", "method": method}


if __name__ == "__main__":
    run()
