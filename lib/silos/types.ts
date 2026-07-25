/**
 * SILOS API contract types.
 *
 * These mirror the /api/v1 responses exactly (snake_case preserved) so the
 * real backend can be swapped in with a base-URL change only.
 *
 * Additive extension vs. the written handoff contract:
 * - `Sector.boundary_geojson` — the map cannot draw sector polygons without
 *   geometry, so sector objects carry their polygon. Backend must include it.
 *
 * Mock /api/v1 routes serve an in-memory Eaton Fire incident for local and
 * staged runs until a live backend is wired in.
 */
import type { Feature, Polygon } from "geojson";

export type SectorPriority = "critical" | "warning" | "monitor";
export type CoverageStatus = "unassigned" | "claimed" | "active";
export type OrgCapacityStatus = "available" | "stretched" | "unavailable";
export type FeedEventType =
  | "claim"
  | "gap_detected"
  | "predictive_alert"
  | "message";

export type Fire = {
  id: string;
  name: string;
  start_time: string;
  containment_pct: number;
  boundary_geojson: Feature<Polygon>;
  /** mph */
  wind_speed: number;
  /** compass direction the wind blows FROM, e.g. "NE" for Santa Ana */
  wind_direction: string;
};

export type FirePredictionStep = {
  hour_offset: number;
  spread_polygon_geojson: Feature<Polygon>;
};

export type FirePrediction = {
  hourly_steps: FirePredictionStep[];
};

export type VulnerableSummary = {
  elderly_pct: number;
  no_vehicle_pct: number;
  language_barrier_pct: number;
};

export type Sector = {
  id: string;
  name: string;
  priority: SectorPriority;
  vulnerable_summary: VulnerableSummary;
  predicted_aid_types: string[];
  predicted_household_count: number;
  coverage_status: CoverageStatus;
  assigned_org_id: string | null;
  /** predicted fire arrival, null = outside current spread model */
  eta_hours: number | null;
  boundary_geojson: Feature<Polygon>;
};

export type FacilityType =
  | "nursing_home"
  | "disability_facility"
  | "school"
  | "senior_center"
  | "shelter";

export type SectorFacility = {
  id: string;
  name: string;
  type: FacilityType;
  lat: number;
  lng: number;
};

export type SectorAidNeed = {
  type: string;
  status: "needed" | "planned" | "covered";
  detail: string;
};

export type SectorRoadAccess = {
  rating: "constrained" | "moderate" | "open";
  single_access_roads: string[];
  notes: string[];
};

export type SectorDetail = Sector & {
  summary: string;
  facilities: SectorFacility[];
  road_access: SectorRoadAccess;
  aid_types_needed: SectorAidNeed[];
};

export type Org = {
  id: string;
  name: string;
  category: string;
  certifications: string[];
  capacity_status: OrgCapacityStatus;
  active_sectors: string[];
};

export type FeedEvent = {
  id: string;
  timestamp: string;
  type: FeedEventType;
  sector_id: string | null;
  text: string;
};

export type ClaimRequest = {
  org_id: string;
  role: string;
};

export type MessageRequest = {
  sector_id: string;
  org_id: string;
  text: string;
};

/** UI-only: persona emphasis, never a separate page (see handoff). */
export type SilosRole = "coordinator" | "emergency_manager" | "volunteer";
