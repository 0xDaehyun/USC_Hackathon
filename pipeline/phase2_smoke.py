"""Phase 2: NOAA HRRR-Smoke near-surface PM2.5 exposure grid.

Fetches archived HRRR "sfc" GRIB2 analyses (fxx=0) from the public NOAA AWS
bucket via Herbie for peak-smoke timestamps of the January 2025 LA fires,
extracts near-surface smoke mass density (MASSDEN, kg/m^3), averages the
successful timestamps, and resamples the native Lambert-conformal grid onto a
regular EPSG:4326 grid over the Phase 1 bounding box.

Outputs:
- outputs/smoke_pm25.tif        (float32, ug/m^3 average near-surface smoke)
- outputs/smoke_pm25.meta.json
"""

from __future__ import annotations

import numpy as np

from common import (
    BBOX,
    CACHE_DIR,
    OUTPUT_DIR,
    SMOKE_TIMES,
    log,
    log_exception,
    retry,
    write_dummy_raster,
    write_metadata,
)

SMOKE_TIF = OUTPUT_DIR / "smoke_pm25.tif"
SEARCH = ":MASSDEN:8 m above ground:"
OUT_RES_DEG = 0.03  # ~ HRRR native 3 km


def fetch_one(timestamp: str):
    """Return (values_ugm3, lats, lons) for one HRRR analysis time."""
    from herbie import Herbie

    h = Herbie(
        timestamp,
        model="hrrr",
        product="sfc",
        fxx=0,
        save_dir=CACHE_DIR / "hrrr",
    )
    ds = h.xarray(SEARCH)
    var = next(iter(ds.data_vars))
    values = ds[var].values * 1e9  # kg/m^3 -> ug/m^3
    lats = ds["latitude"].values
    lons = ds["longitude"].values
    # HRRR longitudes are 0..360; convert to -180..180.
    lons = np.where(lons > 180, lons - 360, lons)
    return values, lats, lons


def to_regular_grid(values, lats, lons):
    """Nearest-neighbor resample of the curvilinear HRRR grid onto EPSG:4326."""
    from scipy.spatial import cKDTree

    lon_min, lat_min, lon_max, lat_max = BBOX
    pad = 0.1
    keep = (
        (lons >= lon_min - pad)
        & (lons <= lon_max + pad)
        & (lats >= lat_min - pad)
        & (lats <= lat_max + pad)
    )
    if keep.sum() < 10:
        raise RuntimeError("HRRR subset contains too few points inside the AOI")

    src_pts = np.column_stack([lons[keep], lats[keep]])
    src_val = values[keep]

    grid_lons = np.arange(lon_min, lon_max, OUT_RES_DEG)
    grid_lats = np.arange(lat_max, lat_min, -OUT_RES_DEG)
    mesh_lon, mesh_lat = np.meshgrid(grid_lons, grid_lats)

    tree = cKDTree(src_pts)
    _, idx = tree.query(np.column_stack([mesh_lon.ravel(), mesh_lat.ravel()]))
    return src_val[idx].reshape(mesh_lon.shape).astype("float32"), grid_lons, grid_lats


def save_geotiff(grid, grid_lons, grid_lats) -> None:
    import rasterio
    from rasterio.transform import from_origin

    transform = from_origin(grid_lons[0], grid_lats[0], OUT_RES_DEG, OUT_RES_DEG)
    with rasterio.open(
        SMOKE_TIF,
        "w",
        driver="GTiff",
        height=grid.shape[0],
        width=grid.shape[1],
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
        nodata=-9999.0,
    ) as dst:
        dst.write(grid, 1)
        dst.update_tags(UNITS="ug/m3", VARIABLE="MASSDEN 8m near-surface smoke")


def run() -> dict:
    log("PHASE 2 START: HRRR-Smoke PM2.5 exposure grid")

    fields = []
    used = []
    for ts in SMOKE_TIMES:
        try:
            values, lats, lons = retry(
                lambda ts=ts: fetch_one(ts), label=f"HRRR fetch {ts}"
            )
            grid, grid_lons, grid_lats = to_regular_grid(values, lats, lons)
            fields.append(grid)
            used.append(ts)
            log(
                f"HRRR {ts}: AOI smoke mean {np.nanmean(grid):.1f}, "
                f"max {np.nanmax(grid):.1f} ug/m^3"
            )
        except Exception as error:  # noqa: BLE001
            log_exception(f"PHASE 2: giving up on timestamp {ts}", error)

    if not fields:
        log("PHASE 2: no HRRR timestamps succeeded; writing dummy grid", level="ERROR")
        write_dummy_raster(SMOKE_TIF, "smoke PM2.5 placeholder (HRRR unavailable)")
        write_metadata(
            "smoke_pm25",
            {
                "method": "dummy-placeholder",
                "reason": "All HRRR-Smoke fetches failed",
                "humanActionRequired": True,
            },
        )
        log("PHASE 2 COMPLETE (dummy placeholder)", level="WARN")
        return {"status": "dummy"}

    mean_grid = np.mean(np.stack(fields), axis=0).astype("float32")
    save_geotiff(mean_grid, grid_lons, grid_lats)
    write_metadata(
        "smoke_pm25",
        {
            "method": "HRRR-Smoke MASSDEN 8 m analysis (fxx=0), mean of timestamps",
            "timestampsUsed": used,
            "timestampsFailed": [t for t in SMOKE_TIMES if t not in used],
            "units": "ug/m3",
            "bbox": BBOX,
            "note": "Model analysis, not ground-station observation.",
        },
    )
    log(f"PHASE 2 COMPLETE: {SMOKE_TIF.name} from {len(used)} timestamps")
    return {"status": "ok", "timestamps": used}


if __name__ == "__main__":
    run()
