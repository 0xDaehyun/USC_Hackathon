"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  claimSector,
  getCurrentFire,
  getFirePrediction,
  getOrgs,
  getSectorDetail,
  getSectors,
} from "@/lib/silos/api";
import { etaLabel } from "@/lib/silos/format";
import { ROLE_LABELS, useSilosUi } from "@/lib/silos/ui";
import type { SectorDetail } from "@/lib/silos/types";
import { usePolling } from "@/lib/silos/usePolling";
import { CertificationBadge, PriorityBadge, RoleAssignBadge } from "@/components/silos/badges";
import { LiveMap } from "@/components/silos/LiveMap";

export default function MapPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSectorId = searchParams.get("sector");
  const { role, actingOrgId } = useSilosUi();

  const { data: fire } = usePolling(getCurrentFire, 30_000);
  const { data: prediction } = usePolling(
    useCallback(() => getFirePrediction(fire?.id ?? "fire-eaton-sim"), [fire?.id]),
    60_000,
  );
  const { data: sectors, refresh: refreshSectors } = usePolling(getSectors, 15_000);
  const { data: orgs } = usePolling(getOrgs, 30_000);

  const [fetchedDetail, setFetchedDetail] = useState<SectorDetail | null>(null);
  useEffect(() => {
    if (!selectedSectorId) {
      return;
    }
    let cancelled = false;
    getSectorDetail(selectedSectorId)
      .then((result) => {
        if (!cancelled) {
          setFetchedDetail(result);
        }
      })
      .catch(() => {
        /* panel simply stays hidden until the next successful fetch */
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSectorId, sectors]);
  // Only show the fetched detail when it matches the current selection.
  const detail =
    selectedSectorId && fetchedDetail?.id === selectedSectorId
      ? fetchedDetail
      : null;

  const [focusRoadName, setFocusRoadName] = useState<string | null>(null);

  const selectSector = useCallback(
    (id: string | null) => {
      setFocusRoadName(null);
      router.push(id ? `${pathname}?sector=${encodeURIComponent(id)}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  const [claiming, setClaiming] = useState(false);
  const handleClaim = async () => {
    if (!selectedSectorId) {
      return;
    }
    setClaiming(true);
    try {
      await claimSector(selectedSectorId, { org_id: actingOrgId, role });
      refreshSectors();
    } finally {
      setClaiming(false);
    }
  };

  const actingOrgName =
    orgs?.find((org) => org.id === actingOrgId)?.name ?? "your org";

  const all = sectors ?? [];
  const counts = {
    unassigned: all.filter((s) => s.coverage_status === "unassigned").length,
    claimed: all.filter((s) => s.coverage_status === "claimed").length,
    active: all.filter((s) => s.coverage_status === "active").length,
    critical: all.filter((s) => s.priority === "critical").length,
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <LiveMap
          fire={fire}
          prediction={prediction}
          sectors={all}
          selectedSectorId={selectedSectorId}
          onSelectSector={(id) => selectSector(id)}
          focusRoadName={focusRoadName}
        />

        {/* Selected sector dossier — desktop: right panel; mobile: bottom sheet */}
        {detail && (
          <div className="s-panel absolute inset-x-0 bottom-0 z-20 flex max-h-[58%] w-full flex-col overflow-hidden border-t-2 border-[var(--s-type-1)] md:inset-x-auto md:top-3 md:right-3 md:bottom-auto md:max-h-[calc(100%-4rem)] md:w-80 md:border-t">
            <div className="mx-auto mt-2 h-1 w-10 bg-[var(--s-ink-3)] md:hidden" aria-hidden />
            <div className="flex items-start justify-between gap-2 border-b border-[var(--s-ink-3)] p-3">
              <div className="min-w-0">
                <p className="s-mono mb-1 text-[10px] tracking-[0.12em] text-[var(--s-hazard)] uppercase md:hidden">
                  [ Incident detail ]
                </p>
                <div className="flex items-center gap-2">
                  <span className="s-mono text-[11px] font-medium tracking-[0.06em] text-[var(--s-type-3)]">
                    {detail.id}
                  </span>
                  <PriorityBadge priority={detail.priority} />
                </div>
                <h2 className="s-display s-type-in mt-1.5 text-lg text-[var(--s-type-1)]">
                  {detail.name}
                </h2>
                <p className="s-mono mt-1 text-[10.5px] font-medium tracking-[0.04em] text-[var(--s-type-3)] uppercase">
                  {etaLabel(detail.eta_hours)} · ~
                  {detail.predicted_household_count.toLocaleString()} households
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectSector(null)}
                className="s-mono border border-[var(--s-ink-3)] px-1.5 py-0.5 text-[var(--s-type-3)] hover:border-[var(--s-type-1)] hover:text-[var(--s-type-1)]"
                aria-label="Close sector detail"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 text-xs">
              <p className="s-dossier-prose s-body text-[15px]">{detail.summary}</p>

              <div className="grid grid-cols-3 gap-px bg-[var(--s-ink-3)]">
                <VulnStat label="Elderly" value={detail.vulnerable_summary.elderly_pct} />
                <VulnStat label="No vehicle" value={detail.vulnerable_summary.no_vehicle_pct} />
                <VulnStat label="Lang barrier" value={detail.vulnerable_summary.language_barrier_pct} />
              </div>

              <section className="silos-paper border border-[var(--s-ink-3)] p-2.5">
                <h3 className="s-label s-label--bracket mb-1.5">Aid needed</h3>
                <ul>
                  {detail.aid_types_needed.map((need) => (
                    <li key={need.type} className="border-t border-[var(--s-ink-3)] py-2">
                      <div className="flex items-center justify-between">
                        <span className="s-mono text-[10.5px] font-semibold tracking-[0.08em] text-[var(--s-type-1)] uppercase">
                          {need.type}
                        </span>
                        <span
                          className="s-mono text-[10px] font-semibold tracking-[0.08em] uppercase"
                          style={{
                            color:
                              need.status === "needed"
                                ? "var(--s-hazard)"
                                : need.status === "planned"
                                  ? "var(--s-signal)"
                                  : "var(--s-active)",
                          }}
                        >
                          {need.status === "needed" ? "!! " : ""}
                          {need.status}
                        </span>
                      </div>
                      <p className="s-dossier-prose s-body-sm mt-1">{need.detail}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="s-label s-label--bracket mb-1.5">
                  Road access — {detail.road_access.rating}
                </h3>
                {detail.road_access.single_access_roads.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {detail.road_access.single_access_roads.map((road) => (
                      <li key={road}>
                        <button
                          type="button"
                          onClick={() => setFocusRoadName(road)}
                          className="s-mono w-full border border-[var(--s-signal)] px-2 py-1.5 text-left text-[11px] tracking-[0.04em] text-[var(--s-signal)] uppercase transition-colors hover:bg-[var(--s-signal)] hover:text-[var(--s-ink-0)]"
                        >
                          &gt;&gt;&gt; Show on map · {road}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="mt-2 space-y-1">
                  {detail.road_access.notes.map((note) => (
                    <li key={note} className="s-dossier-prose s-body-sm">
                      · {note}
                    </li>
                  ))}
                </ul>
              </section>

              {detail.facilities.length > 0 && (
                <section>
                  <h3 className="s-label s-label--bracket mb-1.5">Facilities</h3>
                  <div className="flex flex-wrap gap-1">
                    {detail.facilities.map((facility) => (
                      <CertificationBadge key={facility.id} label={facility.name} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="border-t border-[var(--s-ink-3)] p-3">
              <div className="mb-2">
                <RoleAssignBadge
                  status={detail.coverage_status}
                  orgName={
                    detail.assigned_org_id
                      ? (orgs?.find((org) => org.id === detail.assigned_org_id)?.name ??
                        detail.assigned_org_id)
                      : null
                  }
                />
              </div>
              {detail.coverage_status === "unassigned" && (
                <button
                  type="button"
                  disabled={claiming}
                  onClick={() => void handleClaim()}
                  className="s-mono w-full border border-[var(--s-claim)] bg-[var(--s-claim)] py-2 text-[11px] font-semibold tracking-[0.1em] text-[var(--s-ink-0)] uppercase transition-colors hover:bg-transparent hover:text-[var(--s-claim)] disabled:opacity-50"
                >
                  {claiming
                    ? "Claiming…"
                    : `Claim for ${actingOrgName} (${ROLE_LABELS[role]})`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Wire ribbon — compact on mobile */}
      <div className="s-ribbon hidden sm:flex">
        <span className="flex items-center gap-2">
          <span className="s-live-dot" />
          <b className="text-[var(--s-hazard)]">LIVE</b>
        </span>
        <span className="s-ribbon__sep">·</span>
        <span>
          <b>{fire?.name ?? "—"}</b>{" "}
          {fire
            ? `WIND ${fire.wind_speed}MPH ${fire.wind_direction} · ${fire.containment_pct.toFixed(1)}% CONTAINED`
            : ""}
        </span>
        <span className="s-ribbon__sep">·</span>
        <span>
          ALL SECTORS <span className="val">{all.length}</span>
        </span>
        <span className="s-ribbon__sep">·</span>
        <span>
          UNASSIGNED <span className="val">{counts.unassigned}</span>
        </span>
        <span className="s-ribbon__sep">·</span>
        <span>
          CLAIMED <span className="val">{counts.claimed}</span>
        </span>
        <span className="s-ribbon__sep">·</span>
        <span>
          ACTIVE <span className="val">{counts.active}</span>
        </span>
        <span className="s-ribbon__sep">·</span>
        <span style={{ color: "var(--s-hazard)" }}>
          CRITICAL <b style={{ color: "var(--s-hazard)" }}>{counts.critical}</b>
        </span>
      </div>
    </div>
  );
}

function VulnStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--s-ink-1)] px-1 py-2 text-center">
      <p className="s-label text-[9.5px]">{label}</p>
      <p className="s-display mt-1 text-base text-[var(--s-type-1)] tabular-nums">
        {value}%
      </p>
    </div>
  );
}
