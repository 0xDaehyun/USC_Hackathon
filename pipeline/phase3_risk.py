"""Phase 3: vulnerability overlay and risk scoring.

Loads CDC/ATSDR SVI 2022 census tracts for LA County (FIPS 06037) from the
public CDC onemap FeatureServer, computes zonal means of the Phase 1 burn
mask and Phase 2 smoke grid per tract, then scores:

    Risk_Score = (ALPHA * norm(burn_mean) + BETA * norm(smoke_mean)) * RPL_THEMES

RPL_THEMES is the CDC overall SVI percentile (0..1, -999 = undefined).
Normalization is min-max across tracts inside the AOI; every input that was a
dummy placeholder is flagged in the output metadata.

Outputs:
- outputs/final_risk_scores.geojson
- outputs/final_risk_scores.meta.json
"""

from __future__ import annotations

import json

from common import (
    ALPHA,
    BBOX,
    BETA,
    CACHE_DIR,
    OUTPUT_DIR,
    log,
    log_exception,
    retry,
    write_metadata,
)

SVI_LAYER = (
    "https://onemap.cdc.gov/onemapservices/rest/services/SVI/"
    "CDC_ATSDR_Social_Vulnerability_Index_2022_USA/FeatureServer/2/query"
)
SVI_FIELDS = "FIPS,LOCATION,E_TOTPOP,RPL_THEMES"
LA_COUNTY_FIPS = "06037"

BURN_TIF = OUTPUT_DIR / "burn_mask.tif"
SMOKE_TIF = OUTPUT_DIR / "smoke_pm25.tif"
RISK_GEOJSON = OUTPUT_DIR / "final_risk_scores.geojson"
SVI_CACHE = CACHE_DIR / "svi_la_tracts.geojson"


def fetch_svi_tracts():
    """Download all LA County SVI tracts (paginated GeoJSON) into a GeoDataFrame."""
    import geopandas as gpd
    import requests

    if SVI_CACHE.exists():
        log(f"Using cached SVI tracts: {SVI_CACHE.name}")
        return gpd.read_file(SVI_CACHE)

    features = []
    offset = 0
    while True:
        params = {
            "where": f"STCNTY = '{LA_COUNTY_FIPS}'",
            "outFields": SVI_FIELDS,
            "outSR": "4326",
            "f": "geojson",
            "resultOffset": offset,
            "resultRecordCount": 2000,
        }
        response = requests.get(SVI_LAYER, params=params, timeout=120)
        response.raise_for_status()
        payload = response.json()
        if "error" in payload:
            raise RuntimeError(f"SVI query error: {payload['error']}")
        page = payload.get("features", [])
        features.extend(page)
        log(f"SVI page at offset {offset}: {len(page)} tracts")
        if len(page) < 2000:
            break
        offset += 2000

    if not features:
        raise RuntimeError("SVI query returned zero LA County tracts")

    collection = {"type": "FeatureCollection", "features": features}
    SVI_CACHE.write_text(json.dumps(collection), encoding="utf-8")
    gdf = gpd.read_file(SVI_CACHE)
    log(f"Fetched {len(gdf)} LA County SVI tracts")
    return gdf


def dummy_svi_tracts():
    """Regular polygon grid over the AOI as an SVI placeholder (RPL_THEMES=0.5)."""
    import geopandas as gpd
    import numpy as np
    from shapely.geometry import box

    lon_min, lat_min, lon_max, lat_max = BBOX
    step = 0.05
    cells = []
    for lon in np.arange(lon_min, lon_max, step):
        for lat in np.arange(lat_min, lat_max, step):
            cells.append(box(lon, lat, lon + step, lat + step))
    gdf = gpd.GeoDataFrame(
        {
            "FIPS": [f"DUMMY-{i:04d}" for i in range(len(cells))],
            "LOCATION": ["PLACEHOLDER CELL"] * len(cells),
            "E_TOTPOP": [0] * len(cells),
            "RPL_THEMES": [0.5] * len(cells),
        },
        geometry=cells,
        crs="EPSG:4326",
    )
    log(
        "DUMMY SVI GRID GENERATED (uniform RPL_THEMES=0.5). "
        "HUMAN DATA INJECTION REQUIRED.",
        level="WARN",
    )
    return gdf


