"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getOrgs, getSectors } from "@/lib/silos/api";
import { PRIORITY_ORDER, etaLabel } from "@/lib/silos/format";
import { usePolling } from "@/lib/silos/usePolling";
import {
  CapacityBadge,
  CertificationBadge,
  PriorityBadge,
  RoleAssignBadge,
} from "@/components/silos/badges";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("sector");
  const { data: sectors } = usePolling(getSectors, 15_000);
  const { data: orgs } = usePolling(getOrgs, 30_000);

  const sorted = [...(sectors ?? [])].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.eta_hours ?? 99) - (b.eta_hours ?? 99),
  );
  const unassignedCritical = sorted.filter(
    (sector) => sector.priority === "critical" && sector.coverage_status === "unassigned",
  );

  return (
    <div className="silos-paper h-full overflow-y-auto p-5">
      <div className="flex items-baseline justify-between gap-4 border-b-4 border-[var(--s-type-1)] pb-3">
        <h1 className="s-display s-type-in text-3xl text-[var(--s-type-1)]">
          Coverage<span className="text-[var(--s-hazard)]">.</span>
        </h1>
        <span className="s-label">
          Who is active where · what is unassigned · what needs coverage next
        </span>
      </div>

      {/* Gap alert block — hazard stripes, only when a gap exists */}
      {unassignedCritical.length > 0 && (
        <div className="s-hazard-stripes mt-5 grid grid-cols-[14ch_1fr] gap-6 border border-[var(--s-hazard)] p-4">
          <div className="s-display self-start border-2 border-[var(--s-hazard)] p-2.5 text-lg text-[var(--s-hazard)]">
            !! GAP
          </div>
          <div className="s-body text-[15px]">
            {unassignedCritical.length} critical sector
            {unassignedCritical.length > 1 ? "s have" : " has"}{" "}
            <strong className="bg-[var(--s-type-1)] px-1 font-medium text-[var(--s-ink-0)]">
              no organization assigned
            </strong>
            {" — "}
            {unassignedCritical.map((sector, index) => (
              <span key={sector.id}>
                {index > 0 && ", "}
                <Link
                  href={`/map?sector=${sector.id}`}
                  className="s-mono text-[var(--s-hazard)] underline underline-offset-2"
                >
                  {sector.id} {sector.name}
                </Link>
              </span>
            ))}
            .{" "}
            <span className="s-mono text-[11px] tracking-[0.1em] text-[var(--s-hazard)] uppercase">
              &gt;&gt;&gt; claim on the map
            </span>
          </div>
        </div>
      )}

      {/* Index-grid coverage table: 1px gaps on ink, print-index style */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between border-b border-[var(--s-ink-3)] pb-2">
          <h2 className="s-display text-lg text-[var(--s-type-1)]">
            Index of sectors <span className="text-[var(--s-hazard)]">{"///"}</span>
          </h2>
          <span className="s-label">
            {sorted.length} entries · sorted by priority
          </span>
        </div>
        <div
          className="mt-3 grid gap-px border border-[var(--s-ink-3)] bg-[var(--s-ink-3)]"
          style={{ gridTemplateColumns: "5ch 1.4fr 12ch 1.2fr 1.4fr 9ch 14ch" }}
        >
          {["№", "SECTOR", "PRIORITY", "COVERAGE", "PREDICTED AID", "HH", "HORIZON"].map(
            (header) => (
              <div
                key={header}
                className="s-mono bg-[var(--s-type-1)] px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--s-ink-0)] uppercase"
              >
                {header}
              </div>
            ),
          )}
          {sorted.map((sector, index) => {
            const orgName = sector.assigned_org_id
              ? (orgs?.find((org) => org.id === sector.assigned_org_id)?.name ??
                sector.assigned_org_id)
              : null;
            const cell = `px-3 py-2.5 text-[11px] ${
              sector.id === selectedId
                ? "bg-[color-mix(in_srgb,var(--s-claim)_10%,var(--s-ink-1))]"
                : "bg-[var(--s-ink-1)]"
            }`;
            return (
              <div key={sector.id} className="contents">
                <div className={`${cell} s-mono text-[var(--s-type-3)]`}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className={cell}>
                  <Link
                    href={`/map?sector=${sector.id}`}
                    className="s-display text-[17px] font-medium leading-tight tracking-[-0.02em] text-[var(--s-type-1)] hover:bg-[var(--s-type-1)] hover:text-[var(--s-ink-0)]"
                  >
                    <span className="s-mono mr-2 align-baseline text-[12px] tracking-[0.06em] text-[var(--s-type-3)]">
                      {sector.id}
                    </span>
                    {sector.name}
                  </Link>
                </div>
                <div className={cell}>
                  <PriorityBadge priority={sector.priority} />
                </div>
                <div className={cell}>
                  <RoleAssignBadge status={sector.coverage_status} orgName={orgName} />
                </div>
                <div className={`${cell} s-mono text-[11px] tracking-[0.02em] text-[var(--s-type-3)] uppercase`}>
                  {sector.predicted_aid_types.join(" · ")}
                </div>
                <div className={`${cell} s-mono text-right text-[var(--s-type-2)] tabular-nums`}>
                  {sector.predicted_household_count.toLocaleString()}
                </div>
                <div className={`${cell} s-mono text-[11px] uppercase`}>
                  {sector.eta_hours !== null && sector.coverage_status === "unassigned" ? (
                    <span className="font-semibold text-[var(--s-signal)]">
                      NEEDS COVER ~{Math.max(sector.eta_hours - 2, 1)}H
                    </span>
                  ) : (
                    <span className="text-[var(--s-type-3)]">{etaLabel(sector.eta_hours)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!sectors && <p className="s-label mt-3">Loading coverage…</p>}
        <p className="s-body-sm mt-2">
          Coverage horizon = fire ETA minus staging lead time. Demand forecasting
          is planned, not yet modeled.
        </p>
      </section>

      {/* Partner org roster */}
      <section className="mt-8 pb-8">
        <div className="flex items-baseline justify-between border-b border-[var(--s-ink-3)] pb-2">
          <h2 className="s-display text-lg text-[var(--s-type-1)]">
            Partner organizations <span className="text-[var(--s-hazard)]">{"///"}</span>
          </h2>
          <span className="s-label">
            {(orgs ?? []).filter((org) => org.capacity_status === "available").length}{" "}
            available now
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3">
          {(orgs ?? []).map((org, index) => (
            <div key={org.id} className="s-panel p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="s-mono text-[10.5px] font-medium tracking-[0.08em] text-[var(--s-type-3)] uppercase">
                    ORG {String(index + 1).padStart(2, "0")} · {org.category}
                  </p>
                  <p className="s-display mt-1 truncate text-sm text-[var(--s-type-1)]">
                    {org.name}
                  </p>
                </div>
                <CapacityBadge status={org.capacity_status} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {org.certifications.map((certification) => (
                  <CertificationBadge key={certification} label={certification} />
                ))}
              </div>
              <p className="s-mono mt-2.5 border-t border-[var(--s-ink-3)] pt-2 text-[11px] tracking-[0.04em] text-[var(--s-type-3)] uppercase">
                {org.active_sectors.length > 0 ? (
                  <>
                    ACTIVE &gt;&gt;{" "}
                    {org.active_sectors.map((sectorId, index2) => (
                      <span key={sectorId}>
                        {index2 > 0 && " · "}
                        <Link
                          href={`/map?sector=${sectorId}`}
                          className="font-semibold text-[var(--s-claim)] hover:bg-[var(--s-claim)] hover:text-[var(--s-ink-0)]"
                        >
                          {sectorId}
                        </Link>
                      </span>
                    ))}
                  </>
                ) : (
                  "NO SECTORS ASSIGNED"
                )}
              </p>
            </div>
          ))}
        </div>
        <p className="s-body-sm mt-3">
          Certification badges reflect the documented statewide gap (2 of 45 orgs
          certified for ash &amp; debris search) — verification backend planned.
        </p>
      </section>
    </div>
  );
}
