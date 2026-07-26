"""Shared utilities for the LA wildfire risk-mapping pipeline.

All phases log to <repo root>/execution_log.txt, retry transient failures up
to MAX_ATTEMPTS times, and fall back to clearly-labeled dummy data instead of
hallucinating real observations.
"""

from __future__ import annotations

import datetime as _dt
import json
import time
import traceback
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent
REPO_ROOT = PIPELINE_DIR.parent
LOG_FILE = REPO_ROOT / "execution_log.txt"
CACHE_DIR = PIPELINE_DIR / "data_cache"
OUTPUT_DIR = PIPELINE_DIR / "outputs"

CACHE_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Combined bounding box covering both the Palisades and Eaton fires
# (lon_min, lat_min, lon_max, lat_max), EPSG:4326.
BBOX = (-118.75, 33.95, -117.95, 34.32)

# Scene-selection windows around the January 2025 fires.
PRE_FIRE_WINDOW = ("2024-12-01", "2025-01-06")
POST_FIRE_WINDOW = ("2025-01-25", "2025-02-28")

# HRRR-Smoke analysis timestamps (UTC) during peak smoke impact.
SMOKE_TIMES = [
    "2025-01-08 00:00",
    "2025-01-08 06:00",
    "2025-01-08 12:00",
    "2025-01-08 18:00",
    "2025-01-09 00:00",
    "2025-01-09 12:00",
]

# Risk formula weights: Risk = (ALPHA*norm(burn) + BETA*norm(smoke)) * SVI
ALPHA = 0.5
BETA = 0.5

# Dummy-grid geometry used whenever real data cannot be fetched.
DUMMY_RES_DEG = 0.01

MAX_ATTEMPTS = 3
RETRY_DELAY_S = 15


def log(message: str, level: str = "INFO") -> None:
    stamp = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{stamp}] [{level}] {message}"
    print(line, flush=True)
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def log_exception(context: str, error: BaseException) -> None:
    log(f"{context}: {error!r}", level="ERROR")
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(traceback.format_exc() + "\n")


def retry(fn, *, label: str, attempts: int = MAX_ATTEMPTS, delay_s: int = RETRY_DELAY_S):
    """Run fn() with retries. Raises the last error after `attempts` failures."""
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as error:  # noqa: BLE001 - fail-safe protocol logs everything
            log_exception(f"{label} attempt {attempt}/{attempts} failed", error)
            if attempt == attempts:
                raise
            time.sleep(delay_s)


def write_dummy_raster(path: Path, description: str) -> Path:
    """Write an all-zero placeholder raster with the correct shape/CRS.

    Used only when real data cannot be retrieved; the log clearly states that
    human data injection is required.
    """
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin

    lon_min, lat_min, lon_max, lat_max = BBOX
    width = round((lon_max - lon_min) / DUMMY_RES_DEG)
    height = round((lat_max - lat_min) / DUMMY_RES_DEG)
    transform = from_origin(lon_min, lat_max, DUMMY_RES_DEG, DUMMY_RES_DEG)
    data = np.zeros((height, width), dtype="float32")

    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
        nodata=-9999.0,
    ) as dst:
        dst.write(data, 1)
        dst.update_tags(PLACEHOLDER="true", DESCRIPTION=description)

    log(
        f"DUMMY DATA WRITTEN: {path.name} ({description}). "
        "HUMAN DATA INJECTION REQUIRED before operational use.",
        level="WARN",
    )
    return path


def write_metadata(name: str, payload: dict) -> None:
    path = OUTPUT_DIR / f"{name}.meta.json"
    payload = {
        "generatedAt": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        **payload,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
