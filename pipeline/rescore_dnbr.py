"""Additive re-scoring using the deterministic dNBR burn mask.

The unattended run produced Prithvi-based outputs, but post-run verification
showed the zero-shot Prithvi mask carries grid tiling artifacts (only 12% of
its burn pixels are dNBR-confirmed, 19% AOI burned vs ~5% expected). This
script does NOT overwrite those outputs; it writes parallel *_dnbr files so a
human reviewer can compare both versions:

- outputs/burn_mask_dnbr.tif
- outputs/final_risk_scores_dnbr.geojson
- outputs/la_wildfire_risk_map_dnbr.html
- outputs/la_wildfire_risk_map_dnbr_preview.png
"""

from __future__ import annotations

import json

from common import ALPHA, BBOX, BETA, CACHE_DIR, OUTPUT_DIR, log, write_metadata

import phase1_burn as p1
from phase3_risk import fetch_svi_tracts, min_max, zonal_mean

BURN_DNBR = OUTPUT_DIR / "burn_mask_dnbr.tif"
RISK_DNBR = OUTPUT_DIR / "final_risk_scores_dnbr.geojson"
MAP_DNBR = OUTPUT_DIR / "la_wildfire_risk_map_dnbr.html"


def main() -> None:
    log(
        "DNBR RE-SCORE START (additive): Prithvi outputs kept; writing parallel "
        "*_dnbr artifacts after cross-check flagged Prithvi tiling artifacts.",
        level="WARN",
    )

    import numpy as np
    import rasterio

    mask, profile = p1.compute_dnbr_mask(
        CACHE_DIR / "s2_pre_stack.tif", CACHE_DIR / "s2_post_stack.tif"
    )
    with rasterio.open(BURN_DNBR, "w", **profile) as dst:
        dst.write(mask, 1)
    write_metadata(
        "burn_mask_dnbr",
        {
            "method": f"dNBR threshold {p1.DNBR_THRESHOLD} (deterministic)",
            "preScene": "S2B_11SLT_20241218_0_L2A",
            "postScene": "S2C_11SLT_20250221_0_L2A",
            "bbox": BBOX,
            "note": "Recommended burn input; Prithvi zero-shot mask failed dNBR cross-check.",
        },
    )

    from shapely.geometry import box

    gdf = fetch_svi_tracts().to_crs("EPSG:4326")
    gdf = gdf[gdf.intersects(box(*BBOX))].copy()
    gdf = zonal_mean(gdf, BURN_DNBR, "burn_mean")
    gdf = zonal_mean(gdf, OUTPUT_DIR / "smoke_pm25.tif", "smoke_mean")
    gdf["svi_score"] = gdf["RPL_THEMES"].where(gdf["RPL_THEMES"] >= 0, np.nan)
    gdf["burn_norm"] = min_max(gdf["burn_mean"])
    gdf["smoke_norm"] = min_max(gdf["smoke_mean"])
    gdf["risk_score"] = (
        (ALPHA * gdf["burn_norm"] + BETA * gdf["smoke_norm"]) * gdf["svi_score"]
    ).round(4)
    gdf["risk_score"] = gdf["risk_score"].fillna(-1)

    keep = [
        "FIPS", "LOCATION", "E_TOTPOP", "svi_score", "burn_mean", "smoke_mean",
        "burn_norm", "smoke_norm", "risk_score", "geometry",
    ]
    gdf[keep].to_file(RISK_DNBR, driver="GeoJSON")
    top = gdf[gdf["risk_score"] >= 0].nlargest(5, "risk_score")[
        ["FIPS", "LOCATION", "risk_score"]
    ]
    log("Top-5 risk tracts (dNBR version):\n" + top.to_string(index=False))
    write_metadata(
        "final_risk_scores_dnbr",
        {
            "formula": f"({ALPHA}*norm(burn) + {BETA}*norm(smoke)) * RPL_THEMES",
            "tracts": len(gdf),
            "burnInput": "burn_mask_dnbr.tif (deterministic dNBR)",
            "smokeInput": "smoke_pm25.tif (HRRR-Smoke)",
            "note": "Parallel artifact; compare with final_risk_scores.geojson (Prithvi burn input).",
        },
    )

    # Folium map (same rendering as phase 4, different input/output paths).
    import branca.colormap as cm
    import folium

    scored = gdf[gdf["risk_score"] >= 0]
    vmax = max(float(scored["risk_score"].quantile(0.98)), 1e-6)
    colormap = cm.LinearColormap(
        ["#2b6e4f", "#f2c14e", "#e2711d", "#b31312"],
        vmin=0.0, vmax=vmax,
        caption="Wildfire & Smoke Vulnerability Risk Score (prototype, dNBR burn input)",
    )
    center = [(BBOX[1] + BBOX[3]) / 2, (BBOX[0] + BBOX[2]) / 2]
    fmap = folium.Map(location=center, zoom_start=10, tiles="OpenStreetMap")

    def style(feature):
        score = feature["properties"]["risk_score"]
        if score is None or score < 0:
            return {"fillColor": "#9aa0a6", "fillOpacity": 0.35, "weight": 0.4, "color": "#666"}
        return {"fillColor": colormap(min(score, vmax)), "fillOpacity": 0.65, "weight": 0.4, "color": "#444"}

    folium.GeoJson(
        json.loads(RISK_DNBR.read_text()),
        name="Risk score (dNBR)",
        style_function=style,
        tooltip=folium.GeoJsonTooltip(
            fields=["FIPS", "LOCATION", "risk_score", "svi_score", "burn_norm", "smoke_norm"],
            aliases=["Tract", "Location", "Risk", "SVI", "Burn (norm)", "Smoke (norm)"],
            localize=True,
        ),
    ).add_to(fmap)
    colormap.add_to(fmap)
    title = (
        '<div style="position:fixed;top:10px;left:50px;z-index:9999;'
        'background:rgba(255,255,255,.92);padding:8px 14px;border-radius:8px;'
        'font-family:sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.2);">'
        "<b>LA Wildfire &amp; Smoke Vulnerability Risk (Jan 2025, dNBR burn input)</b><br>"
        "Historical reconstruction &middot; unvalidated hackathon scoring &middot; "
        "not an official evacuation or hazard product. Gray = SVI undefined.</div>"
    )
    fmap.get_root().html.add_child(folium.Element(title))
    fmap.save(str(MAP_DNBR))
    log(f"DNBR RE-SCORE COMPLETE: {RISK_DNBR.name}, {MAP_DNBR.name}")

    # Static preview PNG.
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(11, 7))
    gdf[gdf["risk_score"] < 0].plot(ax=ax, color="#c9cdd2", linewidth=0)
    scored.plot(
        column="risk_score", cmap="YlOrRd", linewidth=0.05, edgecolor="#555",
        legend=True, legend_kwds={"label": "Risk score (prototype)", "shrink": 0.7}, ax=ax,
    )
    ax.set_title(
        "LA Wildfire & Smoke Vulnerability Risk — Jan 2025 (dNBR burn input, unvalidated prototype)",
        fontsize=10,
    )
    ax.set_axis_off()
    fig.savefig(OUTPUT_DIR / "la_wildfire_risk_map_dnbr_preview.png", dpi=150, bbox_inches="tight")
    log("DNBR preview PNG rendered")


if __name__ == "__main__":
    main()
