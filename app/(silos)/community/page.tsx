"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  claimSector,
  getCommunityFeed,
  getOrgs,
  getSectors,
  postCommunityMessage,
} from "@/lib/silos/api";
import { PRIORITY_ORDER, timeAgo } from "@/lib/silos/format";
import { ROLE_LABELS, useSilosUi } from "@/lib/silos/ui";
import { usePolling } from "@/lib/silos/usePolling";
import { SectorCard } from "@/components/silos/SectorCard";

export default function CommunityPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, actingOrgId, setActingOrgId } = useSilosUi();

  const { data: sectors, refresh: refreshSectors } = usePolling(getSectors, 15_000);
  const { data: orgs } = usePolling(getOrgs, 30_000);
  const { data: feed, refresh: refreshFeed } = usePolling(getCommunityFeed, 10_000);

  const sorted = useMemo(
    () =>
      [...(sectors ?? [])].sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          (a.eta_hours ?? 99) - (b.eta_hours ?? 99),
      ),
    [sectors],
  );

  const selectedId = searchParams.get("sector") ?? sorted[0]?.id ?? null;
  const selected = sorted.find((sector) => sector.id === selectedId) ?? null;
  const thread = (feed ?? []).filter((event) => event.sector_id === selectedId);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!selectedId || !draft.trim()) {
      return;
    }
    setBusy(true);
    try {
      await postCommunityMessage({
        sector_id: selectedId,
        org_id: actingOrgId,
        text: draft.trim(),
      });
      setDraft("");
      refreshFeed();
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (!selectedId) {
      return;
    }
    setBusy(true);
    try {
      await claimSector(selectedId, { org_id: actingOrgId, role });
      refreshSectors();
      refreshFeed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="silos-paper flex h-full">
      {/* Thread index */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-[var(--s-ink-3)]">
        <h1 className="s-label s-label--bracket border-b border-[var(--s-ink-3)] px-3 py-3 text-[12px] tracking-[0.12em]">
          Sector threads
        </h1>
        <ol>
          {sorted.map((sector, index) => {
            const count = (feed ?? []).filter(
              (event) => event.sector_id === sector.id,
            ).length;
            const active = sector.id === selectedId;
            return (
              <li key={sector.id}>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`${pathname}?sector=${sector.id}`, { scroll: false })
                  }
                  className={`flex w-full items-baseline justify-between gap-2 border-b border-[var(--s-ink-3)] px-3 py-3 text-left transition-colors ${
                    active
                      ? "bg-[var(--s-type-1)] text-white"
                      : "text-[var(--s-type-1)] hover:bg-[var(--s-ink-2)]"
                  }`}
                >
                  <span
                    className={`min-w-0 truncate font-[family-name:var(--s-sans)] text-[16px] font-medium leading-tight tracking-[-0.01em] ${
                      active ? "text-white" : "text-[var(--s-type-1)]"
                    }`}
                  >
                    <span
                      className={`mr-1.5 font-[family-name:var(--s-mono)] text-[12px] tracking-[0.06em] ${
                        active ? "text-white/55" : "text-[var(--s-type-3)]"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {sector.name}
                  </span>
                  <span
                    className={`s-mono shrink-0 text-[12px] tabular-nums ${
                      active ? "text-white" : "text-[var(--s-type-1)]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selected && (
          <div className="border-b border-[var(--s-ink-3)] p-3">
            <SectorCard sector={selected} orgs={orgs ?? undefined} />
            <div className="mt-2.5 flex items-center gap-2">
              <label className="s-label" htmlFor="acting-org">
                Responding as
              </label>
              <select
                id="acting-org"
                value={actingOrgId}
                onChange={(event) => setActingOrgId(event.target.value)}
                className="s-mono border border-[var(--s-ink-3)] bg-[var(--s-ink-1)] px-2 py-1.5 text-[11px] text-[var(--s-type-1)]"
              >
                {(orgs ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              {selected.coverage_status === "unassigned" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void claim()}
                  className="s-mono border border-[var(--s-claim)] bg-[var(--s-claim)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-[var(--s-ink-0)] uppercase hover:bg-transparent hover:text-[var(--s-claim)] disabled:opacity-50"
                >
                  Claim {selected.id} ({ROLE_LABELS[role]})
                </button>
              ) : (
                <span className="s-body-sm">
                  Handoff: coordinate below, then re-claim when agreed.
                </span>
              )}
            </div>
          </div>
        )}

        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {thread.length === 0 && (
            <li className="s-body-sm">No activity in this sector yet.</li>
          )}
          {thread.map((event) => {
            const tone =
              event.type === "gap_detected"
                ? "border-[var(--s-hazard)]"
                : event.type === "claim"
                  ? "border-[var(--s-active)]"
                  : event.type === "predictive_alert"
                    ? "border-[var(--s-claim)]"
                    : "border-[var(--s-ink-3)]";
            return (
              <li
                key={event.id}
                className={`max-w-[85%] border bg-[var(--s-ink-1)] p-3 ${tone} ${
                  event.type === "gap_detected" ? "s-hazard-stripes" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="s-mono text-[10px] font-semibold tracking-[0.08em] text-[var(--s-type-3)] uppercase">
                    {event.type === "gap_detected" ? "!! " : ""}
                    {event.type.replaceAll("_", " ")}
                  </span>
                  <span className="s-mono text-[10.5px] text-[var(--s-type-3)]">
                    {timeAgo(event.timestamp)}
                  </span>
                </div>
                <p className="s-body mt-1.5 text-[15px] text-[var(--s-type-1)]">{event.text}</p>
              </li>
            );
          })}
        </ol>

        <div className="flex gap-2 border-t border-[var(--s-ink-3)] p-3">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void send();
              }
            }}
            placeholder={
              selected ? `MESSAGE ${selected.id} COORDINATION THREAD…` : "SELECT A SECTOR"
            }
            className="s-mono min-w-0 flex-1 border border-[var(--s-ink-3)] bg-[var(--s-ink-1)] px-3 py-2 text-[11px] text-[var(--s-type-1)] placeholder:text-[var(--s-type-3)] focus:border-[var(--s-type-1)] focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => void send()}
            className="s-mono border border-[var(--s-type-1)] bg-[var(--s-type-1)] px-4 py-2 text-[11px] font-semibold tracking-[0.1em] text-[var(--s-ink-0)] uppercase hover:bg-transparent hover:text-[var(--s-type-1)] disabled:opacity-40"
          >
            Send &gt;&gt;
          </button>
        </div>
      </div>
    </div>
  );
}
