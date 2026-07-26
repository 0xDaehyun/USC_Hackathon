"""Phase 4: interactive risk map visualization.

Renders outputs/final_risk_scores.geojson as a Folium choropleth over an
OpenStreetMap base layer of Los Angeles and saves a self-contained HTML file.

Output:
- outputs/la_wildfire_risk_map.html
"""

from __future__ import annotations

import json

from common import BBOX, OUTPUT_DIR, log, write_metadata

RISK_GEOJSON = OUTPUT_DIR / "final_risk_scores.geojson"
MAP_HTML = OUTPUT_DIR / "la_wildfire_risk_map.html"


def run() -> dict:
    log("PHASE 4 START: Folium risk map")

    if not RISK_GEOJSON.exists():
        raise FileNotFoundError("final_risk_scores.geojson missing; run Phase 3 first")

    import branca.colormap as cm
    import folium
    import geopandas as gpd

    gdf = gpd.read_file(RISK_GEOJSON)
    scored = gdf[gdf["risk_score"] >= 0]
    vmax = max(float(scored["risk_score"].quantile(0.98)), 1e-6)
    colormap = cm.LinearColormap(
        ["#2b6e4f", "#f2c14e", "#e2711d", "#b31312"],
        vmin=0.0,
        vmax=vmax,
        caption="Wildfire & Smoke Vulnerability Risk Score (prototype)",
    )

    center = [(BBOX[1] + BBOX[3]) / 2, (BBOX[0] + BBOX[2]) / 2]
    fmap = folium.Map(location=center, zoom_start=10, tiles="OpenStreetMap")

    def style(feature):
        score = feature["properties"]["risk_score"]
        if score is None or score < 0:
            return {"fillColor": "#9aa0a6", "fillOpacity": 0.35, "weight": 0.4, "color": "#666"}
        return {
            "fillColor": colormap(min(score, vmax)),
            "fillOpacity": 0.65,
            "weight": 0.4,
            "color": "#444",
        }

    folium.GeoJson(
        json.loads(RISK_GEOJSON.read_text()),
        name="Risk score",
        style_function=style,
        tooltip=folium.GeoJsonTooltip(
            fields=["FIPS", "LOCATION", "risk_score", "svi_score", "burn_norm", "smoke_norm"],
            aliases=["Tract", "Location", "Risk", "SVI", "Burn (norm)", "Smoke (norm)"],
            localize=True,
        ),
    ).add_to(fmap)

    colormap.add_to(fmap)
    folium.LayerControl().add_to(fmap)

    title = (
        '<div style="position:fixed;top:10px;left:50px;z-index:9999;'
        'background:rgba(255,255,255,.92);padding:8px 14px;border-radius:8px;'
        'font-family:sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.2);">'
        "<b>LA Wildfire &amp; Smoke Vulnerability Risk (Jan 2025, prototype)</b><br>"
        "Historical reconstruction &middot; unvalidated hackathon scoring &middot; "
        "not an official evacuation or hazard product. Gray = SVI undefined.</div>"
    )
    fmap.get_root().html.add_child(folium.Element(title))
    fmap.save(str(MAP_HTML))

    write_metadata(
        "la_wildfire_risk_map",
        {
            "input": RISK_GEOJSON.name,
            "tractsRendered": len(gdf),
            "colorScaleMax": vmax,
            "note": "Prototype visualization; not an official product.",
        },
    )
    log(f"PHASE 4 COMPLETE: {MAP_HTML.name} ({len(gdf)} tracts rendered)")
    return {"status": "ok"}


if __name__ == "__main__":
    run()
