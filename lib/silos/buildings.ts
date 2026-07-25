/**
 * Local LARIAC building footprints for the Eaton / Altadena / Pasadena demo.
 * Served as a single preloaded GeoJSON (`/public/gis/buildings.geojson`) so the
 * map never streams vector tiles (no zoom/pan popping).
 */
import type { Feature, FeatureCollection, Polygon, Position } from "geojson";

/** Clipped AOI used to build the local dataset (WGS84, ~1 km buffer). */
export const BUILDINGS_BBOX = {
  west: -118.185,
  south: 34.148,
  east: -118.055,
  north: 34.235,
} as const;

/** Public URL for the clipped, filtered building FeatureCollection. */
export const BUILDINGS_GEOJSON_URL = "/gis/buildings.geojson";

/** @deprecated Kept for docs / rebuild tooling; runtime uses GeoJSON. */
export const BUILDINGS_PMTILES_URL = "/gis/buildings.pmtiles";

/**
 * Soft cap for fill-extrusion near the incident.
 * High enough to fill the fire + prediction AOI without sparse “empty” flats.
 */
export const BUILDINGS_3D_MAX = 14000;

export type BuildingTint = "neutral" | "fire" | "pred";

let buildingsCache: FeatureCollection | null = null;
let buildingsLoad: Promise<FeatureCollection> | null = null;

/**
 * Fetch the clipped building dataset once and keep it for the app lifetime.
 * Safe to call from multiple mount cycles — returns the same in-memory collection.
 */
export function loadBuildingsGeoJSON(): Promise<FeatureCollection> {
  if (buildingsCache) {
    return Promise.resolve(buildingsCache);
  }
  if (!buildingsLoad) {
    buildingsLoad = fetch(BUILDINGS_GEOJSON_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Buildings GeoJSON failed: ${response.status} ${response.statusText}`,
          );
        }
        return response.json() as Promise<FeatureCollection>;
      })
      .then((fc) => {
        buildingsCache = fc;
        return fc;
      })
      .catch((error) => {
        buildingsLoad = null;
        throw error;
      });
  }
  return buildingsLoad;
}

export function getBuildingsGeoJSON(): FeatureCollection | null {
  return buildingsCache;
}

function ringContains(ring: Position[], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const denom = yj - yi || 1e-12;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / denom + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygon(
  poly: Feature<Polygon> | Polygon,
  lng: number,
  lat: number,
): boolean {
  const geom = "geometry" in poly ? poly.geometry : poly;
  const ring = geom.coordinates[0];
  return Boolean(ring?.length && ringContains(ring, lng, lat));
}

function polygonCentroid(coords: Position[][]): [number, number] | null {
  const ring = coords[0];
  if (!ring?.length) {
    return null;
  }
  let sx = 0;
  let sy = 0;
  let n = 0;
  const end = ring.length > 1 ? ring.length - 1 : ring.length;
  for (let i = 0; i < end; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
    n += 1;
  }
  return n ? [sx / n, sy / n] : null;
}

/** Approximate geodesic buffer by pushing vertices away from centroid. */
export function bufferPolygonMeters(
  poly: Feature<Polygon> | Polygon,
  meters: number,
): Feature<Polygon> {
  const geom = "geometry" in poly ? poly.geometry : poly;
  const ring = geom.coordinates[0];
  const c = polygonCentroid(geom.coordinates);
  if (!ring?.length || !c) {
    return { type: "Feature", properties: {}, geometry: geom };
  }
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((c[1] * Math.PI) / 180) || 1e-6;
  const out: Position[] = [];
  const last = ring.length > 1 ? ring.length - 1 : ring.length;
  for (let i = 0; i < last; i++) {
    const lng = ring[i][0];
    const lat = ring[i][1];
    const dxM = (lng - c[0]) * mPerDegLng;
    const dyM = (lat - c[1]) * mPerDegLat;
    const len = Math.hypot(dxM, dyM);
    if (len < 1e-3) {
      out.push([lng + meters / mPerDegLng, lat]);
      continue;
    }
    const factor = (len + meters) / len;
    out.push([
      c[0] + (dxM * factor) / mPerDegLng,
      c[1] + (dyM * factor) / mPerDegLat,
    ]);
  }
  if (out.length) {
    out.push(out[0]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [out] },
  };
}

/**
 * Real LARIAC footprints for 3D extrusion near the incident.
 * Keeps spatial density (no tall-only sampling) so the AOI does not look empty.
 */
export function buildingsForExtrusion(
  all: FeatureCollection,
  clip: Feature<Polygon> | Polygon,
  opts: {
    firePoly: Feature<Polygon> | null;
    predPoly: Feature<Polygon> | null;
    fireOn: boolean;
    predictionOn: boolean;
    max?: number;
  },
): FeatureCollection {
  const max = opts.max ?? BUILDINGS_3D_MAX;
  const rows: Feature[] = [];

  for (const feature of all.features) {
    const geometry = feature.geometry;
    if (!geometry || geometry.type !== "Polygon") {
      continue;
    }
    const c = polygonCentroid(geometry.coordinates);
    if (!c || !pointInPolygon(clip, c[0], c[1])) {
      continue;
    }
    const height = Number(feature.properties?.height);
    const h = Number.isFinite(height) && height > 0 ? height : 6.5;
    let tint: BuildingTint = "neutral";
    if (opts.fireOn && opts.firePoly && pointInPolygon(opts.firePoly, c[0], c[1])) {
      tint = "fire";
    } else if (
      opts.predictionOn &&
      opts.predPoly &&
      pointInPolygon(opts.predPoly, c[0], c[1])
    ) {
      tint = "pred";
    }
    rows.push({
      type: "Feature",
      properties: { height: h, tint },
      geometry,
    });
  }

  // Uniform spatial subsample if over budget (keeps density; avoids tall-only gaps).
  let picked = rows;
  if (rows.length > max) {
    const step = rows.length / max;
    picked = Array.from({ length: max }, (_, i) => rows[Math.floor(i * step)]!);
  }

  return { type: "FeatureCollection", features: picked };
}

/** Clip polygon for 3D: prefer spread footprint, else fire + buffer. */
export function buildings3dClip(
  firePoly: Feature<Polygon>,
  predPoly: Feature<Polygon> | null,
  bufferM: number,
): Feature<Polygon> {
  if (predPoly) {
    return bufferPolygonMeters(predPoly, Math.min(250, bufferM * 0.25));
  }
  return bufferPolygonMeters(firePoly, bufferM);
}
