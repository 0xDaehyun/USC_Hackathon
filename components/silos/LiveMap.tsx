"use client";

import type { FeatureCollection } from "geojson";
import {
  GeoJSONSource,
  Map as MlMap,
  NavigationControl,
  Popup,
  type StyleSpecification,
} from "maplibre-gl";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { useEffect, useRef, useState } from "react";
import {
  buildings3dClip,
  buildingsForExtrusion,
  loadBuildingsGeoJSON,
} from "@/lib/silos/buildings";
import {
  ACCESS_ROADS,
  DUMMY_BUILDINGS,
  FACILITIES,
  POPULATION_VULNERABILITY,
  SECTOR_POLYGONS,
  accessRoadCenter,
  sectorCenter,
} from "@/lib/silos/mock/geo";
import {
  EATON_AFT_PREDICTION,
  EATON_INITIALIZATION_BOUNDARY,
} from "@/lib/silos/model/prediction";
import { ensureMaplibreWorker } from "@/lib/silos/maplibre";
import type { Fire, FirePrediction, Sector } from "@/lib/silos/types";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };
/** 3D only near the fire — full AOI stays as flat real footprints. */
const FIRE_3D_BUFFER_M = 900;

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

/** Vulnerability class → choropleth color (high chroma for dark basemap). */
const VULN_COLORS: Record<string, string> = {
  elderly: "#ff4da6",
  no_vehicle: "#c44dff",
  language: "#3dd9ff",
  egress: "#ffe14a",
  mixed: "#ff8a2b",
};

/** MapLibre match expression: feature `class` → vuln color. */
const VULN_COLOR_MATCH: ExpressionSpecification = [
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
  "#c44dff",
];

const BUILDING_NEUTRAL = "#c8c6c0";
const BUILDING_FIRE = "#e61919";
const BUILDING_PRED = "#ff8a65";

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
  population: [
    "silos-population-fill",
    "silos-population-line",
    "silos-population-selected-fill",
    "silos-population-selected",
  ],
  facilities: ["silos-facilities"],
  access: ["silos-access-roads", "silos-access-roads-casing", "silos-access-highlight"],
  buildings: ["silos-buildings-flat", "silos-buildings-flat-line", "silos-buildings-3d"],
};

const FACILITY_PIN_URL = "/icons/facility-pin.png";

function seedFire(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [EATON_INITIALIZATION_BOUNDARY],
  };
}

