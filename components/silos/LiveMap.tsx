"use client";

import type {
  Feature,
  FeatureCollection,
  Polygon,
  Position,
} from "geojson";
import {
  GeoJSONSource,
  Map as MlMap,
  NavigationControl,
  Popup,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { loadBuildingsGeoJSON } from "@/lib/silos/buildings";
import {
  ACCESS_ROADS,
  FACILITIES,
  FIRE_BOUNDARY,
  POPULATION_VULNERABILITY,
  PREDICTION_STEPS,
  SECTOR_POLYGONS,
  accessRoadCenter,
  sectorCenter,
} from "@/lib/silos/mock/geo";
import { ensureMaplibreWorker } from "@/lib/silos/maplibre";
import type { Fire, FirePrediction, Sector } from "@/lib/silos/types";

/**
 * Dark GIS basemap (CARTO dark, no labels) — black ground for overlays.
 * Self-contained style so a remote vector-style fetch cannot blank the map.
 */
const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: ["a", "b", "c", "d"].map(
        (s) =>
          `https://${s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png`,
      ),
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#000000" },
    },
    { id: "carto-dark", type: "raster", source: "carto-dark" },
  ],
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#e61919",
  warning: "#fece09",
  monitor: "#5c666d",
};

/** Vulnerability class → choropleth color. */
const VULN_COLORS: Record<string, string> = {
  elderly: "#f472b6",
  no_vehicle: "#a855f7",
  language: "#61d5f8",
  egress: "#fece09",
  mixed: "#fb923c",
};

type LayerToggles = {
  fire: boolean;
  prediction: boolean;
  population: boolean;
  facilities: boolean;
  access: boolean;
  buildings: boolean;
};

const TOGGLE_LAYERS: Record<keyof LayerToggles, string[]> = {
  fire: ["silos-fire-fill", "silos-fire-line"],
  prediction: ["silos-prediction-fill", "silos-prediction-line"],
  population: ["silos-population-fill", "silos-population-line"],
  facilities: ["silos-facilities"],
  access: ["silos-access-roads", "silos-access-roads-casing", "silos-access-highlight"],
  buildings: [
    "silos-buildings-flat",
    "silos-buildings-flat-outline",
    "silos-buildings-3d",
    "silos-buildings-roof",
  ],
};

/** Neutral concrete (outside hazard). */
const BUILDING_NEUTRAL = "#d8d6d0";
const BUILDING_NEUTRAL_ROOF = "#ebe9e4";
/** Solid hazard tints — match mockup building component colors. */
const BUILDING_FIRE = "#e61919";
const BUILDING_FIRE_ROOF = "#c62828";
const BUILDING_PRED = "#ff8a65";
const BUILDING_PRED_ROOF = "#e07050";

/** GPU LOD: extrusions only near the fire, and only when zoomed in. */
const BUILDING_3D_MIN_ZOOM = 14;
const FIRE_BUILDING_BUFFER_M = 800;
/** Drop garages / sheds / tiny aux footprints (approx. m²). */
const MIN_BUILDING_AREA_M2 = 45;
/** Vector-tile proxy for tiny structures (tiles only carry `height`). */
const MIN_BUILDING_HEIGHT_M = 5;

const FIRE_BUILDING_LAYERS = [
  "silos-buildings-fire-3d",
  "silos-buildings-fire-roof",
] as const;
const PRED_BUILDING_LAYERS = [
  "silos-buildings-pred-3d",
  "silos-buildings-pred-roof",
] as const;
const BUILDING_3D_CORE_LAYERS = [
  "silos-buildings-3d",
  "silos-buildings-roof",
] as const;

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

function ringContains(ring: Position[], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const denom = yj - yi || 1e-12;
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / denom + xi;
    if (hit) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(poly: Feature<Polygon> | Polygon, lng: number, lat: number): boolean {
  const geom = "geometry" in poly ? poly.geometry : poly;
  const ring = geom.coordinates[0];
  if (!ring?.length) {
    return false;
  }
  if (!ringContains(ring, lng, lat)) {
    return false;
  }
  for (let h = 1; h < geom.coordinates.length; h++) {
    if (ringContains(geom.coordinates[h], lng, lat)) {
      return false;
    }
  }
  return true;
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
  if (n === 0) {
    return null;
  }
  return [sx / n, sy / n];
}

/** Shoelace footprint area in m² (local equirectangular). */
function ringAreaM2(ring: Position[]): number {
  if (ring.length < 3) {
    return 0;
  }
  const lat0 = ring[0][1];
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0] * mPerDegLng;
    const yi = ring[i][1] * mPerDegLat;
    const xj = ring[j][0] * mPerDegLng;
    const yj = ring[j][1] * mPerDegLat;
    sum += xj * yi - xi * yj;
  }
  return Math.abs(sum) / 2;
}

