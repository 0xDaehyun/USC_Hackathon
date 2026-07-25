"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getCurrentFire, resetDemo } from "@/lib/silos/api";
import { SilosUiProvider, hrefWithSector } from "@/lib/silos/ui";
import { usePolling } from "@/lib/silos/usePolling";
import { AlertFeed } from "@/components/silos/AlertFeed";
import { KpiStrip } from "@/components/silos/KpiStrip";
import { LiveTicker } from "@/components/silos/LiveTicker";
import { SectorRail } from "@/components/silos/SectorRail";

const TABS = [
  { href: "/map", label: "MAP" },
  { href: "/validation", label: "VALIDATE" },
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/community", label: "COMMUNITY" },
];

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap";

export function SilosShell({ children }: { children: React.ReactNode }) {
  const resetOnce = useRef(false);
  const [opsEpoch, setOpsEpoch] = useState(0);
  useEffect(() => {
    if (resetOnce.current) {
      return;
    }
    resetOnce.current = true;
    resetDemo()
      .then(() => setOpsEpoch(Date.now()))
      .catch(() => {
        /* API unavailable; polling will surface it */
      });
  }, []);

  const [wireOpen, setWireOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [kpiHiddenByScroll, setKpiHiddenByScroll] = useState(false);
  const [railState, setRailState] = useState<{ sector: string | null; open: boolean }>({
    sector: null,
    open: true,
  });
  const touchStartX = useRef<number | null>(null);
  const searchParams = useSearchParams();
  const selectedSector = searchParams.get("sector");

  // When the selected sector changes on mobile, collapse the rail so the map
  // stays centered and the incident sheet can rise from the bottom.
  if (!isDesktop && railState.sector !== selectedSector) {
    setRailState({
      sector: selectedSector,
      open: selectedSector === null,
    });
  }

  const railOpen = isDesktop || railState.open;
  const setRailOpen = (next: boolean | ((value: boolean) => boolean)) => {
    setRailState((prev) => ({
      sector: selectedSector,
      open: typeof next === "function" ? next(prev.open) : next,
    }));
  };
  const kpiVisible = isDesktop || (!kpiHiddenByScroll && selectedSector === null);

  // Mobile: hide KPI strip after the sector rail scrolls a bit.
  useEffect(() => {
    const onScroll = (event: Event) => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setKpiHiddenByScroll(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      const top = target && "scrollTop" in target ? target.scrollTop : 0;
      setKpiHiddenByScroll(top >= 28);
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const onRailTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onRailTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) {
      return;
    }
    const end = event.changedTouches[0]?.clientX ?? start;
    // Swipe left to collapse the sector rail on mobile.
    if (start - end > 56) {
      setRailOpen(false);
    }
  };

  return (
    <SilosUiProvider>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_URL} rel="stylesheet" />
      <div className="silos flex h-dvh flex-col">
        <div className="hidden md:block">
          <RegisterStrip />
        </div>
        <TopNav
          railOpen={railOpen}
          onToggleRail={() => setRailOpen((open) => !open)}
        />
        <div className="hidden md:block">
          <LiveTicker
            key={`ticker-${opsEpoch}`}
            open={wireOpen}
            onToggle={() => setWireOpen((value) => !value)}
          />
        </div>
        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
            kpiVisible ? "max-h-40 opacity-100" : "max-h-0 opacity-0 md:max-h-40 md:opacity-100"
          }`}
        >
          <KpiStrip key={`kpi-${opsEpoch}`} />
        </div>

        <div className="relative min-h-0 flex-1 md:grid md:grid-cols-[19rem_minmax(0,1fr)]">
          {/* Mobile backdrop when rail is open */}
          {railOpen && (
            <button
              type="button"
              aria-label="Close sector list"
              className="absolute inset-0 z-20 bg-black/45 md:hidden"
              onClick={() => setRailOpen(false)}
            />
          )}

          <aside
            onTouchStart={onRailTouchStart}
            onTouchEnd={onRailTouchEnd}
            className={`z-30 flex min-h-0 flex-col border-[var(--s-ink-3)] bg-[var(--s-ink-0)] transition-transform duration-300 md:relative md:z-0 md:translate-x-0 md:border-r ${
              railOpen
                ? "absolute inset-y-0 left-0 w-[min(19rem,86vw)] translate-x-0 border-r"
                : "absolute inset-y-0 left-0 w-[min(19rem,86vw)] -translate-x-full border-r md:translate-x-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[var(--s-ink-3)] px-3 py-2 md:hidden">
              <p className="s-mono text-[10px] tracking-[0.1em] text-[var(--s-type-3)] uppercase">
                ← swipe left to collapse
              </p>
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                className="s-mono border border-[var(--s-ink-3)] px-2 py-1 text-[10px] tracking-[0.08em] text-[var(--s-type-2)] uppercase"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SectorRail key={`rail-${opsEpoch}`} />
            </div>
          </aside>

          <main className="relative min-h-0 overflow-hidden">{children}</main>

          {wireOpen && (
            <aside className="absolute inset-y-0 right-0 z-30 hidden w-[22rem] border-l border-[var(--s-ink-3)] bg-[var(--s-ink-0)] shadow-[-16px_0_40px_rgba(0,0,0,0.55)] md:block">
              <AlertFeed key={`feed-${opsEpoch}`} onClose={() => setWireOpen(false)} />
            </aside>
          )}
        </div>
      </div>
    </SilosUiProvider>
  );
}

function RegisterStrip() {
  const { data: fire } = usePolling(getCurrentFire, 5_000);
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];
      setClock(
        `${months[now.getUTCMonth()]} ${String(now.getUTCDate()).padStart(2, "0")} · ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")} UTC`,
      );
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-5 gap-4 border-b border-[var(--s-ink-3)] px-4 py-1.5 font-[family-name:var(--s-mono)] text-[11px] font-medium tracking-[0.08em] uppercase">
      <div className="truncate">
        <b className="text-[var(--s-type-1)]">INCIDENT</b>{" "}
        <span className="text-[var(--s-type-3)]">{fire?.name ?? "—"}</span>
      </div>
      <div className="truncate">
        <b className="text-[var(--s-type-1)]">WIND</b>{" "}
        <span className="text-[var(--s-type-3)]">
          {fire ? `${fire.wind_speed} MPH · ${fire.wind_direction}` : "—"}
        </span>
      </div>
      <div className="truncate">
        <b className="text-[var(--s-type-1)]">CONTAINED</b>{" "}
        <span className="text-[var(--s-type-3)] tabular-nums">
          {fire ? `${fire.containment_pct.toFixed(1)}%` : "—"}
        </span>
      </div>
      <div className="truncate">
        <b className="text-[var(--s-type-1)]">GRID</b>{" "}
        <span className="text-[var(--s-type-3)]">34.19° N · 118.13° W</span>
      </div>
      <div className="flex items-center justify-end gap-2 truncate">
        <span className="s-live-dot" />
        <span className="text-[var(--s-hazard)]">LIVE</span>
        <span className="text-[var(--s-ink-3)]">/</span>
        <span className="text-[var(--s-type-3)] tabular-nums">{clock}</span>
      </div>
    </div>
  );
}