function seedPrediction(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: EATON_AFT_PREDICTION.hourly_steps.map((step) => ({
      ...step.spread_polygon_geojson,
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
        priority: "monitor",
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
  focusRoadName?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const buildingsRef = useRef<FeatureCollection | null>(null);
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
  const [selectedTract, setSelectedTract] = useState<string | null>(null);
  const onSelectSectorRef = useRef(onSelectSector);
  useEffect(() => {
    onSelectSectorRef.current = onSelectSector;
  }, [onSelectSector]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    ensureMaplibreWorker();
    let cancelled = false;

    const map = new MlMap({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [-118.118, 34.188],
      zoom: 12.8,
      pitch: 48,
      bearing: -18,
      maxPitch: 60,
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
        /* Strict Mode teardown */
      }
    };
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
    observer?.observe(containerRef.current);
    window.addEventListener("resize", resize);

    const onLoad = () => {
      try {
        // Paint fire / prediction / sectors FIRST. Never block the core demo
        // layers on the 34MB buildings fetch or the facility pin image.
        setupLayers(map, EMPTY_FC);
        wireInteractions(
          map,
          (id) => onSelectSectorRef.current(id),
          (tract) => setSelectedTract(tract),
        );
        for (const layerId of [
          "silos-fire-fill",
          "silos-fire-line",
          "silos-prediction-fill",
          "silos-prediction-line",
          "silos-sectors-fill",
          "silos-sectors-line",
        ]) {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", "visible");
          }
        }
        resize();
        setReady(true);
      } catch (error) {
        console.error("SILOS map layer setup failed:", error);
        setReady(true);
        return;
      }

      void (async () => {
        try {
          if (!map.hasImage("silos-facility-pin")) {
            try {
              const pin = await map.loadImage(FACILITY_PIN_URL);
              if (!cancelled && !map.hasImage("silos-facility-pin")) {
                map.addImage("silos-facility-pin", pin.data);
              }
            } catch (pinError) {
              console.warn("Facility pin image failed (non-fatal):", pinError);
            }
          }
          let buildings: FeatureCollection;
          try {
            buildings = await loadBuildingsGeoJSON();
          } catch (buildingsError) {
            console.warn(
              "LARIAC buildings GeoJSON failed — falling back to demo blocks:",
              buildingsError,
            );
            buildings = DUMMY_BUILDINGS;
          }
          if (cancelled || !map.getSource("silos-buildings")) {
            return;
          }
          buildingsRef.current = buildings;
          setSourceData(map, "silos-buildings", buildings);
          const seedPred =
            EATON_AFT_PREDICTION.hourly_steps.at(-1)
              ?.spread_polygon_geojson ?? null;
          setSourceData(
            map,
            "silos-buildings-3d",
            buildingsForExtrusion(
              buildings,
              buildings3dClip(
                EATON_INITIALIZATION_BOUNDARY,
                seedPred,
                FIRE_3D_BUFFER_M,
              ),
              {
                firePoly: EATON_INITIALIZATION_BOUNDARY,
                predPoly: seedPred,
                fireOn: true,
                predictionOn: true,
              },
            ),
          );
        } catch (error) {
          console.error("SILOS buildings enrichment failed:", error);
        }
      })();
    };

    if (map.loaded()) {
      onLoad();
    } else {
      map.on("load", onLoad);
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

  useEffect(() => {
    const map = mapRef.current;
    const buildings = buildingsRef.current;
    if (!map || !ready || !buildings) {
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

    const firePoly =
      fire?.boundary_geojson ?? EATON_INITIALIZATION_BOUNDARY;
    const predPoly =
      prediction?.hourly_steps?.[prediction.hourly_steps.length - 1]
        ?.spread_polygon_geojson ??
      EATON_AFT_PREDICTION.hourly_steps[
        EATON_AFT_PREDICTION.hourly_steps.length - 1
      ]?.spread_polygon_geojson ??
      null;
    setSourceData(
      map,
      "silos-buildings-3d",
      buildingsForExtrusion(
        buildings,
        buildings3dClip(firePoly, predPoly, FIRE_3D_BUFFER_M),
        {
          firePoly,
          predPoly,
          fireOn: toggles.fire,
          predictionOn: toggles.prediction,
        },
      ),
    );
    map.resize();
  }, [fire, prediction, sectors, ready, toggles.fire, toggles.prediction]);

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
        zoom: 14.8,
        pitch: 50,
        bearing: -25,
        duration: 1800,
      });
    }
  }, [selectedSectorId, ready, focusRoadName]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    const filter: ["==", ["get", "tract"], string] = [
      "==",
      ["get", "tract"],
      selectedTract ?? "",
    ];
    if (map.getLayer("silos-population-selected")) {
      map.setFilter("silos-population-selected", filter);
    }
    if (map.getLayer("silos-population-selected-fill")) {
      map.setFilter("silos-population-selected-fill", filter);
    }
  }, [selectedTract, ready]);

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
        zoom: 15.2,
        pitch: 50,
        bearing: -18,
        duration: 1600,
      });
    }
  }, [focusRoadName, ready]);

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
        if (layerId === "silos-access-highlight" && !focusRoadName) {
          map.setLayoutProperty(layerId, "visibility", "none");
          continue;
        }
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    }
  }, [toggles, ready, focusRoadName]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={containerRef} className="silos-map-canvas absolute inset-0 bg-black" />

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
          <ToggleRow
            label="Active fire"
            value={toggles.fire}
            onChange={(v) => setToggles((t) => ({ ...t, fire: v }))}
          />
          <ToggleRow
            label="Spread prediction"
            value={toggles.prediction}
            onChange={(v) => setToggles((t) => ({ ...t, prediction: v }))}
          />
          <ToggleRow
            label="Population vuln."
            value={toggles.population}
            onChange={(v) => {
              setToggles((t) => ({ ...t, population: v }));
              if (!v) {
                setSelectedTract(null);
              }
            }}
          />
          <ToggleRow
            label="Facilities"
            value={toggles.facilities}
            onChange={(v) => setToggles((t) => ({ ...t, facilities: v }))}
          />
          <ToggleRow
            label="Road access"
            value={toggles.access}
            onChange={(v) => setToggles((t) => ({ ...t, access: v }))}
          />
          <ToggleRow
            label="3D buildings"
            value={toggles.buildings}
            onChange={(v) => setToggles((t) => ({ ...t, buildings: v }))}
          />
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
            <p className="s-label mb-1">Historical model overlay</p>
            <LegendRow color="#e85a45" label="Observed-derived T+1" />
            <LegendRow color="#ff6b4a" label="Model T+3" />
            <LegendRow color="#ffb090" label="Model T+6" />
            <LegendRow color="#c8c6c0" label="Buildings (LARIAC 2023)" />
          </div>
        </div>
      </div>

      <div className="s-panel absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 px-3 py-2 text-center md:block">
        <p className="s-mono text-[10px] font-semibold tracking-[0.1em] text-[var(--s-hazard)] uppercase">
          Historical reconstruction · What-if
        </p>
        <p className="s-mono mt-0.5 text-[9px] tracking-[0.06em] text-[var(--s-type-2)] uppercase">
          ELMFIRE → XGBoost AFT pilot · T+1 observed-derived · T+3/T+6 model
        </p>
      </div>

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
              . Building footprints: LA County LARIAC 2023 clip (
              <code className="s-mono">/gis/buildings.geojson</code>
              ). Flat citywide; 3D extrusion near the fire only. Fire /
              prediction polygons are an Eaton historical reconstruction and
              XGBoost AFT pilot result, not an official forecast.
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
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-[var(--s-type-1)]">
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[var(--s-hazard)]"
      />
      <span className="s-mono uppercase tracking-[0.06em]">{label}</span>
    </label>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <p className="flex items-center gap-2 text-[11px] text-[var(--s-type-2)]">
      <span className="size-2.5 shrink-0" style={{ backgroundColor: color }} />
      {label}
    </p>
  );
}

