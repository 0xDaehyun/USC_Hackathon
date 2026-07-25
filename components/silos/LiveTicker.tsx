"use client";

import { getCommunityFeed } from "@/lib/silos/api";
import { timeAgo } from "@/lib/silos/format";
import { usePolling } from "@/lib/silos/usePolling";
import type { FeedEventType } from "@/lib/silos/types";

const TYPE_META: Record<FeedEventType, { label: string; color: string }> = {
  predictive_alert: { label: "PREDICT", color: "var(--s-claim)" },
  gap_detected: { label: "!! GAP", color: "var(--s-hazard)" },
  claim: { label: "CLAIM", color: "var(--s-active)" },
  message: { label: "MSG", color: "var(--s-type-3)" },
};

/**
 * Breaking-news style top ticker: feed events scroll horizontally on loop.
 * The [ LIVE WIRE ] toggle opens the full live feed drawer.
 */
export function LiveTicker({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { data: events } = usePolling(getCommunityFeed, 10_000);
  const items = events ?? [];

  return (
    <div className="s-ticker">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex shrink-0 items-center gap-2 border-r border-[var(--s-ink-3)] bg-[var(--s-hazard)] px-3 text-white transition-colors hover:bg-[#c01212]"
        title="Open the full live wire feed"
      >
        <span className="s-live-dot" style={{ background: "#fff" }} />
        <span className="s-mono text-[11px] font-semibold tracking-[0.12em] uppercase">
          [ LIVE WIRE ]
        </span>
        <span aria-hidden className="text-[10px]">
          {open ? "▲" : "▼"}
        </span>
      </button>

      <div className="s-ticker__viewport">
        {items.length === 0 ? (
          <span className="s-ticker__item pl-4">Awaiting first transmission…</span>
        ) : (
          <div className="s-ticker__track" aria-hidden={open}>
            {/* content duplicated once for a seamless loop */}
            {[0, 1].map((copy) => (
              <div key={copy} className="flex" aria-hidden={copy === 1}>
                {items.map((event) => {
                  const meta = TYPE_META[event.type];
                  return (
                    <span key={`${copy}-${event.id}`} className="s-ticker__item">
                      <span
                        className="font-semibold tracking-[0.1em]"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {event.sector_id && (
                        <span className="font-semibold text-[var(--s-type-1)]">
                          {event.sector_id}
                        </span>
                      )}
                      <span>{event.text}</span>
                      <span className="text-[var(--s-type-3)]">
                        · {timeAgo(event.timestamp)}
                      </span>
                      <span className="pl-6 text-[var(--s-ink-3)]" aria-hidden>
                        {"///"}
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
