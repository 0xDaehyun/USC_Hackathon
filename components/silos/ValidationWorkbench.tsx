"use client";

import Link from "next/link";
import {
  GeoJSONSource,
  Map as MlMap,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { ensureMaplibreWorker } from "@/lib/silos/maplibre";
import type {
  AftObservedValidation,
  ValidationHorizon,
} from "@/lib/silos/model/validation";

const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: ["a", "b", "c", "d"].map(
        (subdomain) =>
          `https://${subdomain}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png`,
      ),
      tileSize: 256,
      attribution:
        "© OpenStreetMap contributors, © CARTO",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#08090a" },
    },
    {
      id: "carto-dark",
      type: "raster",
      source: "carto-dark",
      paint: { "raster-opacity": 0.7 },
    },
  ],
};

const LAYERS = {
  observed: {
    label: "Observed progression",
    color: "#f2f1ed",
    dash: [2, 2],
  },
  teacher: {
    label: "ELMFIRE Teacher",
    color: "#fece09",
    dash: [5, 2],
  },
  student: {
    label: "XGBoost AFT Student",
    color: "#e61919",
    dash: [1, 0],
  },
} as const;

type LayerKey = keyof typeof LAYERS;

declare global {
  interface Window {
    __validationMap?: MlMap;
  }
}