function setSourceData(map: MlMap, sourceId: string, data: FeatureCollection): void {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (source && typeof source.setData === "function") {
    source.setData(data);
  }
}

function setupLayers(map: MlMap, buildings: FeatureCollection): void {
  map.addSource("silos-sectors", { type: "geojson", data: seedSectors([]) });
  map.addSource("silos-prediction", { type: "geojson", data: seedPrediction() });
  map.addSource("silos-fire", { type: "geojson", data: seedFire() });
  map.addSource("silos-population", {
    type: "geojson",
    data: POPULATION_VULNERABILITY,
  });
  map.addSource("silos-access", { type: "geojson", data: ACCESS_ROADS });
  map.addSource("silos-facilities-src", { type: "geojson", data: FACILITIES });
  // Full LARIAC clip as flat footprints (real shapes, cheap).
  map.addSource("silos-buildings", { type: "geojson", data: buildings });
  // 3D extrusion subset near fire — filled after load.
  map.addSource("silos-buildings-3d", { type: "geojson", data: EMPTY_FC });

  map.addLayer({
    id: "silos-population-fill",
    type: "fill",
    source: "silos-population",
    layout: { visibility: "none" },
    paint: {
      "fill-color": VULN_COLOR_MATCH,
      "fill-opacity": 0.42,
    },
  });
  map.addLayer({
    id: "silos-population-line",
    type: "line",
    source: "silos-population",
    layout: { visibility: "none" },
    paint: {
      "line-color": VULN_COLOR_MATCH,
      "line-width": 1.6,
      "line-dasharray": [2.4, 1.6],
      "line-opacity": 0.85,
    },
  });
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
    paint: { "fill-color": "#e61919", "fill-opacity": 0.14 },
  });
  map.addLayer({
    id: "silos-sectors-selected",
    type: "line",
    source: "silos-sectors",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#ff6b4a", "line-width": 2.8 },
  });
  // Selected pop-vul on top of sector outlines so the dashed stroke stays readable.
  map.addLayer({
    id: "silos-population-selected-fill",
    type: "fill",
    source: "silos-population",
    layout: { visibility: "none" },
    filter: ["==", ["get", "tract"], ""],
    paint: {
      "fill-color": VULN_COLOR_MATCH,
      "fill-opacity": 0.62,
    },
  });
  map.addLayer({
    id: "silos-population-selected",
    type: "line",
    source: "silos-population",
    layout: { visibility: "none" },
    filter: ["==", ["get", "tract"], ""],
    paint: {
      "line-color": VULN_COLOR_MATCH,
      "line-width": 3,
      "line-dasharray": [2.8, 1.4],
      "line-opacity": 1,
    },
  });

  map.addLayer({
    id: "silos-prediction-fill",
    type: "fill",
    source: "silos-prediction",
    paint: {
      "fill-color": [
        "match",
        ["get", "hour_offset"],
        1,
        "#e85a45",
        3,
        "#ff6b4a",
        6,
        "#ff8a65",
        "#ffb090",
      ],
      "fill-opacity": [
        "match",
        ["get", "hour_offset"],
        1,
        0.28,
        3,
        0.22,
        6,
        0.14,
        0.1,
      ],
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

  // Real LARIAC footprints citywide (flat) + extruded near the fire only.
  map.addLayer({
    id: "silos-buildings-flat",
    type: "fill",
    source: "silos-buildings",
    minzoom: 11,
    paint: {
      "fill-color": BUILDING_NEUTRAL,
      "fill-opacity": 0.9,
    },
  });
  map.addLayer({
    id: "silos-buildings-flat-line",
    type: "line",
    source: "silos-buildings",
    minzoom: 13,
    paint: {
      "line-color": "#8a8882",
      "line-width": 0.35,
      "line-opacity": 0.4,
    },
  });
  map.addLayer({
    id: "silos-buildings-3d",
    type: "fill-extrusion",
    source: "silos-buildings-3d",
    minzoom: 12,
    paint: {
      "fill-extrusion-color": [
        "match",
        ["get", "tint"],
        "fire",
        BUILDING_FIRE,
        "pred",
        BUILDING_PRED,
        BUILDING_NEUTRAL,
      ],
      "fill-extrusion-height": ["to-number", ["get", "height"]],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 1,
      "fill-extrusion-vertical-gradient": true,
    },
  });

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
      // Source art is 160² — keep pins compact on the map.
      "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.22, 15, 0.34],
    },
  });
}

function wireInteractions(
  map: MlMap,
  onSelectSector: (id: string) => void,
  onSelectTract: (tract: string) => void,
): void {
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
    if (properties.tract) {
      onSelectTract(properties.tract);
    }
    new Popup({ offset: 8, closeButton: false })
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>${properties.tract ?? ""}</strong><br/><span style="color:#7d8388">${properties.dominant ?? ""}</span>`,
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
  for (const layerId of [
    "silos-sectors-fill",
    "silos-facilities",
    "silos-population-fill",
  ]) {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}
