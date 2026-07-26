import type { Metadata } from "next";
import { RoleEntry } from "@/components/silos/RoleEntry";

export const metadata: Metadata = {
  title: "SILOS — Live relief coordination",
  description:
    "Live wildfire relief ops: predicted spread, sector priority, and organization coverage on one shared map.",
};

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap";

/**
 * Onboarding step 1 — paper-brutalist entry. Red "SELECT YOUR DESK" CTA
 * routes to `/desk` for role selection, then into the ops room.
 */
export default function OnboardingPage() {
  return (
    <div className="onb flex min-h-screen flex-col overflow-hidden">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_URL} rel="stylesheet" />

      {/* top register strip */}
      <div className="onb-mono grid grid-cols-5 gap-5 border-y border-[var(--onb-ink)] px-6 py-2">
        <div className="truncate">
          <b>SYS.</b> <span className="text-[var(--onb-ink-soft)]">SILOS / OPS</span>
        </div>
        <div className="truncate">
          <b>INC.</b> <span className="text-[var(--onb-ink-soft)]">EATON FIRE</span>
        </div>
        <div className="truncate">
          <b>LAT.</b> <span className="text-[var(--onb-ink-soft)]">34.1880° N</span>
        </div>
        <div className="truncate">
          <b>LON.</b> <span className="text-[var(--onb-ink-soft)]">−118.1180° W</span>
        </div>
        <div className="truncate text-right">
          <b>STATUS</b>{" "}
          <span className="text-[var(--onb-hazard)]">⬤ LIVE</span>
        </div>
      </div>

      {/* brand only — ops nav / channel chip removed */}
      <header className="border-b-4 border-[var(--onb-ink)] px-6 py-3.5">
        <span className="onb-display text-2xl">
          SILOS
          <sup className="onb-mono ml-1 align-top text-[9px] text-[var(--onb-hazard)]">
            LIVE
          </sup>
        </span>
      </header>

      {/* hero: rotating instrument left, briefing column right */}
      <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.15fr_1fr]">
        <section className="relative flex flex-col items-center justify-center gap-5 overflow-hidden p-10 pb-12">
          <div className="relative aspect-square w-[min(64vh,90%)]">
            <div className="onb-ring" />
            <div
              className="onb-ring"
              style={{
                inset: "5%",
                animationDuration: "90s",
                animationDirection: "reverse",
                borderColor: "rgba(6,6,6,0.3)",
              }}
            />
            <div
              className="onb-ring"
              style={{
                inset: "11%",
                animationDuration: "180s",
                borderStyle: "dashed",
                borderColor: "rgba(6,6,6,0.22)",
              }}
            />
            <div
              className="onb-ring"
              style={{
                inset: "19%",
                animationDuration: "36s",
                borderColor: "rgba(6,6,6,0.12)",
              }}
            />

            <div
              className="absolute inset-[23%]"
              style={{ animation: "onb-spin 38s linear infinite reverse" }}
            >
              <svg viewBox="0 0 200 200" aria-hidden className="h-full w-full">
                <circle
                  cx="100"
                  cy="100"
                  r="92"
                  fill="var(--onb-paper-2)"
                  stroke="rgba(6,6,6,0.35)"
                  strokeWidth="0.7"
                />
                <g fill="none" stroke="rgba(6,6,6,0.4)" strokeWidth="0.7">
                  <ellipse cx="100" cy="100" rx="92" ry="20" />
                  <ellipse cx="100" cy="100" rx="92" ry="48" />
                  <ellipse cx="100" cy="100" rx="92" ry="78" />
                  <ellipse cx="100" cy="100" rx="20" ry="92" />
                  <ellipse cx="100" cy="100" rx="48" ry="92" />
                  <ellipse cx="100" cy="100" rx="78" ry="92" />
                </g>
                <path
                  d="M 100 100 L 148 52 A 68 68 0 0 1 168 100 Z"
                  fill="rgba(230,25,25,0.28)"
                  stroke="rgba(230,25,25,0.8)"
                  strokeWidth="1"
                />
                <g fill="rgba(6,6,6,0.24)" stroke="rgba(6,6,6,0.5)" strokeWidth="0.6">
                  <path d="M 60 74 Q 76 62 94 68 L 104 82 Q 96 94 82 98 L 66 94 Q 56 86 60 74 Z" />
                  <path d="M 56 112 Q 74 112 86 126 Q 82 142 66 150 Q 52 138 56 112 Z" />
                  <path d="M 104 122 Q 124 116 144 128 Q 140 144 122 152 Q 104 144 104 122 Z" />
                </g>
              </svg>
            </div>

            <div className="onb-focal-dot" />

            <span className="onb-mono absolute top-[6%] left-1/2 -translate-x-1/2 text-[24px] font-semibold tracking-[0.12em] text-[var(--onb-ink-soft)] md:text-[30px]">
              SPREAD · T+6H
            </span>
          </div>
          <span className="onb-display w-max text-center text-[clamp(32px,4.2vw,56px)] leading-none tracking-[0.04em] text-[var(--onb-hazard)]">
            ⬤ EATON · 34.19N 118.13W
          </span>
        </section>

        <section className="flex flex-col overflow-y-auto border-l border-[var(--onb-ink)] p-8">
          <div className="flex flex-col gap-6">
            <span className="onb-mono">
              <span className="text-[var(--onb-hazard)]">[</span> ACTIVE INCIDENT · RELIEF
              DESK <span className="text-[var(--onb-hazard)]">]</span>
            </span>

            <h1 className="onb-display onb-type-in text-[clamp(44px,5.2vw,76px)]">
              Aid before the&nbsp;ask<span className="text-[var(--onb-hazard)]">.</span>
            </h1>

            <p className="onb-body max-w-[44ch] text-[20px] leading-[1.7] md:text-[22px]">
              The Eaton Fire is pushing into Altadena. SILOS reads predicted spread,
              ranks neighborhood sectors by vulnerability, and lets relief organizations
              claim coverage{" "}
              <em className="not-italic font-medium text-[var(--onb-hazard)]">
                before requests come in
              </em>
              . One shared map — every desk sees the same gaps.
            </p>
          </div>

          {/* Shifted down to sit with the CTA */}
          <div className="mt-auto flex flex-col gap-4 pt-10">
            <div>
              <div className="onb-meta-row">
                <b>PREDICT</b>
                <span>Spread model → sector priority by ETA &amp; vulnerability</span>
              </div>
              <div className="onb-meta-row">
                <b>CLAIM</b>
                <span>Orgs claim sectors on the live map — gaps stay visible</span>
              </div>
              <div className="onb-meta-row">
                <b>COORD</b>
                <span>Sector threads replace cross-org phone trees</span>
              </div>
              <div className="onb-meta-row border-b border-[var(--onb-ink)]">
                <b>FEED</b>
                <span>Live fire vitals · sector status · org claims</span>
              </div>
            </div>

            <RoleEntry />
          </div>
        </section>
      </main>

      <footer className="onb-mono flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--onb-ink)] px-6 py-2.5">
        <span>
          SIGNAL · <span className="text-[var(--onb-hazard)]">LIVE</span>
        </span>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-right text-[var(--onb-ink-soft)]">
          <span>DESK CLEARANCE REQUIRED BEFORE THE LIVE MAP UNLOCKS</span>
          <span className="text-[var(--onb-ink)]">BROADCASTING / 0001</span>
        </span>
      </footer>
    </div>
  );
}