export function ValidationWorkbench({
  validation,
}: {
  validation: AftObservedValidation;
}) {
  const [hour, setHour] = useState<1 | 3 | 6>(6);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({
    observed: true,
    teacher: true,
    student: true,
  });
  const selected =
    validation.horizons.find((item) => item.hour_offset === hour) ??
    validation.horizons[validation.horizons.length - 1];

  return (
    <div className="silos flex h-dvh flex-col overflow-hidden">
      <header className="flex items-center gap-4 border-b-4 border-[var(--s-type-1)] px-4 py-3">
        <Link href="/map" className="flex items-baseline gap-2">
          <span className="s-display text-2xl">SILOS</span>
          <span className="s-mono text-[9px] tracking-[0.12em] text-[var(--s-hazard)] uppercase">
            Model lab
          </span>
        </Link>
        <div className="hidden h-5 border-l border-[var(--s-ink-3)] md:block" />
        <div className="hidden md:block">
          <p className="s-label">Historical validation case</p>
          <p className="s-mono text-[11px] font-semibold tracking-[0.08em] uppercase">
            2025 Eaton Fire · observed vs Teacher vs Student
          </p>
        </div>
        <Link
          href="/map"
          className="s-mono ml-auto border border-[var(--s-type-2)] px-3 py-1.5 text-[10px] tracking-[0.1em] uppercase hover:bg-[var(--s-type-1)] hover:text-[var(--s-ink-0)]"
        >
          ← Operations map
        </Link>
      </header>

      <main className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="relative min-h-[46vh] border-b border-[var(--s-ink-3)] md:min-h-0 md:border-r md:border-b-0">
          <ValidationMap
            horizon={selected}
            visible={visible}
          />

          <div className="s-panel absolute top-3 left-3 z-10 w-[min(18rem,calc(100%-1.5rem))] p-3">
            <p className="s-label s-label--bracket mb-2">
              Comparison layers
            </p>
            {(Object.keys(LAYERS) as LayerKey[]).map((key) => (
              <label
                key={key}
                className="s-mono flex cursor-pointer items-center gap-2 border-t border-[var(--s-ink-3)] py-2 text-[10px] tracking-[0.08em] uppercase"
              >
                <input
                  type="checkbox"
                  checked={visible[key]}
                  onChange={(event) =>
                    setVisible((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                  className="accent-red-600"
                />
                <span
                  className="inline-block h-2.5 w-5 border"
                  style={{
                    borderColor: LAYERS[key].color,
                    backgroundColor: `${LAYERS[key].color}33`,
                  }}
                />
                {LAYERS[key].label}
              </label>
            ))}
          </div>

          <div className="s-panel absolute bottom-3 left-1/2 z-10 -translate-x-1/2 px-3 py-2 text-center">
            <p className="s-mono text-[10px] font-semibold tracking-[0.1em] text-[var(--s-signal)] uppercase">
              Historical validation · not an operational forecast
            </p>
            <p className="s-mono mt-1 text-[9px] tracking-[0.06em] text-[var(--s-type-3)] uppercase">
              Metrics use unsimplified 30m masks · map shapes simplified 15m
            </p>
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto bg-[var(--s-ink-0)]">
          <div className="border-b border-[var(--s-ink-3)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="s-label">Playback horizon</p>
                <h1 className="s-display mt-1 text-3xl">T+{hour} HOURS</h1>
              </div>
              <span
                className={`s-tag ${
                  selected.role === "holdout"
                    ? "s-tag--active"
                    : selected.role === "calibration"
                      ? "s-tag--warning"
                      : "s-tag--monitor"
                }`}
              >
                {selected.role.replaceAll("-", " ")}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1">
              {([1, 3, 6] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHour(value)}
                  className={`s-mono border px-2 py-2 text-[11px] font-semibold tracking-[0.08em] uppercase ${
                    hour === value
                      ? "border-[var(--s-hazard)] bg-[var(--s-hazard)] text-white"
                      : "border-[var(--s-ink-3)] text-[var(--s-type-2)] hover:border-[var(--s-type-1)]"
                  }`}
                >
                  T+{value}
                </button>
              ))}
            </div>
          </div>

          {selected.comparisons ? (
            <ValidationMetrics
              horizon={selected}
              arrivalMae={
                validation.arrival_time.student_vs_observed
                  .jointly_reached_mean_absolute_error_hours
              }
            />
          ) : (
            <div className="p-4">
              <p className="s-label s-label--bracket">Initialization</p>
              <p className="s-body mt-3">
                T+1 관측 화재면은 Teacher와 Student를 시작시키는 입력입니다.
                따라서 이 시점은 성능 점수로 사용하지 않습니다.
              </p>
            </div>
          )}

          <div className="border-t border-[var(--s-ink-3)] p-4">
            <p className="s-label s-label--bracket">What this proves</p>
            <p className="s-body-sm mt-3">
              이 화면은 Eaton 한 사건의 시간 홀드아웃 검증입니다. ML은 실제
              화재를 직접 학습한 모델이 아니라 ELMFIRE를 빠르게 근사한
              Student 모델입니다.
            </p>
            <ul className="s-body-sm mt-3 space-y-2">
              <li>· T+3는 Teacher 연료수분 조건 선택에 사용</li>
              <li>· T+6만 선택에 사용하지 않은 시간 홀드아웃</li>
              <li>· 동일 관측 자료에서 초기화와 평가를 수행</li>
              <li>· 결과 등급: Share with caveats</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

function ValidationMetrics({
  horizon,
  arrivalMae,
}: {
  horizon: ValidationHorizon;
  arrivalMae: number;
}) {
  const comparisons = horizon.comparisons;
  if (!comparisons) {
    return null;
  }
  const student = comparisons.student_vs_observed.footprint_30m;
  const teacher = comparisons.teacher_vs_observed.footprint_30m;
  const nativeStudent =
    comparisons.student_vs_observed.native_grid_240m;
  const nativeTeacher =
    comparisons.teacher_vs_observed.native_grid_240m;

  return (
    <>
      <div className="grid grid-cols-2 gap-px bg-[var(--s-ink-3)]">
        <MetricCard
          label="Footprint IoU"
          value={percent(student.intersection_over_union)}
          detail="30m common evaluation grid"
          accent="var(--s-hazard)"
        />
        <MetricCard
          label="Native-grid IoU"
          value={percent(nativeStudent.intersection_over_union)}
          detail="Student's 240m task"
        />
        <MetricCard
          label="Precision"
          value={percent(student.precision)}
          detail="Predicted area that burned"
        />
        <MetricCard
          label="Recall"
          value={percent(student.recall)}
          detail="Actual area captured"
        />
        <MetricCard
          label="F1"
          value={percent(student.f1_score)}
          detail="Precision/recall balance"
        />
        <MetricCard
          label="Arrival MAE"
          value={`${arrivalMae.toFixed(2)}h`}
          detail="Jointly reached by T+6"
        />
      </div>

      <div className="border-t border-[var(--s-ink-3)] p-4">
        <p className="s-label s-label--bracket">
          Area difference at T+{horizon.hour_offset}
        </p>
        <div className="mt-3 space-y-2">
          <AreaRow
            label="Observed"
            value={student.truth_area_acres}
            color={LAYERS.observed.color}
          />
          <AreaRow
            label="ML Student"
            value={student.prediction_area_acres}
            color={LAYERS.student.color}
          />
          <AreaRow
            label="ELMFIRE Teacher"
            value={teacher.prediction_area_acres}
            color={LAYERS.teacher.color}
          />
        </div>
        <p className="s-body-sm mt-3 border-t border-[var(--s-ink-3)] pt-3">
          ML 면적 오차:{" "}
          <b
            className={
              (student.area_bias_acres ?? 0) < 0
                ? "text-[var(--s-signal)]"
                : "text-[var(--s-hazard)]"
            }
          >
            {signed(student.area_bias_acres ?? 0)} acres
          </b>
        </p>
      </div>

      <div className="border-t border-[var(--s-ink-3)] p-4">
        <p className="s-label s-label--bracket">Teacher comparison</p>
        <div className="mt-3 grid grid-cols-2 gap-px bg-[var(--s-ink-3)]">
          <SmallMetric
            label="ML footprint"
            value={percent(student.intersection_over_union)}
          />
          <SmallMetric
            label="Teacher footprint"
            value={percent(teacher.intersection_over_union)}
          />
          <SmallMetric
            label="ML native 240m"
            value={percent(nativeStudent.intersection_over_union)}
          />
          <SmallMetric
            label="Teacher native 240m"
            value={percent(nativeTeacher.intersection_over_union)}
          />
        </div>
        <p className="s-body-sm mt-3">
          30m 화면 IoU 차이가 크게 보이는 이유에는 Student의 240m 블록을
          펼치는 효과가 포함됩니다. Native grid 차이는{" "}
          <b>
            {signedPercent(
              nativeStudent.intersection_over_union -
                nativeTeacher.intersection_over_union,
            )}
          </b>
          이므로, ML이 실제 화재 물리를 새로 학습해 Teacher를 크게 개선했다고
          해석하면 안 됩니다.
        </p>
      </div>
    </>
  );
}

function ValidationMap({
  horizon,
  visible,
}: {
  horizon: ValidationHorizon;
  visible: Record<LayerKey, boolean>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const initialHorizon = useRef(horizon);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    ensureMaplibreWorker();
    const map = new MlMap({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [-118.098, 34.184],
      zoom: 12.8,
      pitch: 26,
      bearing: -12,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    window.__validationMap = map;
    map.addControl(new NavigationControl(), "top-right");
    map.on("load", () => {
      const first = initialHorizon.current;
      for (const key of Object.keys(LAYERS) as LayerKey[]) {
        map.addSource(`validation-${key}`, {
          type: "geojson",
          data: first[key],
        });
        map.addLayer({
          id: `validation-${key}-fill`,
          type: "fill",
          source: `validation-${key}`,
          paint: {
            "fill-color": LAYERS[key].color,
            "fill-opacity":
              key === "observed" ? 0.08 : key === "teacher" ? 0.13 : 0.24,
          },
        });
        map.addLayer({
          id: `validation-${key}-line`,
          type: "line",
          source: `validation-${key}`,
          paint: {
            "line-color": LAYERS[key].color,
            "line-width": key === "student" ? 2.8 : 2,
            "line-opacity": 0.95,
            "line-dasharray": [...LAYERS[key].dash],
          },
        });
      }
      setReady(true);
    });
    return () => {
      mapRef.current = null;
      delete window.__validationMap;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    for (const key of Object.keys(LAYERS) as LayerKey[]) {
      (
        map.getSource(`validation-${key}`) as GeoJSONSource | undefined
      )?.setData(horizon[key]);
    }
  }, [horizon, ready]);

  const visibilityKey = useMemo(
    () => JSON.stringify(visible),
    [visible],
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    for (const key of Object.keys(LAYERS) as LayerKey[]) {
      const value = visible[key] ? "visible" : "none";
      map.setLayoutProperty(
        `validation-${key}-fill`,
        "visibility",
        value,
      );
      map.setLayoutProperty(
        `validation-${key}-line`,
        "visibility",
        value,
      );
    }
  }, [ready, visible, visibilityKey]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
    />
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: string;
}) {
  return (
    <div className="bg-[var(--s-ink-1)] p-3">
      <p className="s-label">{label}</p>
      <p
        className="s-display mt-2 text-2xl"
        style={{ color: accent ?? "var(--s-type-1)" }}
      >
        {value}
      </p>
      <p className="s-body-sm mt-1 text-[11px]">{detail}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--s-ink-1)] p-2 text-center">
      <p className="s-label text-[9px]">{label}</p>
      <p className="s-mono mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AreaRow({
  label,
  value,
  color,
}: {
  label: string;
  value?: number;
  color: string;
}) {
  return (
    <div className="s-mono flex items-center justify-between text-[11px] uppercase">
      <span className="flex items-center gap-2 text-[var(--s-type-2)]">
        <span className="size-2" style={{ backgroundColor: color }} />
        {label}
      </span>
      <b>{value?.toFixed(1) ?? "—"} acres</b>
    </div>
  );
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}pp`;
}
