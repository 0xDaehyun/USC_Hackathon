import type { CoverageStatus, OrgCapacityStatus, SectorPriority } from "@/lib/silos/types";

export function PriorityBadge({ priority }: { priority: SectorPriority }) {
  if (priority === "critical") {
    return <span className="s-tag s-tag--fill">CRITICAL</span>;
  }
  return (
    <span className={`s-tag ${priority === "warning" ? "s-tag--warning" : "s-tag--monitor"}`}>
      {priority}
    </span>
  );
}

const COVERAGE_LABELS: Record<CoverageStatus, string> = {
  unassigned: "UNASSIGNED",
  claimed: "CLAIMED",
  active: "ACTIVE",
};

/** Shared unassigned / claimed / active state chip (dashboard + community). */
export function RoleAssignBadge({
  status,
  orgName,
}: {
  status: CoverageStatus;
  orgName?: string | null;
}) {
  const tone =
    status === "unassigned"
      ? "s-tag--critical"
      : status === "claimed"
        ? "s-tag--claim"
        : "s-tag--active";
  return (
    <span className={`s-tag max-w-full ${tone}`} style={{ animation: "none" }}>
      <span
        className="inline-block size-1.5"
        style={{ background: "currentColor" }}
      />
      <span className="truncate">
        {COVERAGE_LABELS[status]}
        {orgName ? ` · ${orgName}` : ""}
      </span>
    </span>
  );
}

/**
 * Capability registry made visible without the backing system:
 * certified capabilities render as distinct marks.
 */
export function CertificationBadge({ label }: { label: string }) {
  const certified = label.toLowerCase().includes("certified");
  return (
    <span
      className={`s-tag ${certified ? "s-tag--claim" : ""}`}
      style={{ animation: "none", color: certified ? undefined : "var(--s-type-3)" }}
    >
      {certified ? "✓" : "·"} {label}
    </span>
  );
}

export function CapacityBadge({ status }: { status: OrgCapacityStatus }) {
  const color =
    status === "available"
      ? "var(--s-active)"
      : status === "stretched"
        ? "var(--s-signal)"
        : "var(--s-hazard)";
  return (
    <span
      className="s-mono text-[10.5px] font-semibold tracking-[0.08em] uppercase"
      style={{ color }}
    >
      ⬤ {status}
    </span>
  );
}