function TopNav({
  railOpen,
  onToggleRail,
}: {
  railOpen: boolean;
  onToggleRail: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectorId = searchParams.get("sector");

  return (
    <header className="flex items-center gap-3 border-b-4 border-[var(--s-type-1)] px-3 py-2 md:gap-6 md:px-4 md:py-2.5">
      <button
        type="button"
        onClick={onToggleRail}
        aria-pressed={railOpen}
        aria-label={railOpen ? "Collapse sectors" : "Open sectors"}
        className="s-mono border border-[var(--s-ink-3)] px-2 py-1 text-[10px] tracking-[0.08em] text-[var(--s-type-2)] uppercase md:hidden"
      >
        {railOpen ? "« SECTORS" : "SECTORS »"}
      </button>

      <Link href="/" className="flex items-baseline gap-1.5">
        <span className="s-display text-xl text-[var(--s-type-1)] md:text-2xl">SILOS</span>
        <sup className="s-mono text-[8px] tracking-[0.12em] text-[var(--s-hazard)]">
          LIVE
        </sup>
      </Link>

      <nav className="ml-auto flex gap-1.5 md:ml-0 md:gap-3">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={hrefWithSector(tab.href, sectorId)}
              className={`s-mono border px-2 py-1 text-[10px] font-medium tracking-[0.1em] transition-colors md:px-2.5 md:text-[11px] ${
                active
                  ? "border-[var(--s-type-1)] bg-[var(--s-type-1)] text-[var(--s-ink-0)]"
                  : "border-[var(--s-ink-3)] text-[var(--s-type-2)] hover:border-[var(--s-type-1)] hover:text-[var(--s-type-1)]"
              }`}
            >
              [ {tab.label} ]
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