def zonal_mean(gdf, raster_path, column):
    from rasterstats import zonal_stats

    stats = zonal_stats(
        gdf,
        str(raster_path),
        stats=["mean"],
        all_touched=True,
        nodata=None,
    )
    gdf[column] = [s["mean"] if s["mean"] is not None else 0.0 for s in stats]
    return gdf


def min_max(series):
    lo, hi = series.min(), series.max()
    if hi - lo < 1e-12:
        return series * 0.0
    return (series - lo) / (hi - lo)


def run() -> dict:
    log("PHASE 3 START: SVI overlay and risk scoring")

    if not BURN_TIF.exists() or not SMOKE_TIF.exists():
        raise FileNotFoundError(
            "Phase 1/2 outputs missing; run earlier phases first "
            f"({BURN_TIF.exists()=}, {SMOKE_TIF.exists()=})"
        )

    import numpy as np

    svi_is_dummy = False
    try:
        gdf = retry(fetch_svi_tracts, label="CDC SVI fetch")
    except Exception as error:  # noqa: BLE001
        log_exception("PHASE 3: SVI fetch failed after retries", error)
        gdf = dummy_svi_tracts()
        svi_is_dummy = True

    gdf = gdf.to_crs("EPSG:4326")
    # Keep tracts intersecting the analysis bbox.
    from shapely.geometry import box

    aoi = box(*BBOX)
    gdf = gdf[gdf.intersects(aoi)].copy()
    log(f"{len(gdf)} tracts intersect the analysis bounding box")

    gdf = zonal_mean(gdf, BURN_TIF, "burn_mean")
    gdf = zonal_mean(gdf, SMOKE_TIF, "smoke_mean")

    # -999 marks undefined SVI percentiles; exclude from scoring.
    gdf["svi_score"] = gdf["RPL_THEMES"].where(gdf["RPL_THEMES"] >= 0, np.nan)
    gdf["burn_norm"] = min_max(gdf["burn_mean"])
    gdf["smoke_norm"] = min_max(gdf["smoke_mean"])
    gdf["risk_score"] = (
        (ALPHA * gdf["burn_norm"] + BETA * gdf["smoke_norm"]) * gdf["svi_score"]
    ).round(4)

    undefined = int(gdf["svi_score"].isna().sum())
    gdf["risk_score"] = gdf["risk_score"].fillna(-1)  # -1 = SVI undefined

    keep = [
        "FIPS",
        "LOCATION",
        "E_TOTPOP",
        "svi_score",
        "burn_mean",
        "smoke_mean",
        "burn_norm",
        "smoke_norm",
        "risk_score",
        "geometry",
    ]
    gdf[keep].to_file(RISK_GEOJSON, driver="GeoJSON")

    scored = gdf[gdf["risk_score"] >= 0]
    top = scored.nlargest(5, "risk_score")[["FIPS", "LOCATION", "risk_score"]]
    log("Top-5 risk tracts:\n" + top.to_string(index=False))

    write_metadata(
        "final_risk_scores",
        {
            "formula": f"({ALPHA}*norm(burn) + {BETA}*norm(smoke)) * RPL_THEMES",
            "tracts": len(gdf),
            "tractsWithUndefinedSvi": undefined,
            "sviSource": "dummy-grid" if svi_is_dummy else "CDC/ATSDR SVI 2022 tract (onemap)",
            "burnInput": json.loads((OUTPUT_DIR / "burn_mask.meta.json").read_text())["method"],
            "smokeInput": json.loads((OUTPUT_DIR / "smoke_pm25.meta.json").read_text())["method"],
            "riskScoreMinusOneMeans": "SVI percentile undefined (-999) for the tract",
            "note": "Hackathon prototype scoring; weights are unvalidated hypotheses.",
        },
    )
    log(f"PHASE 3 COMPLETE: {RISK_GEOJSON.name} ({len(gdf)} tracts)")
    return {"status": "ok", "tracts": len(gdf), "sviDummy": svi_is_dummy}


if __name__ == "__main__":
    run()
