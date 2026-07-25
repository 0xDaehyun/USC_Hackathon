"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SilosRole } from "@/lib/silos/types";

export const SILOS_ROLE_STORAGE_KEY = "silos-role";

type SilosUiState = {
  role: SilosRole;
  setRole: (role: SilosRole) => void;
  /** org the operator acts as when claiming / messaging */
  actingOrgId: string;
  setActingOrgId: (orgId: string) => void;
};

const SilosUiContext = createContext<SilosUiState | null>(null);

const ROLES: SilosRole[] = ["coordinator", "emergency_manager", "volunteer"];

function isSilosRole(value: string | null | undefined): value is SilosRole {
  return !!value && (ROLES as string[]).includes(value);
}

function readStoredRole(): SilosRole {
  if (typeof window === "undefined") {
    return "coordinator";
  }
  try {
    const stored = window.localStorage.getItem(SILOS_ROLE_STORAGE_KEY);
    if (isSilosRole(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "coordinator";
}

export function SilosUiProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const queryRole = searchParams.get("role");
  const [manualRole, setManualRole] = useState<SilosRole | null>(null);
  const [storedRole] = useState(readStoredRole);
  const [actingOrgId, setActingOrgId] = useState("org-red-cross");

  const role: SilosRole =
    manualRole ?? (isSilosRole(queryRole) ? queryRole : storedRole);

  useEffect(() => {
    if (!isSilosRole(queryRole)) {
      return;
    }
    try {
      window.localStorage.setItem(SILOS_ROLE_STORAGE_KEY, queryRole);
    } catch {
      /* ignore */
    }
  }, [queryRole]);

  const setRole = (next: SilosRole) => {
    setManualRole(next);
    try {
      window.localStorage.setItem(SILOS_ROLE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return (
    <SilosUiContext.Provider value={{ role, setRole, actingOrgId, setActingOrgId }}>
      {children}
    </SilosUiContext.Provider>
  );
}

export function useSilosUi(): SilosUiState {
  const context = useContext(SilosUiContext);
  if (!context) {
    throw new Error("useSilosUi must be used within SilosUiProvider.");
  }
  return context;
}

/** Short desk codes shown on onboarding and in the ops nav. */
export const ROLE_SHORT: Record<SilosRole, string> = {
  coordinator: "COORD",
  emergency_manager: "MGR",
  volunteer: "VOL",
};

export const ROLE_LABELS: Record<SilosRole, string> = {
  coordinator: "COORD",
  emergency_manager: "MGR",
  volunteer: "VOL",
};

/** Deep-link helper: same tab, selected sector in the query string. */
export function hrefWithSector(pathname: string, sectorId: string | null): string {
  return sectorId ? `${pathname}?sector=${encodeURIComponent(sectorId)}` : pathname;
}
