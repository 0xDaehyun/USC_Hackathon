/**
 * Smoke-check that MapLibre GeoJSON overlays actually paint.
 * Run: PW_CHANNEL=chrome node scripts/check-map-layers.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3100";

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PW_CHANNEL || "chrome",
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") {
    errors.push(msg.text());
  }
});

await page.goto(`${base}/map`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForFunction(() => Boolean(window.__silosMap?.loaded?.()), null, {
  timeout: 30_000,
});
await page.waitForTimeout(2500);

const result = await page.evaluate(() => {
  const map = window.__silosMap;
  const canvas = document.querySelector(".maplibregl-canvas");
  const box = canvas?.getBoundingClientRect();
  const layers = map?.getStyle?.()?.layers?.map((layer) => layer.id) ?? [];
  const fire = map?.querySourceFeatures?.("silos-fire")?.length ?? -1;
  const sectors = map?.querySourceFeatures?.("silos-sectors")?.length ?? -1;
  const prediction = map?.querySourceFeatures?.("silos-prediction")?.length ?? -1;
  const buildings =
    map?.querySourceFeatures?.("silos-buildings", {
      sourceLayer: "buildings",
    })?.length ?? -1;
  const rendered =
    map?.queryRenderedFeatures?.(undefined, {
      layers: ["silos-fire-fill", "silos-prediction-fill", "silos-sectors-fill"],
    })?.length ?? -1;
  return {
    hasCanvas: !!canvas,
    canvasW: box?.width ?? 0,
    canvasH: box?.height ?? 0,
    layerCount: layers.length,
    hasFireLayer: layers.includes("silos-fire-fill"),
    sourceFeatures: { fire, sectors, prediction, buildings },
    renderedOverlayFeatures: rendered,
    workerOk: performance
      .getEntriesByType("resource")
      .some((entry) => entry.name.includes("maplibre-gl-worker")),
  };
});

console.log(JSON.stringify({ result, errors: errors.slice(0, 12) }, null, 2));

const workerRes = await page.request.get(`${base}/maplibre/maplibre-gl-worker.mjs`);
const sharedRes = await page.request.get(`${base}/maplibre/maplibre-gl-shared.mjs`);
console.log("worker status", workerRes.status(), "shared status", sharedRes.status());

await browser.close();

if (workerRes.status() !== 200 || sharedRes.status() !== 200) {
  console.error("FAIL: worker assets not served");
  process.exit(2);
}
if (!result.hasCanvas || result.canvasW < 100 || result.canvasH < 100) {
  console.error("FAIL: map canvas missing or zero-sized");
  process.exit(1);
}
if (!result.hasFireLayer) {
  console.error("FAIL: fire layer missing from style");
  process.exit(1);
}
if (
  result.sourceFeatures.fire < 1 ||
  result.sourceFeatures.sectors < 1 ||
  result.sourceFeatures.prediction < 1
) {
  console.error("FAIL: GeoJSON sources empty — worker likely broken");
  process.exit(1);
}
console.log("OK: map overlays have GeoJSON features");
