import type { SectorPriority } from "@/lib/silos/types";

export const PRIORITY_ORDER: Record<SectorPriority, number> = {
  critical: 0,
  warning: 1,
  monitor: 2,
};

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.floor(minutes / 60)}h ago`;
}

export function etaLabel(etaHours: number | null): string {
  if (etaHours === null) {
    return "Outside spread model";
  }
  if (etaHours === 0) {
    return "Fire front active";
  }
  return `Fire ETA ~${etaHours}h`;
}
