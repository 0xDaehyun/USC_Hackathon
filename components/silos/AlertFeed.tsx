"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCommunityFeed } from "@/lib/silos/api";
import { timeAgo } from "@/lib/silos/format";
import { hrefWithSector } from "@/lib/silos/ui";
import { usePolling } from "@/lib/silos/usePolling";
import type { FeedEventType } from "@/lib/silos/types";

const TYPE_META: Record<FeedEventType, { label: string; color: string }> = {
  predictive_alert: { label: "PREDICT", color: "var(--s-claim)" },
  gap_detected: { label: "GAP!!", color: "var(--s-hazard)" },
  claim: { label: "CLAIM", color: "var(--s-active)" },
  message: { label: "MSG", color: "var(--s-type-3)" },
};

/** Live wire — polls the feed every 10s; newest row carries the pulse mark. */
export function AlertFeed({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: events, error } = usePolling(getCommunityFeed, 10_000);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--s-ink-3)] px-3 py-2.5">
        <h2 className="s-label s-label--bracket">Live wire</h2>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span className="s-live-dot" />
            <span className="s-mono text-[10px] font-semibold tracking-[0.1em] text-[var(--s-hazard)] uppercase">
              Feed
            </span>
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close live wire"
              className="s-mono border border-[var(--s-ink-3)] px-1.5 py-0.5 text-[11px] text-[var(--s-type-3)] hover:border-[var(--s-type-1)] hover:text-[var(--s-type-1)]"
            >
              ✕
            </button>
          )}
        </span>
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <li className="s-mono border-t border-[var(--s-hazard)] p-3 text-[11px] font-medium text-[var(--s-hazard)] uppercase">
            !! Feed unavailable — retrying
          </li>
        )}
        {events?.map((event, index) => {
          const meta = TYPE_META[event.type];
          const row = (
            <div
              className={`s-stream-row ${event.type === "gap_detected" ? "s-hazard-stripes" : ""}`}
            >
              <span className="self-stretch">
                {index === 0 && <span className="s-stream-newmark block" />}
              </span>
              <span className="text-[var(--s-type-3)]">{timeAgo(event.timestamp)}</span>
              <span style={{ color: meta.color }} className="font-semibold">
                {meta.label}
              </span>
              <span className="min-w-0">
                <span className="s-body block text-[13px] text-[var(--s-type-2)]">
                  {event.text}
                </span>
                {event.sector_id && (
                  <span className="mt-0.5 block text-[10px] font-medium tracking-[0.06em] text-[var(--s-type-3)]">
                    &gt;&gt;&gt; {event.sector_id}
                  </span>
                )}
              </span>
            </div>
          );
          return (
            <li key={event.id}>
              {event.sector_id ? (
                <Link href={hrefWithSector(pathname, event.sector_id)} className="block">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
        {events && events.length === 0 && (
          <li className="s-label p-3">Awaiting first transmission…</li>
        )}
      </ol>
    </div>
  );
}
