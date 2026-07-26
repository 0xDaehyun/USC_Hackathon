import type { Metadata } from "next";
import { Suspense } from "react";
import { SilosShell } from "@/components/silos/Shell";

export const metadata: Metadata = {
  title: "SILOS — Wildfire relief coordination",
  description:
    "Live wildfire relief coordination: predicted spread, sector priority, and organization coverage on one shared map.",
};

export default function SilosLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <SilosShell>{children}</SilosShell>
    </Suspense>
  );
}
