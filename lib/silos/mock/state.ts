/**
 * In-memory demo state for the mock /api/v1 routes.
 *
 * A demo clock starts on first request; the scripted timeline in
 * `data.ts` unlocks feed events and sector-state changes as time elapses,
 * so the live demo plays the same way every run. POST /claim and
 * POST /messages layer live mutations on top (presenter interactions win
 * over the script for the same sector). POST /api/v1/demo/reset restarts
 * the clock for rehearsals. State lives on globalThis so dev-server HMR
 * does not fork it. Nothing persists across server restarts — demo only.
 */
import {
  FIRE_BASE,
  ORGS,
  ORG_NAMES,
  SCRIPT,
  SECTOR_BASE,
  facilitiesForSector,
} from "@/lib/silos/mock/data";
import {
  FIRE_BOUNDARY,
  PREDICTION_STEPS,
  SECTOR_POLYGONS,
} from "@/lib/silos/mock/geo";
import type {
  CoverageStatus,
  FeedEvent,
  Fire,
  FirePrediction,
  Org,
  Sector,
  SectorDetail,
  SectorPriority,
} from "@/lib/silos/types";

type SectorOverride = {
  priority?: SectorPriority;
  coverage_status?: CoverageStatus;
  assigned_org_id?: string | null;
};

type DemoState = {
  startedAt: number;
  /** live mutations from POSTs; take precedence over the script */
  liveOverrides: Map<string, SectorOverride>;
  liveEvents: FeedEvent[];
  eventSeq: number;
};

const STATE_KEY = "__silosDemoState";

function getState(): DemoState {
  const holder = globalThis as typeof globalThis & {
    [STATE_KEY]?: DemoState;
  };
  if (!holder[STATE_KEY]) {
    holder[STATE_KEY] = {
      startedAt: Date.now(),
      liveOverrides: new Map(),
      liveEvents: [],
      eventSeq: 0,
    };
  }
  return holder[STATE_KEY];
}

export function resetDemo(): { demo_started_at: string } {
  const state = getState();
  state.startedAt = Date.now();
  state.liveOverrides = new Map();
  state.liveEvents = [];
  state.eventSeq = 0;
  return { demo_started_at: new Date(state.startedAt).toISOString() };
}

function elapsedSeconds(): number {
  return (Date.now() - getState().startedAt) / 1000;
}

function scriptedOverrides(elapsed: number): Map<string, SectorOverride> {
  const merged = new Map<string, SectorOverride>();
  for (const step of SCRIPT) {
    if (step.at > elapsed || !step.effects) {
      continue;
    }
    for (const effect of step.effects) {
      merged.set(effect.sector_id, {
        ...merged.get(effect.sector_id),
        ...(effect.priority !== undefined && { priority: effect.priority }),
        ...(effect.coverage_status !== undefined && {
          coverage_status: effect.coverage_status,
        }),
        ...(effect.assigned_org_id !== undefined && {
          assigned_org_id: effect.assigned_org_id,
        }),
      });
    }
  }
  return merged;
}

export function getFire(): Fire {
  const elapsed = elapsedSeconds();
  // Dummy containment ticks every ~5s so the register CONTAINED % reads live.
  // Caps early so the demo never pretends the fire is under control.
  const steps = Math.min(16, Math.floor(elapsed / 5));
  const containment = steps / 2;
  return {
    ...FIRE_BASE,
    containment_pct: containment,
    start_time: new Date(getState().startedAt - 5 * 3600 * 1000).toISOString(),
    boundary_geojson: FIRE_BOUNDARY,
  };
}

export function getPrediction(): FirePrediction {
  return {
    hourly_steps: PREDICTION_STEPS.map((step) => ({
      hour_offset: step.hour_offset,
      spread_polygon_geojson: step.polygon,
    })),
  };
}

export function getSectors(): Sector[] {
  const state = getState();
  const scripted = scriptedOverrides(elapsedSeconds());
  return SECTOR_BASE.map((base) => {
    const override = {
      ...scripted.get(base.id),
      ...state.liveOverrides.get(base.id),
    };
    return {
      id: base.id,
      name: base.name,
      priority: override.priority ?? base.priority,
      vulnerable_summary: base.vulnerable_summary,
      predicted_aid_types: base.predicted_aid_types,
      predicted_household_count: base.predicted_household_count,
      coverage_status: override.coverage_status ?? "unassigned",
      assigned_org_id: override.assigned_org_id ?? null,
      eta_hours: base.eta_hours,
      boundary_geojson: SECTOR_POLYGONS[base.id],
    };
  });
}

export function getSectorDetail(id: string): SectorDetail | null {
  const sector = getSectors().find((candidate) => candidate.id === id);
  const base = SECTOR_BASE.find((candidate) => candidate.id === id);
  if (!sector || !base) {
    return null;
  }
  return {
    ...sector,
    summary: base.summary,
    facilities: facilitiesForSector(id),
    road_access: base.road_access,
    aid_types_needed: base.aid_types_needed,
  };
}

export function getOrgs(): Org[] {
  const sectors = getSectors();
  return ORGS.map((org) => ({
    ...org,
    active_sectors: sectors
      .filter((sector) => sector.assigned_org_id === org.id)
      .map((sector) => sector.id),
  }));
}

export function getFeed(): FeedEvent[] {
  const state = getState();
  const elapsed = elapsedSeconds();
  const scripted: FeedEvent[] = SCRIPT.filter((step) => step.at <= elapsed).map(
    (step, index) => ({
      id: `script-${index}`,
      timestamp: new Date(state.startedAt + step.at * 1000).toISOString(),
      type: step.event.type,
      sector_id: step.event.sector_id,
      text: step.event.text,
    }),
  );
  return [...scripted, ...state.liveEvents].sort((a, b) =>
    a.timestamp < b.timestamp ? 1 : -1,
  );
}

export function claimSector(
  sectorId: string,
  orgId: string,
  role: string,
): { ok: boolean; error?: string } {
  const base = SECTOR_BASE.find((candidate) => candidate.id === sectorId);
  if (!base) {
    return { ok: false, error: `Unknown sector ${sectorId}.` };
  }
  const orgName = ORG_NAMES[orgId] ?? orgId;
  const state = getState();
  state.liveOverrides.set(sectorId, {
    ...state.liveOverrides.get(sectorId),
    coverage_status: "claimed",
    assigned_org_id: orgId,
  });
  pushLiveEvent("claim", sectorId, `${orgName} claimed ${sectorId} ${base.name} (${role}).`);
  return { ok: true };
}

export function postMessage(
  sectorId: string,
  orgId: string,
  text: string,
): { ok: boolean; error?: string } {
  if (!SECTOR_BASE.some((candidate) => candidate.id === sectorId)) {
    return { ok: false, error: `Unknown sector ${sectorId}.` };
  }
  const orgName = ORG_NAMES[orgId] ?? orgId;
  pushLiveEvent("message", sectorId, `${orgName} — ${text}`);
  return { ok: true };
}

function pushLiveEvent(
  type: FeedEvent["type"],
  sectorId: string,
  text: string,
): void {
  const state = getState();
  state.eventSeq += 1;
  state.liveEvents.push({
    id: `live-${state.eventSeq}`,
    timestamp: new Date().toISOString(),
    type,
    sector_id: sectorId,
    text,
  });
}
