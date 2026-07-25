"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getOrgs, getSectors } from "@/lib/silos/api";
import { PRIORITY_ORDER } from "@/lib/silos/format";
import { hrefWithSector } from "@/lib/silos/ui";
import { usePolling } from "@/lib/silos/usePolling";
import { SectorCard } from "@/components/silos/SectorCard";

/** Left rail: sectors ranked by priority; clicking deep-links the current tab. */
export function SectorRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("sector");

  const { data: sectors } = usePolling(getSectors, 15_000);
  const { data: orgs } = usePolling(getOrgs, 30_000);

  const sorted = [...(sectors ?? [])].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.eta_hours ?? 99) - (b.eta_hours ?? 99),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b border-[var(--s-ink-3)] px-3 py-2.5">
        <h2 className="s-label s-label--bracket text-[12px] tracking-[0.12em]">
          Sectors / ranked
        </h2>
        <span className="s-mono text-[10px] font-medium tracking-[0.06em] text-[var(--s-type-3)] uppercase">
          {sorted.length} zones
        </span>
      </div>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {sorted.map((sector, index) => (
          <li key={sector.id}>
            <Link href={hrefWithSector(pathname, sector.id)} className="block">
              <SectorCard
                sector={sector}
                orgs={orgs ?? undefined}
                selected={sector.id === selectedId}
                rank={index + 1}
                compact
              />
            </Link>
          </li>
        ))}
        {!sectors && (
          <li className="s-label p-2">Loading sectors…</li>
        )}
      </ol>
    </div>
  );
}