/**
 * Approximate geodesic buffer: push each vertex away from the centroid by `meters`.
 * Good enough for an ~800 m demo LOD clip around the fire perimeter.
 */
function bufferPolygonMeters(
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
    out.push([c[0] + (dxM * factor) / mPerDegLng, c[1] + (dyM * factor) / mPerDegLat]);
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

/** Select buildings from the preloaded FC whose centroid falls inside `poly`. */
function harvestBuildingsInPolygon(
  buildings: FeatureCollection,
  poly: Feature<Polygon> | Polygon,
): FeatureCollection {
  const seen = new Set<string>();
  const out: Feature<Polygon>[] = [];
  for (const feature of buildings.features) {
    const geometry = feature.geometry;
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
      continue;
    }
    const polys =
      geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    for (const coords of polys) {
      const c = polygonCentroid(coords);
      if (!c || !pointInPolygon(poly, c[0], c[1])) {
        continue;
      }
      const area = ringAreaM2(coords[0] ?? []);
      if (area > 0 && area < MIN_BUILDING_AREA_M2) {
        continue;
      }
      const heightRaw = Number(feature.properties?.height);
      const height =
        Number.isFinite(heightRaw) && heightRaw > 0 ? heightRaw : 6.5;
      if (height < MIN_BUILDING_HEIGHT_M) {
        continue;
      }
      const key = `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({
        type: "Feature",
        properties: { height },
        geometry: { type: "Polygon", coordinates: coords },
      });
    }
  }
  return { type: "FeatureCollection", features: out };
}

/** Facility category fill colors (unchanged — pin icon only swaps shape). */
const FACILITY_COLORS: Record<string, string> = {
  nursing_home: "#f472b6",
  disability_facility: "#c084fc",
  school: "#61d5f8",
  senior_center: "#fece09",
  shelter: "#34d17b",
};

/**
 * SDF map-pin glyph for MapLibre `icon-color` tinting.
 * Drawn once at setup; categories keep their existing colors via paint.
 */
function createFacilityPinImage(): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { width: size, height: size, data: new Uint8Array(size * size * 4) };
  }
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size * 0.36;
  const r = size * 0.24;
  ctx.fillStyle = "#ffffff";
  // Tip
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.92, cy + r * 0.55);
  ctx.quadraticCurveTo(cx - r * 0.2, cy + r * 1.35, cx, size * 0.93);
  ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 1.35, cx + r * 0.92, cy + r * 0.55);
  ctx.closePath();
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Center hole (classic pin)
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  const imageData = ctx.getImageData(0, 0, size, size);
  return {
    width: size,
    height: size,
    data: new Uint8Array(imageData.data.buffer),
  };
}

/** Seed geometry so the map paints before the first poll returns. */
function seedFire(): FeatureCollection {
  return { type: "FeatureCollection", features: [FIRE_BOUNDARY] };
}

function seedPrediction(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: PREDICTION_STEPS.map((step) => ({
      ...step.polygon,
      properties: { hour_offset: step.hour_offset },
    })),
  };
}

function seedSectors(sectors: Sector[]): FeatureCollection {
  if (sectors.length > 0) {
    return {
      type: "FeatureCollection",
      features: sectors.map((sector) => ({
        ...sector.boundary_geojson,
        properties: {
          id: sector.id,
          name: sector.name,
          priority: sector.priority,
          coverage: sector.coverage_status,
        },
      })),
    };
  }
  return {
    type: "FeatureCollection",
    features: Object.entries(SECTOR_POLYGONS).map(([id, feature]) => ({
      ...feature,
      properties: {
        id,
        name: id,
        priority: id === "S1" || id === "S7" ? "critical" : "warning",
        coverage: "unassigned",
      },
    })),
  };
}

export function LiveMap({
  fire,
  prediction,
  sectors,
  selectedSectorId,
  onSelectSector,
  focusRoadName = null,
}: {
  fire: Fire | null;
  prediction: FirePrediction | null;
  sectors: Sector[];
  selectedSectorId: string | null;
  onSelectSector: (id: string) => void;
  /** When set, enables the road-access layer and flies to that road. */
  focusRoadName?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  /** Preloaded buildings FC — never re-fetched on pan/zoom. */
  const buildingsFcRef = useRef<FeatureCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [attribOpen, setAttribOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [toggles, setToggles] = useState<LayerToggles>({
    fire: true,
    prediction: true,
    population: false,
    facilities: false,
    access: false,
    buildings: true,
  });
  const onSelectSectorRef = useRef(onSelectSector);
  useEffect(() => {
    onSelectSectorRef.current = onSelectSector;
  }, [onSelectSector]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    // Required for MapLibre v6 + Next: GeoJSON tiling runs in the worker.
    ensureMaplibreWorker();
    let cancelled = false;

    const map = new MlMap({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [-118.118, 34.188],
      zoom: 12.6,
      // Original demo camera: slight oblique / diagonal.
      pitch: 48,
      bearing: -18,
      maxPitch: 70,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    if (typeof window !== "undefined") {
      (window as Window & { __silosMap?: MlMap }).__silosMap = map;
    }
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");

    const resize = () => {
      try {
        map.resize();
      } catch {
        /* map may already be removed during Strict Mode teardown */
      }
    };
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
    observer?.observe(containerRef.current);
    window.addEventListener("resize", resize);

    const onLoad = async () => {
      try {
        const t0 = performance.now();
        const buildings = await loadBuildingsGeoJSON();
        if (cancelled) {
          return;
        }
        // #region agent log
        fetch("http://127.0.0.1:7368/ingest/4d1c1932-4354-4e1b-9b6b-9bfa1e80c43c", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "b207ac",
          },
          body: JSON.stringify({
            sessionId: "b207ac",
            runId: "post-fix",
            hypothesisId: "A",
            location: "LiveMap.tsx:onLoad",
            message: "buildings geojson loaded",
            data: {
              featureCount: buildings.features.length,
              loadMs: Math.round(performance.now() - t0),
              sourceType: "geojson",
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        buildingsFcRef.current = buildings;
        setupLayers(map, buildings);
        wireInteractions(map, (id) => onSelectSectorRef.current(id));
        resize();
        setReady(true);
        // #region agent log
        fetch("http://127.0.0.1:7368/ingest/4d1c1932-4354-4e1b-9b6b-9bfa1e80c43c", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "b207ac",
          },
          body: JSON.stringify({
            sessionId: "b207ac",
            runId: "post-fix",
            hypothesisId: "B",
            location: "LiveMap.tsx:onLoad",
            message: "layers ready",
            data: {
              hasBuildingsSource: Boolean(map.getSource("silos-buildings")),
              hasFlatLayer: Boolean(map.getLayer("silos-buildings-flat")),
              has3dLayer: Boolean(map.getLayer("silos-buildings-3d")),
              zoom: map.getZoom(),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      } catch (error) {
        // #region agent log
        fetch("http://127.0.0.1:7368/ingest/4d1c1932-4354-4e1b-9b6b-9bfa1e80c43c", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "b207ac",
          },
          body: JSON.stringify({
            sessionId: "b207ac",
            runId: "post-fix",
            hypothesisId: "A",
            location: "LiveMap.tsx:onLoad",
            message: "buildings setup failed",
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        console.error("SILOS map layer setup failed:", error);
      }
    };

    if (map.loaded()) {
      void onLoad();
    } else {
      map.on("load", () => {
        void onLoad();
      });
    }
    map.on("error", (event) => console.warn("map error (non-fatal):", event.error));

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Keep dynamic sources in sync with polled data (seeded locally first).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    if (fire) {
      setSourceData(map, "silos-fire", {
        type: "FeatureCollection",
        features: [fire.boundary_geojson],
      });
    }
    if (prediction) {
      setSourceData(map, "silos-prediction", {
        type: "FeatureCollection",
        features: prediction.hourly_steps.map((step) => ({
          ...step.spread_polygon_geojson,
          properties: { hour_offset: step.hour_offset },
        })),
      });
    }
    setSourceData(map, "silos-sectors", seedSectors(sectors));
    map.resize();
  }, [fire, prediction, sectors, ready]);

  // LOD building meshes: flat from preloaded GeoJSON; 3D only in fire+buffer at z14+.
  useEffect(() => {
    const map = mapRef.current;
    const buildings = buildingsFcRef.current;
    if (!map || !ready || !buildings) {
      return;
    }
    let lastKey = "";
    const sync = () => {
      const key = syncBuildingLodMeshes(map, buildings, {
        fire,
        prediction,
        buildingsOn: toggles.buildings,
        fireOn: toggles.fire && toggles.buildings,
        predictionOn: toggles.prediction && toggles.buildings,
        prevKey: lastKey,
      });
      lastKey = key;
    };
    sync();
    map.on("zoomend", sync);
    return () => {
      map.off("zoomend", sync);
    };
  }, [fire, prediction, ready, toggles.fire, toggles.prediction, toggles.buildings]);

  // Selected-sector highlight + cinematic fly-in.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    if (map.getLayer("silos-sectors-selected")) {
      map.setFilter("silos-sectors-selected", [
        "==",
        ["get", "id"],
        selectedSectorId ?? "",
      ]);
    }
    if (map.getLayer("silos-sectors-selected-fill")) {
      map.setFilter("silos-sectors-selected-fill", [
        "==",
        ["get", "id"],
        selectedSectorId ?? "",
      ]);
    }
    if (selectedSectorId && !focusRoadName) {
      map.easeTo({
        center: sectorCenter(selectedSectorId),
        zoom: 15.2,
        pitch: 50,
        bearing: -25,
        duration: 2200,
      });
    }
  }, [selectedSectorId, ready, focusRoadName]);

  // Road-access focus from the sector dossier.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focusRoadName) {
      return;
    }
    setToggles((prev) => ({ ...prev, access: true }));
    if (map.getLayer("silos-access-highlight")) {
      map.setFilter("silos-access-highlight", [
        "==",
        ["downcase", ["get", "name"]],
        focusRoadName.toLowerCase(),
      ]);
      map.setLayoutProperty("silos-access-highlight", "visibility", "visible");
    }
    const center = accessRoadCenter(focusRoadName);
    if (center) {
      map.easeTo({
        center,
        zoom: 15.6,
        pitch: 50,
        bearing: -18,
        duration: 1800,
      });
    }
  }, [focusRoadName, ready]);

  // Layer visibility toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    for (const [key, layerIds] of Object.entries(TOGGLE_LAYERS)) {
      const visible = toggles[key as keyof LayerToggles];
      for (const layerId of layerIds) {
        if (!map.getLayer(layerId)) {
          continue;
        }
        // Keep the highlight filter driven by focusRoadName, not the toggle alone.
        if (layerId === "silos-access-highlight" && !focusRoadName) {
          map.setLayoutProperty(layerId, "visibility", "none");
          continue;
        }
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    }
    // Hazard-tinted building meshes: need both buildings + matching hazard toggle.
    const zoom3d = map.getZoom() >= BUILDING_3D_MIN_ZOOM;
    for (const layerId of BUILDING_3D_CORE_LAYERS) {
      if (!map.getLayer(layerId)) {
        continue;
      }
      map.setLayoutProperty(
        layerId,
        "visibility",
        toggles.buildings && zoom3d ? "visible" : "none",
      );
    }
    for (const layerId of FIRE_BUILDING_LAYERS) {
      if (!map.getLayer(layerId)) {
        continue;
      }
      map.setLayoutProperty(
        layerId,
        "visibility",
        toggles.buildings && toggles.fire && zoom3d ? "visible" : "none",
      );
    }
    for (const layerId of PRED_BUILDING_LAYERS) {
      if (!map.getLayer(layerId)) {
        continue;
      }
      map.setLayoutProperty(
        layerId,
        "visibility",
        toggles.buildings && toggles.prediction && zoom3d ? "visible" : "none",
      );
    }
  }, [toggles, ready, focusRoadName]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={containerRef} className="silos-map-canvas absolute inset-0 bg-black" />

      {/* Layer register — always visible on desktop; toggle menu on mobile */}
      <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setLayersOpen((open) => !open)}
          aria-expanded={layersOpen}
          className="s-panel s-mono px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-[var(--s-type-1)] uppercase md:hidden"
        >
          {layersOpen ? "[ LAYERS ✕ ]" : "[ LAYERS ]"}
        </button>
        <div className={`s-panel w-56 p-3 ${layersOpen ? "block" : "hidden"} md:block`}>
            <p className="s-label s-label--bracket mb-2 hidden md:block">Layers</p>
            <ToggleRow label="Active fire" value={toggles.fire} onChange={(v) => setToggles((t) => ({ ...t, fire: v }))} />
            <ToggleRow label="Spread prediction" value={toggles.prediction} onChange={(v) => setToggles((t) => ({ ...t, prediction: v }))} />
            <ToggleRow label="Population vuln." value={toggles.population} onChange={(v) => setToggles((t) => ({ ...t, population: v }))} />
            <ToggleRow label="Facilities" value={toggles.facilities} onChange={(v) => setToggles((t) => ({ ...t, facilities: v }))} />
            <ToggleRow label="Road access" value={toggles.access} onChange={(v) => setToggles((t) => ({ ...t, access: v }))} />
            <ToggleRow label="3D buildings" value={toggles.buildings} onChange={(v) => setToggles((t) => ({ ...t, buildings: v }))} />
            {toggles.population && (
              <div className="mt-2 space-y-1 border-t border-[var(--s-ink-3)] pt-2">
                <p className="s-label mb-1">Vuln. class</p>
                <LegendRow color={VULN_COLORS.elderly} label="Elderly" />
                <LegendRow color={VULN_COLORS.no_vehicle} label="No vehicle" />
                <LegendRow color={VULN_COLORS.language} label="Language" />
                <LegendRow color={VULN_COLORS.egress} label="Egress" />
                <LegendRow color={VULN_COLORS.mixed} label="Mixed" />
              </div>
            )}
            <div className="mt-2 space-y-1 border-t border-[var(--s-ink-3)] pt-2">
              <p className="s-label mb-1">Fire / impact</p>
              <LegendRow color="#e85a45" label="Active fire" />
              <LegendRow color="#ff8a65" label="Predicted spread" />
              <LegendRow color="#e6e4de" label="Buildings (local LARIAC)" />
            </div>
        </div>
      </div>

      {/* Attribution behind info icon */}
      <div className="absolute right-3 bottom-3 z-10">
        <button
          type="button"
          onClick={() => setAttribOpen((open) => !open)}
          aria-expanded={attribOpen}
          aria-label="Map data attribution"
          className="s-panel flex size-8 items-center justify-center text-[13px] font-semibold text-[var(--s-type-2)] hover:text-[var(--s-type-1)]"
        >
          i
        </button>
        {attribOpen && (
          <div className="s-panel absolute right-0 bottom-10 w-64 p-3 text-[11px] leading-relaxed text-[var(--s-type-2)]">
            <p className="s-label s-label--bracket mb-1.5">Map data</p>
            <p>
              Basemap ©{" "}
              <a
                className="underline"
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap
              </a>{" "}
              contributors, ©{" "}
              <a
                className="underline"
                href="https://carto.com/attributions"
                target="_blank"
                rel="noreferrer"
              >
                CARTO
              </a>
              . Building footprints: local LA County LARIAC 2023 clip
              (<code className="s-mono">/gis/buildings.geojson</code>). Fire
              perimeter, spread rings, sectors, and vulnerability polygons are{" "}
              <strong>simulated demo geometry</strong> — not official CAL FIRE /
              census products.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="s-mono flex cursor-pointer items-center gap-2 py-1 text-[11px] font-medium tracking-[0.04em] text-[var(--s-type-2)] uppercase">
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[#e61919]"
      />
      {label}
    </label>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <p className="s-mono flex items-center gap-2 py-0.5 text-[10.5px] font-medium tracking-[0.04em] text-[var(--s-type-2)] uppercase">
      <span className="size-2.5 shrink-0" style={{ backgroundColor: color }} />
      {label}
    </p>
  );
}

function setSourceData(map: MlMap, sourceId: string, data: FeatureCollection): void {
  // Duck-type: `instanceof GeoJSONSource` can fail across Next.js module copies
  // and silently block all polled map updates.
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (source && typeof source.setData === "function") {
    source.setData(data);
  }
}

function addBuildingExtrusion(
  map: MlMap,
  opts: {
    id: string;
    color: string;
    roof: boolean;
    source: string;
  },
): void {
  map.addLayer({
    id: opts.id,
    type: "fill-extrusion",
    source: opts.source,
    minzoom: BUILDING_3D_MIN_ZOOM,
    paint: opts.roof
      ? {
          "fill-extrusion-color": opts.color,
          "fill-extrusion-height": ["to-number", ["get", "height"]],
          "fill-extrusion-base": [
            "max",
            0,
            ["-", ["to-number", ["get", "height"]], 0.8],
          ],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false,
        }
      : {
          "fill-extrusion-color": opts.color,
          "fill-extrusion-height": ["to-number", ["get", "height"]],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
        },
  });
}

/**
 * Flat footprints from preloaded GeoJSON (cheap). 3D extrusions only for
 * buildings inside fire + ~800 m buffer, and only at zoom >= 14.
 * Harvests from the in-memory FeatureCollection — never reloads tiles.
 */
function syncBuildingLodMeshes(
  map: MlMap,
  buildings: FeatureCollection,
  opts: {
    fire: Fire | null;
    prediction: FirePrediction | null;
    buildingsOn: boolean;
    fireOn: boolean;
    predictionOn: boolean;
    prevKey: string;
  },
): string {
  if (!map.getSource("silos-buildings-3d-geo")) {
    return opts.prevKey;
  }

  const zoom = map.getZoom();
  const zoom3d = zoom >= BUILDING_3D_MIN_ZOOM;
  for (const layerId of BUILDING_3D_CORE_LAYERS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        opts.buildingsOn && zoom3d ? "visible" : "none",
      );
    }
  }
  for (const layerId of FIRE_BUILDING_LAYERS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        opts.fireOn && zoom3d ? "visible" : "none",
      );
    }
  }
  for (const layerId of PRED_BUILDING_LAYERS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        opts.predictionOn && zoom3d ? "visible" : "none",
      );
    }
  }

  if (!opts.buildingsOn || !zoom3d) {
    const key = `off:${opts.fireOn ? 1 : 0}:${opts.predictionOn ? 1 : 0}`;
    if (key !== opts.prevKey) {
      setSourceData(map, "silos-buildings-3d-geo", EMPTY_FC);
      setSourceData(map, "silos-buildings-fire-geo", EMPTY_FC);
      setSourceData(map, "silos-buildings-pred-geo", EMPTY_FC);
    }
    return key;
  }

  const firePoly = opts.fire?.boundary_geojson ?? FIRE_BOUNDARY;
  const bufferPoly = bufferPolygonMeters(firePoly, FIRE_BUILDING_BUFFER_M);
  const coreFc = harvestBuildingsInPolygon(buildings, bufferPoly);
  const fireFc = opts.fireOn
    ? harvestBuildingsInPolygon(buildings, firePoly)
    : EMPTY_FC;
  const predPoly =
    opts.prediction?.hourly_steps?.[opts.prediction.hourly_steps.length - 1]
      ?.spread_polygon_geojson ??
    PREDICTION_STEPS[PREDICTION_STEPS.length - 1]?.polygon;
  const predFc =
    opts.predictionOn && predPoly
      ? harvestBuildingsInPolygon(buildings, predPoly)
      : EMPTY_FC;

  const key = `on:${opts.fireOn ? 1 : 0}:${opts.predictionOn ? 1 : 0}:${coreFc.features.length}:${fireFc.features.length}:${predFc.features.length}`;
  if (key === opts.prevKey) {
    return key;
  }
  // #region agent log
  fetch("http://127.0.0.1:7368/ingest/4d1c1932-4354-4e1b-9b6b-9bfa1e80c43c", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "b207ac",
    },
    body: JSON.stringify({
      sessionId: "b207ac",
      runId: "post-fix",
      hypothesisId: "C",
      location: "LiveMap.tsx:syncBuildingLodMeshes",
      message: "3d lod sync",
      data: {
        zoom: Number(zoom.toFixed(2)),
        zoom3d,
        core3d: coreFc.features.length,
        fire3d: fireFc.features.length,
        pred3d: predFc.features.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  setSourceData(map, "silos-buildings-3d-geo", coreFc);
  setSourceData(map, "silos-buildings-fire-geo", fireFc);
  setSourceData(map, "silos-buildings-pred-geo", predFc);
  return key;
}

/**
 * Layer stack (bottom → top), matching reference Scene Viewer look:
 * basemap → ground overlays (vuln, sectors, fire/prediction) → 3D buildings → icons
 * Fire stays on the ground under buildings — no extrusion, no map labels.
 */
function setupLayers(map: MlMap, buildings: FeatureCollection): void {
  map.addSource("silos-sectors", { type: "geojson", data: seedSectors([]) });
  map.addSource("silos-prediction", { type: "geojson", data: seedPrediction() });
  map.addSource("silos-fire", { type: "geojson", data: seedFire() });
  map.addSource("silos-population", { type: "geojson", data: POPULATION_VULNERABILITY });
  map.addSource("silos-access", { type: "geojson", data: ACCESS_ROADS });
  map.addSource("silos-facilities-src", { type: "geojson", data: FACILITIES });
  // Single preloaded GeoJSON — no PMTiles streaming / tile popping.
  map.addSource("silos-buildings", {
    type: "geojson",
    data: buildings,
  });
  // LOD: flat from preloaded FC; 3D / hazard tints are spatial subsets.
  map.addSource("silos-buildings-3d-geo", { type: "geojson", data: EMPTY_FC });
  map.addSource("silos-buildings-pred-geo", { type: "geojson", data: EMPTY_FC });
  map.addSource("silos-buildings-fire-geo", { type: "geojson", data: EMPTY_FC });

  // 1) Vulnerability — translucent ground fill (toggleable).
  map.addLayer({
    id: "silos-population-fill",
    type: "fill",
    source: "silos-population",
    layout: { visibility: "none" },
    paint: {
      "fill-color": [
        "match",
        ["get", "class"],
        "elderly",
        VULN_COLORS.elderly,
        "no_vehicle",
        VULN_COLORS.no_vehicle,
        "language",
        VULN_COLORS.language,
        "egress",
        VULN_COLORS.egress,
        "mixed",
        VULN_COLORS.mixed,
        "#a855f7",
      ],
      "fill-opacity": 0.32,
    },
  });
  map.addLayer({
    id: "silos-population-line",
    type: "line",
    source: "silos-population",
    layout: { visibility: "none" },
    paint: {
      "line-color": "#9a9a96",
      "line-width": 0.6,
      "line-opacity": 0.35,
    },
  });

  // 2) Operational sectors — light fill + outline (no text labels).
  map.addLayer({
    id: "silos-sectors-fill",
    type: "fill",
    source: "silos-sectors",
    paint: {
      "fill-color": [
        "match",
        ["get", "priority"],
        "critical",
        PRIORITY_COLORS.critical,
        "warning",
        PRIORITY_COLORS.warning,
        PRIORITY_COLORS.monitor,
      ],
      "fill-opacity": 0.08,
    },
  });
  map.addLayer({
    id: "silos-sectors-line",
    type: "line",
    source: "silos-sectors",
    paint: {
      "line-color": [
        "match",
        ["get", "priority"],
        "critical",
        PRIORITY_COLORS.critical,
        "warning",
        PRIORITY_COLORS.warning,
        PRIORITY_COLORS.monitor,
      ],
      "line-width": 1.8,
      "line-opacity": 0.85,
    },
  });
  map.addLayer({
    id: "silos-sectors-selected-fill",
    type: "fill",
    source: "silos-sectors",
    filter: ["==", ["get", "id"], ""],
    paint: {
      "fill-color": "#e61919",
      "fill-opacity": 0.14,
    },
  });
  map.addLayer({
    id: "silos-sectors-selected",
    type: "line",
    source: "silos-sectors",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#ff6b4a", "line-width": 2.8 },
  });

  // 3) Predicted spread — light ground wash under buildings.
  map.addLayer({
    id: "silos-prediction-fill",
    type: "fill",
    source: "silos-prediction",
    paint: {
      "fill-color": [
        "match",
        ["get", "hour_offset"],
        3,
        "#ff6b4a",
        6,
        "#ff8a65",
        "#ffb090",
      ],
      "fill-opacity": ["match", ["get", "hour_offset"], 3, 0.22, 6, 0.16, 0.1],
    },
  });
  map.addLayer({
    id: "silos-prediction-line",
    type: "line",
    source: "silos-prediction",
    paint: {
      "line-color": "#ff7a59",
      "line-width": 1.4,
      "line-dasharray": [2.5, 1.8],
      "line-opacity": 0.7,
    },
  });

  // 4) Active fire — translucent red floor only (under buildings).
  map.addLayer({
    id: "silos-fire-fill",
    type: "fill",
    source: "silos-fire",
    paint: { "fill-color": "#e85a45", "fill-opacity": 0.28 },
  });
  map.addLayer({
    id: "silos-fire-line",
    type: "line",
    source: "silos-fire",
    paint: { "line-color": "#ff6b4a", "line-width": 1.6, "line-opacity": 0.75 },
  });

  // 5) Buildings — flat footprints citywide (cheap); 3D only fire+800m @ z14+.
  map.addLayer({
    id: "silos-buildings-flat",
    type: "fill",
    source: "silos-buildings",
    minzoom: 12,
    paint: {
      "fill-color": BUILDING_NEUTRAL,
      "fill-opacity": 0.85,
    },
  });
  map.addLayer({
    id: "silos-buildings-flat-outline",
    type: "line",
    source: "silos-buildings",
    minzoom: 13,
    paint: {
      "line-color": "#8a8882",
      "line-width": 0.4,
      "line-opacity": 0.35,
    },
  });
  addBuildingExtrusion(map, {
    id: "silos-buildings-3d",
    color: BUILDING_NEUTRAL,
    roof: false,
    source: "silos-buildings-3d-geo",
  });
  addBuildingExtrusion(map, {
    id: "silos-buildings-roof",
    color: BUILDING_NEUTRAL_ROOF,
    roof: true,
    source: "silos-buildings-3d-geo",
  });
  addBuildingExtrusion(map, {
    id: "silos-buildings-pred-3d",
    color: BUILDING_PRED,
    roof: false,
    source: "silos-buildings-pred-geo",
  });
  addBuildingExtrusion(map, {
    id: "silos-buildings-pred-roof",
    color: BUILDING_PRED_ROOF,
    roof: true,
    source: "silos-buildings-pred-geo",
  });
  addBuildingExtrusion(map, {
    id: "silos-buildings-fire-3d",
    color: BUILDING_FIRE,
    roof: false,
    source: "silos-buildings-fire-geo",
  });
  addBuildingExtrusion(map, {
    id: "silos-buildings-fire-roof",
    color: BUILDING_FIRE_ROOF,
    roof: true,
    source: "silos-buildings-fire-geo",
  });

  // 6) Access roads + facility pin icons (above buildings).
  map.addLayer({
    id: "silos-access-roads-casing",
    type: "line",
    source: "silos-access",
    layout: { visibility: "none" },
    paint: { "line-color": "#0a0a0a", "line-width": 5, "line-opacity": 0.7 },
  });
  map.addLayer({
    id: "silos-access-roads",
    type: "line",
    source: "silos-access",
    layout: { visibility: "none" },
    paint: {
      "line-color": "#fece09",
      "line-width": 2.5,
      "line-dasharray": [2, 1.5],
    },
  });
  map.addLayer({
    id: "silos-access-highlight",
    type: "line",
    source: "silos-access",
    layout: { visibility: "none" },
    filter: ["==", ["get", "name"], ""],
    paint: {
      "line-color": "#61d5f8",
      "line-width": 5,
      "line-opacity": 1,
    },
  });
  if (!map.hasImage("silos-facility-pin")) {
    map.addImage("silos-facility-pin", createFacilityPinImage(), { sdf: true });
  }
  map.addLayer({
    id: "silos-facilities",
    type: "symbol",
    source: "silos-facilities-src",
    layout: {
      visibility: "none",
      "icon-image": "silos-facility-pin",
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.35, 15, 0.55],
    },
    paint: {
      "icon-color": [
        "match",
        ["get", "ftype"],
        "nursing_home",
        FACILITY_COLORS.nursing_home,
        "disability_facility",
        FACILITY_COLORS.disability_facility,
        "school",
        FACILITY_COLORS.school,
        "senior_center",
        FACILITY_COLORS.senior_center,
        "shelter",
        FACILITY_COLORS.shelter,
        "#94a3b8",
      ],
      "icon-halo-color": "#ffffff",
      "icon-halo-width": 1.25,
      "icon-halo-blur": 0.4,
    },
  });
}

function wireInteractions(map: MlMap, onSelectSector: (id: string) => void): void {
  map.on("click", "silos-sectors-fill", (event) => {
    const id = event.features?.[0]?.properties?.id as string | undefined;
    if (id) {
      onSelectSector(id);
    }
  });
  map.on("click", "silos-population-fill", (event) => {
    const properties = event.features?.[0]?.properties as
      | { tract?: string; dominant?: string; class?: string }
      | undefined;
    if (!properties) {
      return;
    }
    new Popup({ offset: 8, closeButton: false })
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>${properties.tract ?? ""}</strong><br/><span style="color:#b9bdb7">${properties.dominant ?? ""}</span>`,
      )
      .addTo(map);
  });
  map.on("click", "silos-facilities", (event) => {
    const properties = event.features?.[0]?.properties as
      | { name?: string; ftype?: string }
      | undefined;
    if (!properties) {
      return;
    }
    new Popup({ offset: 10, closeButton: false })
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>${properties.name ?? ""}</strong><br/><span style="color:#7d8388">${(properties.ftype ?? "").replaceAll("_", " ").toUpperCase()}</span>`,
      )
      .addTo(map);
  });
  for (const layerId of ["silos-sectors-fill", "silos-facilities", "silos-population-fill"]) {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}
