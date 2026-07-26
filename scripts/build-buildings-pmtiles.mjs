#!/usr/bin/env node
/**
 * Rebuild public/gis/buildings.pmtiles from LA County LARIAC MapServer.
 *
 * Clips to the Eaton Fire / Altadena / Pasadena demo AOI (with buffer),
 * normalizes HEIGHT feet → meters, then packs MVT tiles into PMTiles.
 *
 * Requires: network, Node 20+, and Python 3 with `pmtiles` installed
 *   python3 -m pip install --user pmtiles
 *
 * Also needs temporary npm packages (installed under /tmp):
 *   geojson-vt, vt-pbf
 *
 * Usage:
 *   node scripts/build-buildings-pmtiles.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "gis", "buildings.pmtiles");

const BBOX = { west: -118.185, south: 34.148, east: -118.055, north: 34.235 };
const LARIAC =
  "https://arcgis.gis.lacounty.gov/arcgis/rest/services/DRP/GISNET_Public/MapServer/434/query";
const PAGE = 2000;
const FT_TO_M = 0.3048;
const DEFAULT_H = 6.5;
const MIN_Z = 10;
const MAX_Z = 16;

function rndCoords(c) {
  if (typeof c[0] === "number") {
    return [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6];
  }
  return c.map(rndCoords);
}

function heightM(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.min(80, Math.max(3, Math.round(raw * FT_TO_M * 10) / 10));
  }
  return DEFAULT_H;
}

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "HEIGHT,OBJECTID",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
  });
  const res = await fetch(`${LARIAC}?${params}`);
  if (!res.ok) {
    throw new Error(`LARIAC HTTP ${res.status} at offset ${offset}`);
  }
  return res.json();
}

async function downloadGeoJSON() {
  const features = [];
  for (let offset = 0; ; offset += PAGE) {
    console.error(`fetching offset ${offset}...`);
    let page;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        page = await fetchPage(offset);
        break;
      } catch (error) {
        console.error(`  retry ${attempt + 1}:`, error.message);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (!page) {
      throw new Error("LARIAC download failed");
    }
    const n = page.features?.length ?? 0;
    for (const f of page.features ?? []) {
      if (
        !f.geometry ||
        (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon")
      ) {
        continue;
      }
      features.push({
        type: "Feature",
        properties: { height: heightM(f.properties?.HEIGHT) },
        geometry: {
          type: f.geometry.type,
          coordinates: rndCoords(f.geometry.coordinates),
        },
      });
    }
    console.error(`  got ${n}, total ${features.length}`);
    if (n < PAGE) {
      break;
    }
    if (offset > 250000) {
      break;
    }
  }
  return { type: "FeatureCollection", features };
}

function ensureTileTools(workDir) {
  const require = createRequire(join(workDir, "package.json"));
  try {
    require("geojson-vt");
    require("vt-pbf");
    return require;
  } catch {
    console.error("Installing geojson-vt + vt-pbf into temp workdir...");
    writeFileSync(join(workDir, "package.json"), JSON.stringify({ type: "commonjs" }));
    const install = spawnSync("npm", ["install", "geojson-vt@4.0.2", "vt-pbf@3.1.3"], {
      cwd: workDir,
      stdio: "inherit",
    });
    if (install.status !== 0) {
      throw new Error("npm install of tile tools failed");
    }
    return createRequire(join(workDir, "package.json"));
  }
}

function buildTiles(fc, workDir) {
  const require = ensureTileTools(workDir);
  const geojsonvt = require("geojson-vt").default ?? require("geojson-vt");
  const vtpbf = require("vt-pbf");

  const index = geojsonvt(fc, {
    maxZoom: MAX_Z,
    indexMaxZoom: 14,
    indexMaxPoints: 0,
    tolerance: 1.5,
    extent: 4096,
    buffer: 64,
  });

  const lng2tile = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
  const lat2tile = (lat, z) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
    );
  };

  const tilesDir = join(workDir, "tiles");
  rmSync(tilesDir, { recursive: true, force: true });
  mkdirSync(tilesDir, { recursive: true });
  const manifest = [];

  for (let z = MIN_Z; z <= MAX_Z; z++) {
    const x0 = lng2tile(BBOX.west, z);
    const x1 = lng2tile(BBOX.east, z);
    const y0 = lat2tile(BBOX.north, z);
    const y1 = lat2tile(BBOX.south, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const tile = index.getTile(z, x, y);
        if (!tile?.features?.length) {
          continue;
        }
        const buf = Buffer.from(vtpbf.fromGeojsonVt({ buildings: tile }));
        const dir = join(tilesDir, String(z), String(x));
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${y}.pbf`), buf);
        manifest.push([z, x, y]);
      }
    }
    console.error(`z=${z} tiles ${manifest.length}`);
  }
  writeFileSync(join(workDir, "tile_manifest.json"), JSON.stringify(manifest));
  return { tilesDir, manifestPath: join(workDir, "tile_manifest.json") };
}

function packPmtiles(workDir, tilesDir, manifestPath) {
  const py = `
import gzip, json
from pathlib import Path
from pmtiles.tile import zxy_to_tileid, TileType, Compression
from pmtiles.writer import Writer

tiles_root = Path(${JSON.stringify(tilesDir)})
manifest = json.loads(Path(${JSON.stringify(manifestPath)}).read_text())
manifest.sort(key=lambda t: zxy_to_tileid(t[0], t[1], t[2]))
out = Path(${JSON.stringify(OUT)})
out.parent.mkdir(parents=True, exist_ok=True)
with out.open("wb") as f:
    w = Writer(f)
    for z, x, y in manifest:
        data = (tiles_root / str(z) / str(x) / f"{y}.pbf").read_bytes()
        w.write_tile(zxy_to_tileid(z, x, y), gzip.compress(data, compresslevel=9))
    header = {
        "version": 3,
        "tile_type": TileType.MVT,
        "tile_compression": Compression.GZIP,
        "min_zoom": ${MIN_Z},
        "max_zoom": ${MAX_Z},
        "min_lon_e7": int(${BBOX.west} * 1e7),
        "min_lat_e7": int(${BBOX.south} * 1e7),
        "max_lon_e7": int(${BBOX.east} * 1e7),
        "max_lat_e7": int(${BBOX.north} * 1e7),
        "center_zoom": 13,
        "center_lon_e7": int(-118.12 * 1e7),
        "center_lat_e7": int(34.19 * 1e7),
    }
    metadata = {
        "name": "LARIAC Building Outline 2023 (Eaton/Altadena/Pasadena clip)",
        "attribution": "Los Angeles County / LARIAC",
        "format": "pbf",
        "bounds": "${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}",
        "minzoom": ${MIN_Z},
        "maxzoom": ${MAX_Z},
        "vector_layers": [{
            "id": "buildings",
            "fields": {"height": "Number"},
            "minzoom": ${MIN_Z},
            "maxzoom": ${MAX_Z},
        }],
    }
    w.finalize(header, metadata)
print(out, "mb", round(out.stat().st_size / 1e6, 2))
`;
  const result = spawnSync("python3", ["-c", py], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error("Python PMTiles pack failed (pip install --user pmtiles?)");
  }
}

const workDir = join(tmpdir(), "silos-buildings-build");
mkdirSync(workDir, { recursive: true });

const fc = await downloadGeoJSON();
writeFileSync(join(workDir, "buildings.geojson"), JSON.stringify(fc));
writeFileSync(join(workDir, "buildings.geojson.gz"), gzipSync(Buffer.from(JSON.stringify(fc)), { level: 9 }));
console.error(`features ${fc.features.length}`);

const { tilesDir, manifestPath } = buildTiles(fc, workDir);
packPmtiles(workDir, tilesDir, manifestPath);

if (!existsSync(OUT)) {
  throw new Error(`Expected output missing: ${OUT}`);
}
console.error(`OK wrote ${OUT}`);
