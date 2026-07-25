"""Post-run verification: cross-check Prithvi mask against deterministic dNBR,
validate output files, and render a static PNG preview of the risk map."""

from __future__ import annotations

import json

import geopandas as gpd
import numpy as np
import rasterio
import rioxarray

from common import CACHE_DIR, OUTPUT_DIR, log
from phase1_burn import DNBR_THRESHOLD


def cross_check_burn() -> None:
    pre = rioxarray.open_rasterio(CACHE_DIR / "s2_pre_stack.tif", masked=True)
    post = rioxarray.open_rasterio(CACHE_DIR / "s2_post_stack.tif", masked=True)
    pre = pre.rio.reproject_match(post)

    def nbr(cube):
        nir = cube.sel(band=4).values.astype("float32")
        swir22 = cube.sel(band=6).values.astype("float32")
        denom = nir + swir22
        return np.where(denom > 0, (nir - swir22) / denom, np.nan)

    dnbr = nbr(pre) - nbr(post)
    dnbr_mask = dnbr > DNBR_THRESHOLD

    with rasterio.open(OUTPUT_DIR / "burn_mask.tif") as src:
        prithvi = src.read(1) > 0

    both = np.logical_and(prithvi, dnbr_mask).sum()
    p_frac = prithvi.mean() * 100
    d_frac = dnbr_mask.mean() * 100
    recall_of_dnbr = both / max(dnbr_mask.sum(), 1) * 100
    precision_vs_dnbr = both / max(prithvi.sum(), 1) * 100
    log(
        "VERIFY burn cross-check: "
        f"Prithvi burned {p_frac:.1f}% of AOI, dNBR {d_frac:.1f}%. "
        f"Prithvi covers {recall_of_dnbr:.0f}% of dNBR pixels; "
        f"{precision_vs_dnbr:.0f}% of Prithvi pixels are dNBR-confirmed."
    )


def validate_outputs() -> None:
    gdf = gpd.read_file(OUTPUT_DIR / "final_risk_scores.geojson")
    scored = gdf[gdf["risk_score"] >= 0]
    assert len(gdf) > 1000, "unexpectedly few tracts"
    assert scored["risk_score"].between(0, 1).all(), "risk score out of range"
    html = (OUTPUT_DIR / "la_wildfire_risk_map.html").stat().st_size
    log(
        f"VERIFY outputs: {len(gdf)} tracts ({len(gdf) - len(scored)} SVI-undefined), "
        f"risk range {scored['risk_score'].min():.4f}..{scored['risk_score'].max():.4f}, "
        f"map HTML {html / 1e6:.1f} MB"
    )


def render_png() -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    gdf = gpd.read_file(OUTPUT_DIR / "final_risk_scores.geojson")
    fig, ax = plt.subplots(figsize=(11, 7))
    gdf[gdf["risk_score"] < 0].plot(ax=ax, color="#c9cdd2", linewidth=0)
    gdf[gdf["risk_score"] >= 0].plot(
        column="risk_score",
        cmap="YlOrRd",
        linewidth=0.05,
        edgecolor="#555",
        legend=True,
        legend_kwds={"label": "Risk score (prototype)", "shrink": 0.7},
        ax=ax,
    )
    ax.set_title(
        "LA Wildfire & Smoke Vulnerability Risk — Jan 2025 (historical reconstruction, unvalidated prototype)",
        fontsize=10,
    )
    ax.set_axis_off()
    out = OUTPUT_DIR / "la_wildfire_risk_map_preview.png"
    fig.savefig(out, dpi=150, bbox_inches="tight")
    log(f"VERIFY preview rendered: {out.name}")


if __name__ == "__main__":
    cross_check_burn()
    validate_outputs()
    render_png()
    summary = json.loads((OUTPUT_DIR / "pipeline_summary.json").read_text())
    log(f"VERIFY summary: {summary}")
