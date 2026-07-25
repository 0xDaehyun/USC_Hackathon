"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SilosRole } from "@/lib/silos/types";
import { ROLE_SHORT, SILOS_ROLE_STORAGE_KEY } from "@/lib/silos/ui";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap";

const ENTRIES: {
  role: SilosRole;
  title: string;
  description: string;
}[] = [
  {
    role: "coordinator",
    title: "Coordinator",
    description: "Claim sectors · close coverage gaps · run the wire",
  },
  {
    role: "emergency_manager",
    title: "Emergency manager",
    description: "Set priority · clear road access · authorize transfers",
  },
  {
    role: "volunteer",
    title: "Volunteer",
    description: "Take field tasks · confirm wellness · report status",
  },
];

/**
 * Step-2 onboarding — desk selection as a raw-grid name/description list
 * (html-ppt-zhangzara-raw-grid list-item pattern), brutal SILOS type retained.
 */
export default function DeskSelectPage() {
  const router = useRouter();

  const enter = (role: SilosRole) => {
    try {
      window.localStorage.setItem(SILOS_ROLE_STORAGE_KEY, role);
    } catch {
      /* private mode */
    }
    router.push(`/map?role=${encodeURIComponent(role)}`);
  };

  return (
    <div className="onb flex min-h-screen flex-col">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_URL} rel="stylesheet" />

      <div className="onb-mono flex items-center justify-between border-b border-[var(--onb-ink)] px-5 py-2.5">
        <span>
          <b>SYS.</b> <span className="text-[var(--onb-ink-soft)]">SILOS / DESK CLEARANCE</span>
        </span>
        <Link href="/" className="hover:text-[var(--onb-hazard)]">
          ← BACK
        </Link>
      </div>

      <header className="border-b-4 border-[var(--onb-ink)] px-5 py-5 md:px-10">
        <p className="onb-mono text-[var(--onb-hazard)]">[ STEP 02 / DESK ]</p>
        <h1 className="onb-display mt-3 text-[clamp(32px,6vw,64px)]">
          Select your desk
          <span className="text-[var(--onb-hazard)]">.</span>
        </h1>
        <p className="onb-body mt-3 max-w-[48ch]">
          Choose how you enter the ops room. Same live map for every desk — gaps
          stay visible.
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {ENTRIES.map(({ role, title, description }, index) => (
          <button
            key={role}
            type="button"
            onClick={() => enter(role)}
            className="group flex flex-1 flex-col justify-center border-b border-[var(--onb-ink)] px-5 py-6 text-left transition-colors last:border-b-0 hover:bg-[var(--onb-ink)] hover:text-[var(--onb-paper)] md:px-10 md:py-8"
          >
            <div className="flex items-baseline gap-3">
              <span className="onb-mono text-[12px] tracking-[0.14em] text-[var(--onb-hazard)] group-hover:text-[var(--onb-hazard)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="onb-mono text-[12px] tracking-[0.18em] text-[var(--onb-hazard)]">
                [ {ROLE_SHORT[role]} ]
              </span>
            </div>
            <div className="mt-3 flex items-start gap-3 md:gap-4">
              <span className="onb-display shrink-0 text-[22px] text-[var(--onb-ink)] group-hover:text-[var(--onb-paper)] md:text-[28px]">
                →
              </span>
              <div className="min-w-0">
                <p className="onb-display text-[clamp(22px,3.5vw,36px)] tracking-[-0.02em] text-[var(--onb-ink)] group-hover:text-[var(--onb-paper)]">
                  {title}
                </p>
                <p className="onb-body mt-2 max-w-[52ch] text-[15px] text-[var(--onb-ink-soft)] group-hover:text-[var(--onb-paper)]">
                  {description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </main>

      <footer className="onb-mono border-t border-[var(--onb-ink)] px-5 py-2.5 text-[var(--onb-ink-soft)]">
        SELECT A DESK TO ENTER THE OPS ROOM
      </footer>
    </div>
  );
}
