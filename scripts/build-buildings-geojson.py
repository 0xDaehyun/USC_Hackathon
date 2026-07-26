#!/usr/bin/env python3
"""
Rebuild public/gis/buildings.geojson from public/gis/buildings.pmtiles.

Extracts z16 MVT features, dedupes by centroid, and writes a deterministic
spatially distributed browser subset for one-shot preload (no tile streaming).
The PMTiles file remains the complete clipped source.

Requires: pip install pmtiles mapbox-vector-tile
  python3 scripts/build-buildings-geojson.py
"""
from __future__ import annotations

import gzip
import json
import math
import sys
from pathlib import Path

from pmtiles.reader import MmapSource, Reader
import mapbox_vector_tile

ROOT = Path(__file__).resolve().parents[1]
PMTILES = ROOT / "public" / "gis" / "buildings.pmtiles"
OUT = ROOT / "public" / "gis" / "buildings.geojson"
MAX_BROWSER_FEATURES = 30_000


def lng2tile(lng: float, z: int) -> int:
    return int((lng + 180.0) / 360.0 * (1 << z))


def lat2tile(lat: float, z: int) -> int:
    r = math.radians(lat)
    return int(
        (1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0 * (1 << z)
    )


def make_transformer(z: int, x: int, y: int, extent: int = 4096):
    n = 1 << z

    def xf(px: float, py: float):
        lng = (x + px / extent) / n * 360.0 - 180.0
        lat = math.degrees(
            math.atan(math.sinh(math.pi * (1 - 2 * (y + py / extent) / n)))
        )
        return lng, lat

    return xf


def centroid(ring):
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    if not pts:
        return None
    return (
        sum(p[0] for p in pts) / len(pts),
        sum(p[1] for p in pts) / len(pts),
    )


def main() -> int:
    if not PMTILES.exists():
        print(f"missing {PMTILES}", file=sys.stderr)
        return 1

    reader = Reader(MmapSource(PMTILES.open("rb")))
    header = reader.header()
    min_lon = header["min_lon_e7"] / 1e7
    min_lat = header["min_lat_e7"] / 1e7
    max_lon = header["max_lon_e7"] / 1e7
    max_lat = header["max_lat_e7"] / 1e7
    z = header["max_zoom"]

    unique: dict[tuple[float, float], dict] = {}
    x0, x1 = lng2tile(min_lon, z), lng2tile(max_lon, z)
    y0, y1 = lat2tile(max_lat, z), lat2tile(min_lat, z)

    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            data = reader.get(z, x, y)
            if not data:
                continue
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            tile = mapbox_vector_tile.decode(
                data,
                default_options={
                    "y_coord_down": True,
                    "geojson": True,
                    "transformer": make_transformer(z, x, y),
                },
            )
            layer = tile.get("buildings")
            if not layer:
                continue
            for feature in layer.get("features", []):
                geom = feature.get("geometry") or {}
                props = feature.get("properties") or {}
                gtype = geom.get("type")
                coords = geom.get("coordinates")
                if not coords:
                    continue
                polys = coords if gtype == "MultiPolygon" else [coords]
                for poly_coords in polys:
                    exterior = poly_coords[0]
                    c = centroid(exterior)
                    if not c:
                        continue
                    key = (round(c[0], 5), round(c[1], 5))
                    if key in unique:
                        continue
                    try:
                        height = float(props.get("height"))
                    except (TypeError, ValueError):
                        height = 6.5
                    if not height or height <= 0:
                        height = 6.5
                    qcoords = [
                        [[round(p[0], 6), round(p[1], 6)] for p in ring]
                        for ring in poly_coords
                    ]
                    unique[key] = {
                        "type": "Feature",
                        "properties": {"height": round(height, 1)},
                        "geometry": {"type": "Polygon", "coordinates": qcoords},
                    }

    features = list(unique.values())
    source_count = len(features)
    if source_count > MAX_BROWSER_FEATURES:
        step = source_count / MAX_BROWSER_FEATURES
        features = [
            features[min(int(i * step), source_count - 1)]
            for i in range(MAX_BROWSER_FEATURES)
        ]

    fc = {"type": "FeatureCollection", "features": features}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(fc, separators=(",", ":"))
    OUT.write_text(text)
    print(
        f"OK {OUT} source={source_count} browser={len(fc['features'])} "
        f"bytes={OUT.stat().st_size}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
