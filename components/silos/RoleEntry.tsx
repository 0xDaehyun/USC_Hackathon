import Link from "next/link";

/**
 * Step-1 CTA — red brutal box that opens the desk-select page.
 * Role cards live on `/desk` (raw-grid name + description list).
 */
export function RoleEntry() {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/desk"
        className="group block border-2 border-[var(--onb-hazard)] bg-[var(--onb-hazard)] px-4 py-4 text-center transition-colors hover:bg-transparent"
      >
        <span className="onb-mono block text-[13px] font-semibold tracking-[0.18em] text-[var(--onb-paper)] group-hover:text-[var(--onb-hazard)]">
          [ SELECT YOUR DESK ]
        </span>
        <span className="onb-mono mt-1.5 block text-[10px] tracking-[0.12em] text-[var(--onb-paper)]/85 group-hover:text-[var(--onb-hazard)]">
          THEN ENTER THE OPS ROOM →
        </span>
      </Link>
      <p className="onb-mono text-[10px] text-[var(--onb-ink-soft)]">
        Desk clearance required before the live map unlocks
      </p>
    </div>
  );
}
