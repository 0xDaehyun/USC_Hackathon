/**
 * MapLibre GL JS v6 is ESM-only. Bundlers (Next/Turbopack) break the default
 * `import.meta.url` worker resolution, so GeoJSON sources silently produce
 * zero tiles — basemap raster still paints, overlays do not.
 *
 * Workers are copied to /public/maplibre from maplibre-gl/dist (see package
 * postinstall). Call ensureMaplibreWorker() once before `new Map(...)`.
 *
 * PMTiles protocol serves local vector tiles from /public/gis/*.pmtiles.
 */
import { addProtocol, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";

let workerConfigured = false;
let pmtilesConfigured = false;

export function ensureMaplibreWorker(): void {
  if (workerConfigured || typeof window === "undefined") {
    return;
  }
  setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);
  workerConfigured = true;
}

/** Register the `pmtiles://` protocol once (idempotent). */
export function ensurePmtilesProtocol(): void {
  if (pmtilesConfigured || typeof window === "undefined") {
    return;
  }
  const protocol = new Protocol();
  addProtocol("pmtiles", (requestParameters, abortController) =>
    protocol.tile(requestParameters, abortController),
  );
  pmtilesConfigured = true;
}
