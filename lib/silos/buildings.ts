/**
 * Local LARIAC building footprints for the Eaton / Altadena / Pasadena demo.
 * Served as a single preloaded GeoJSON (`/public/gis/buildings.geojson`) so the
 * map never streams vector tiles (no zoom/pan popping).
 */
import type { FeatureCollection } from "geojson";

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

/** @deprecated Runtime source is GeoJSON (no vector source-layer). */
export const BUILDINGS_SOURCE_LAYER = "buildings";

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

/** Synchronous access after `loadBuildingsGeoJSON()` has resolved. */
export function getBuildingsGeoJSON(): FeatureCollection | null {
  return buildingsCache;
}
