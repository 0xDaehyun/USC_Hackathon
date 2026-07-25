"use client";

import { useEffect, useRef, useState } from "react";
import { getOrgs, getSectors } from "@/lib/silos/api";
import { usePolling } from "@/lib/silos/usePolling";

/**
 * KPI strip under the nav — pew-pew style ticking counters. Values are
 * derived from the polled sector/org state (never fabricated); the ticking
 * animation runs when a value changes.
 */
export function KpiStrip() {
  const { data: sectors } = usePolling(getSectors, 15_000);
  const { data: orgs } = usePolling(getOrgs, 30_000);

  const householdsAtRisk = (sectors ?? [])
    .filter((sector) => sector.eta_hours !== null)
    .reduce((sum, sector) => sum + sector.predicted_household_count, 0);
  const critical = (sectors ?? []).filter((s) => s.priority === "critical").length;
  const unassignedCritical = (sectors ?? []).filter(
    (s) => s.priority === "critical" && s.coverage_status === "unassigned",
  ).length;
  const covered = (sectors ?? []).filter((s) => s.coverage_status !== "unassigned").length;
  const certified = (orgs ?? []).filter((org) =>
    org.certifications.some((cert) => cert.includes("ash & debris")),
  ).length;

  return (
    <div className="grid grid-cols-2 border-b border-[var(--s-ink-3)] bg-[var(--s-ink-0)] md:grid-cols-5">
      <div className="s-kpi border-l-0">
        <div className="s-label s-label--bracket">Households in spread path</div>
        <div className="s-kpi__value mt-1 text-[var(--s-type-1)]">
          <Ticker value={householdsAtRisk} />
        </div>
      </div>
      <div className="s-kpi">
        <div className="s-label s-label--bracket">Critical sectors</div>
        <div className="s-kpi__value mt-1 text-[var(--s-hazard)]">
          <Ticker value={critical} />
          <span className="s-mono ml-1 text-[11px] tracking-[0.1em] text-[var(--s-type-3)]">
            / {sectors?.length ?? 0}
          </span>
        </div>
      </div>
      <div className="s-kpi">
        <div className="s-label s-label--bracket">Critical · no coverage</div>
        <div
          className={`s-kpi__value mt-1 ${unassignedCritical > 0 ? "text-[var(--s-hazard)]" : "text-[var(--s-active)]"}`}
        >
          <Ticker value={unassignedCritical} />
        </div>
      </div>
      <div className="s-kpi">
        <div className="s-label s-label--bracket">Sectors covered</div>
        <div className="s-kpi__value mt-1 text-[var(--s-claim)]">
          <Ticker value={covered} />
          <span className="s-mono ml-1 text-[11px] tracking-[0.1em] text-[var(--s-type-3)]">
            / {sectors?.length ?? 0}
          </span>
        </div>
      </div>
      <div className="s-kpi">
        <div className="s-label s-label--bracket">Debris-search certified</div>
        <div className="s-kpi__value mt-1 text-[var(--s-signal)]">
          <Ticker value={certified} />
          <span className="s-mono ml-1 text-[11px] tracking-[0.1em] text-[var(--s-type-3)]">
            of {orgs?.length ?? 0} here
          </span>
        </div>
      </div>
    </div>
  );
}

/** Counts from the previously shown value to the new one over ~700ms. */
function Ticker({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) {
      return;
    }
    const start = performance.now();
    const duration = 700;
    let frame: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular-nums">{shown.toLocaleString()}</span>;
}
