import type { Org, Sector } from "@/lib/silos/types";
import { etaLabel } from "@/lib/silos/format";
import { PriorityBadge, RoleAssignBadge } from "@/components/silos/badges";

/**
 * Priority tag + short summary + predicted aid types. Reused in the left
 * sector rail, the dashboard coverage table, and community thread headers.
 */
export function SectorCard({
  sector,
  orgs,
  selected = false,
  compact = false,
  rank,
}: {
  sector: Sector;
  orgs?: Org[];
  selected?: boolean;
  compact?: boolean;
  rank?: number;
}) {
  const orgName = sector.assigned_org_id
    ? (orgs?.find((org) => org.id === sector.assigned_org_id)?.name ??
      sector.assigned_org_id)
    : null;
  const vulnerable = sector.vulnerable_summary;

  return (
    <div
      className={`border p-3 transition-colors ${
        selected
          ? "border-[var(--s-claim)] bg-[color-mix(in_srgb,var(--s-claim)_8%,transparent)]"
          : "border-[var(--s-ink-3)] bg-[var(--s-ink-1)] hover:border-[var(--s-type-3)]"
      } ${sector.priority === "critical" && sector.coverage_status === "unassigned" ? "s-hazard-stripes" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="s-mono text-[11px] font-medium tracking-[0.06em] text-[var(--s-type-3)]">
          {rank !== undefined && (
            <span className="s-display mr-1.5 text-base text-[var(--s-type-1)]">
              {String(rank).padStart(2, "0")}
            </span>
          )}
          {sector.id}
        </span>
        <PriorityBadge priority={sector.priority} />
      </div>
      <p className="s-display mt-1.5 truncate text-[16px] leading-tight tracking-[-0.02em] text-[var(--s-type-1)]">
        {sector.name}
      </p>
      <p className="s-mono mt-1 text-[10.5px] font-medium tracking-[0.04em] text-[var(--s-type-3)] uppercase">
        {etaLabel(sector.eta_hours)} · {sector.predicted_household_count.toLocaleString()} HH
      </p>

      {!compact && (
        <p className="s-mono mt-1 text-[10.5px] font-medium tracking-[0.04em] text-[var(--s-type-3)] uppercase">
          ELD {vulnerable.elderly_pct}% · NOVEH {vulnerable.no_vehicle_pct}% · LANG{" "}
          {vulnerable.language_barrier_pct}%
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {sector.predicted_aid_types.map((aidType) => (
          <span
            key={aidType}
            className="s-mono bg-[var(--s-ink-2)] px-1.5 py-0.5 text-[10px] font-medium tracking-[0.04em] text-[var(--s-type-2)] uppercase"
          >
            {aidType}
          </span>
        ))}
      </div>

      <div className="mt-2">
        <RoleAssignBadge status={sector.coverage_status} orgName={orgName} />
      </div>
    </div>
  );
}
