"use client";

import type {
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from "geojson";
import {
  LngLatBounds,
  Map,
  NavigationControl,
  Popup,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

const EATON_ZONES_URL = new URL(
  "https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Maximum_Extent_Evacuation_Zones/FeatureServer/0/query",
);

EATON_ZONES_URL.search = new URLSearchParams({
  where: "incident_name='EATON'",
  outFields: "zoneId,most_extreme_status,incident_name",
  returnGeometry: "true",
  outSR: "4326",
  f: "geojson",
}).toString();

type EatonZoneProperties = {
  zoneId?: string;
  most_extreme_status?: string;
  incident_name?: string;
};

export function EvacuationMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoneCount, setZoneCount] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          openStreetMap: {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
              "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
          },
        },
        layers: [
          {
            id: "open-street-map",
            type: "raster",
            source: "openStreetMap",
          },
        ],
      },
      center: [-118.105, 34.205],
      zoom: 10.2,
      attributionControl: {},
    });

    map.addControl(new NavigationControl(), "top-right");

    map.on("load", async () => {
      try {
        const response = await fetch(EATON_ZONES_URL);

        if (!response.ok) {
          throw new Error(`ArcGIS request failed with ${response.status}.`);
        }

        const zones = (await response.json()) as FeatureCollection<
          Polygon | MultiPolygon,
          EatonZoneProperties
        >;

        if (zones.features.length === 0) {
          throw new Error("The ArcGIS response did not contain Eaton zones.");
        }

        map.addSource("eaton-zones", {
          type: "geojson",
          data: zones,
        });

        map.addLayer({
          id: "eaton-zones-fill",
          type: "fill",
          source: "eaton-zones",
          paint: {
            "fill-color": [
              "match",
              ["get", "most_extreme_status"],
              "Evacuation Order",
              "#df3e2f",
              "Evacuation Warning",
              "#f2a900",
              "#74817d",
            ],
            "fill-opacity": 0.62,
          },
        });

        map.addLayer({
          id: "eaton-zones-outline",
          type: "line",
          source: "eaton-zones",
          paint: {
            "line-color": "#7c2d12",
            "line-opacity": 0.9,
            "line-width": 1.5,
          },
        });

        const bounds = new LngLatBounds();

        for (const feature of zones.features) {
          extendBounds(bounds, feature.geometry.coordinates);
        }

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding: 36,
            maxZoom: 11.5,
            duration: 0,
          });
        }

        map.on("mouseenter", "eaton-zones-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "eaton-zones-fill", () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", "eaton-zones-fill", (event) => {
          const properties = event.features?.[0]
            ?.properties as EatonZoneProperties;
          const popupContent = document.createElement("div");
          const title = document.createElement("strong");
          const detail = document.createElement("p");

          title.textContent = properties.zoneId ?? "Unknown zone";
          detail.textContent =
            properties.most_extreme_status ?? "Status unavailable";
          detail.className = "mt-1 text-sm text-slate-600";
          popupContent.append(title, detail);

          new Popup({ offset: 12 })
            .setLngLat(event.lngLat)
            .setDOMContent(popupContent)
            .addTo(map);
        });

        setZoneCount(zones.features.length);
        setLoadState("ready");
      } catch (error) {
        console.error(error);
        setLoadState("error");
      }
    });

    map.on("error", (event) => {
      console.error(event.error);
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <section
      aria-labelledby="map-title"
      className="self-start overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_24px_70px_rgba(51,42,33,0.08)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-orange-700 uppercase">
            Official geometry
          </p>
          <h2 id="map-title" className="mt-1 text-lg font-semibold text-slate-950">
            Eaton Fire 최대 대피 범위
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            2025년 1월 23일 기준, 한 번이라도 Warning 또는 Order였던
            구역입니다. 특정 시점의 실제 상태로 해석하면 안 됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-700">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#d4513c]" />
            최고 상태 Order
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#f2b84b]" />
            최고 상태 Warning
          </span>
        </div>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="h-[32rem] w-full bg-stone-100"
          aria-label="Eaton Fire evacuation zone map"
        />
        <div
          aria-live="polite"
          className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur"
        >
          {loadState === "loading" && "공식 구역 불러오는 중"}
          {loadState === "ready" &&
            `LA County 공식 구역 ${zoneCount ?? 0}개 연결됨`}
          {loadState === "error" && "공식 구역을 불러오지 못했습니다"}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-slate-500 sm:px-6">
        <span>Historical Reconstruction · 현재 대피 명령 아님</span>
        <a
          className="font-semibold text-slate-700 underline decoration-stone-300 underline-offset-4 hover:text-orange-700"
          href="https://www.arcgis.com/home/item.html?id=182e6350c18440e3a52e4de5f9d7fad2"
          target="_blank"
          rel="noreferrer"
        >
          LA County 원본 보기
        </a>
      </div>
    </section>
  );
}

function extendBounds(bounds: LngLatBounds, coordinates: unknown): void {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    bounds.extend([coordinates[0], coordinates[1]]);
    return;
  }

  for (const nestedCoordinates of coordinates) {
    extendBounds(bounds, nestedCoordinates);
  }
}
