/**
 * Baseline incident data + timed feed sequence for the SILOS ops room.
 *
 * Grounding (see handoff): the certification gap is real — during the 2025
 * Eaton Fire response, only 2 of 45 partner orgs (Samaritan's Purse and
 * Southern Baptist Disaster Relief) were certified for ash/debris search.
 * Real org names are used; feed text is written in live-ops voice.
 */
import type {
  FeedEventType,
  Org,
  Sector,
  SectorAidNeed,
  SectorFacility,
  SectorRoadAccess,
  SectorPriority,
} from "@/lib/silos/types";
import { FACILITIES, SECTOR_POLYGONS } from "@/lib/silos/mock/geo";

export const FIRE_BASE = {
  id: "fire-eaton-sim",
  name: "Eaton Fire",
  containment_pct: 0,
  wind_speed: 38,
  wind_direction: "NE",
};

type SectorBase = Omit<Sector, "boundary_geojson" | "coverage_status" | "assigned_org_id"> & {
  summary: string;
  road_access: SectorRoadAccess;
  aid_types_needed: SectorAidNeed[];
};

export const SECTOR_BASE: SectorBase[] = [
  {
    id: "S1",
    name: "Eaton Canyon / Canyon Close",
    priority: "critical",
    vulnerable_summary: { elderly_pct: 19, no_vehicle_pct: 6, language_barrier_pct: 5 },
    predicted_aid_types: ["evacuation transport", "animal evacuation"],
    predicted_household_count: 410,
    eta_hours: 0,
    summary:
      "Fire front active at canyon mouth. Dead-end canyon streets; residents evacuating under order.",
    road_access: {
      rating: "constrained",
      single_access_roads: ["Canyon Close Rd"],
      notes: ["Canyon streets dead-end uphill; one egress to Altadena Dr."],
    },
    aid_types_needed: [
      { type: "evacuation transport", status: "needed", detail: "Pickup support for households without vehicles on canyon streets." },
      { type: "animal evacuation", status: "planned", detail: "Horse properties along the canyon rim." },
    ],
  },
  {
    id: "S2",
    name: "Kinneloa / East Altadena",
    priority: "critical",
    vulnerable_summary: { elderly_pct: 24, no_vehicle_pct: 8, language_barrier_pct: 7 },
    predicted_aid_types: ["evacuation transport", "wellness checks"],
    predicted_household_count: 760,
    eta_hours: 3,
    summary:
      "Directly downwind of the fire front. Kinneloa Mesa has a single winding egress road.",
    road_access: {
      rating: "constrained",
      single_access_roads: ["Kinneloa Mesa Rd"],
      notes: ["Mesa egress is single-lane in sections; congestion risk during evacuation."],
    },
    aid_types_needed: [
      { type: "evacuation transport", status: "needed", detail: "High elderly share; door-knock wellness checks requested." },
      { type: "wellness checks", status: "needed", detail: "Unconfirmed evacuations on mesa properties." },
    ],
  },
  {
    id: "S3",
    name: "Altadena Central / Lake Ave",
    priority: "monitor",
    vulnerable_summary: { elderly_pct: 22, no_vehicle_pct: 18, language_barrier_pct: 21 },
    predicted_aid_types: ["shelter intake", "language outreach", "evacuation transport"],
    predicted_household_count: 1830,
    eta_hours: 5,
    summary:
      "Densest sector in the spread path. High no-vehicle and language-barrier share; nursing facility and school in sector.",
    road_access: {
      rating: "moderate",
      single_access_roads: ["Upper Lake Ave (north of Altadena Dr)"],
      notes: ["Lake Ave southbound is the primary evacuation corridor; expect saturation."],
    },
    aid_types_needed: [
      { type: "shelter intake", status: "needed", detail: "Projected 400+ households seeking shelter within 6h." },
      { type: "language outreach", status: "needed", detail: "Spanish and Armenian door-to-door alerts requested." },
      { type: "evacuation transport", status: "needed", detail: "18% no-vehicle households; accessible transport for nursing facility." },
    ],
  },
  {
    id: "S4",
    name: "Altadena West / Lincoln Ave",
    priority: "monitor",
    vulnerable_summary: { elderly_pct: 18, no_vehicle_pct: 22, language_barrier_pct: 14 },
    predicted_aid_types: ["evacuation transport", "shelter intake"],
    predicted_household_count: 1540,
    eta_hours: 11,
    summary:
      "West of the projected 12h spread edge. Highest no-vehicle share in the operating area; disability services center in sector.",
    road_access: {
      rating: "open",
      single_access_roads: [],
      notes: ["Grid streets with multiple egress routes to the 210 corridor."],
    },
    aid_types_needed: [
      { type: "evacuation transport", status: "needed", detail: "22% no-vehicle households; pre-position accessible vehicles." },
      { type: "shelter intake", status: "planned", detail: "Secondary intake if S3 shelters saturate." },
    ],
  },
  {
    id: "S5",
    name: "Janes Village / Upper Mariposa",
    priority: "monitor",
    vulnerable_summary: { elderly_pct: 21, no_vehicle_pct: 9, language_barrier_pct: 8 },
    predicted_aid_types: ["wellness checks"],
    predicted_household_count: 620,
    eta_hours: 10,
    summary:
      "Foothill-adjacent residential pocket inside the 12h spread cone; ember-cast risk ahead of the front.",
    road_access: {
      rating: "moderate",
      single_access_roads: [],
      notes: ["North-edge streets abut wildland interface."],
    },
    aid_types_needed: [
      { type: "wellness checks", status: "planned", detail: "Older housing stock; confirm evacuations on north-edge streets." },
    ],
  },
  {
    id: "S6",
    name: "Woodbury / Country Club",
    priority: "warning",
    vulnerable_summary: { elderly_pct: 27, no_vehicle_pct: 12, language_barrier_pct: 10 },
    predicted_aid_types: ["wellness checks", "shelter intake", "medical support"],
    predicted_household_count: 1120,
    eta_hours: 9,
    summary:
      "Highest elderly share in the operating area; assisted-living facility and senior center in sector.",
    road_access: {
      rating: "open",
      single_access_roads: [],
      notes: ["Good egress; facility transfers are the constraint, not roads."],
    },
    aid_types_needed: [
      { type: "medical support", status: "needed", detail: "Assisted-living transfer support if spread continues south." },
      { type: "wellness checks", status: "needed", detail: "High share of residents aging in place." },
      { type: "shelter intake", status: "planned", detail: "Senior-capable shelter capacity required." },
    ],
  },
  {
    id: "S7",
    name: "The Meadows / Chaney Trail",
    priority: "warning",
    vulnerable_summary: { elderly_pct: 29, no_vehicle_pct: 7, language_barrier_pct: 4 },
    predicted_aid_types: ["debris search", "wellness checks", "evacuation transport"],
    predicted_household_count: 340,
    eta_hours: 14,
    summary:
      "Single-access foothill neighborhood (Chaney Trail only). Early burn impact on structures; ash/debris search will be required — certified teams only.",
    road_access: {
      rating: "constrained",
      single_access_roads: ["Chaney Trail"],
      notes: [
        "One access road for the entire neighborhood.",
        "CA law bars untrained volunteers from ash/debris search (hazardous material).",
      ],
    },
    aid_types_needed: [
      { type: "debris search", status: "needed", detail: "Requires state certification — only 2 of 45 partner orgs qualify statewide." },
      { type: "wellness checks", status: "needed", detail: "Retirement community at end of the single access road." },
      { type: "evacuation transport", status: "planned", detail: "Stage at Chaney Trail junction; no turnaround uphill." },
    ],
  },
  {
    id: "S8",
    name: "Pasadena North / Washington Blvd",
    priority: "monitor",
    vulnerable_summary: { elderly_pct: 15, no_vehicle_pct: 16, language_barrier_pct: 18 },
    predicted_aid_types: ["shelter intake", "language outreach"],
    predicted_household_count: 2100,
    eta_hours: null,
    summary:
      "Outside the current spread model. Primary receiving area — shelter and resource-hub demand will concentrate here.",
    road_access: {
      rating: "open",
      single_access_roads: [],
      notes: ["Receiving corridor; proposed emergency shelter site in sector."],
    },
    aid_types_needed: [
      { type: "shelter intake", status: "planned", detail: "Forecast intake demand from S1–S3 evacuations; avoid the untracked-turnout capacity wall." },
      { type: "language outreach", status: "planned", detail: "Multilingual intake staffing for the resource hub." },
    ],
  },
];

export const ORGS: Org[] = [
  {
    id: "org-salvation-army",
    name: "The Salvation Army",
    category: "Mass care / feeding",
    certifications: ["shelter operations", "mobile feeding"],
    capacity_status: "available",
    active_sectors: [],
  },
  {
    id: "org-red-cross",
    name: "American Red Cross — LA Region",
    category: "Shelter / mass care",
    certifications: ["shelter operations", "reunification"],
    capacity_status: "stretched",
    active_sectors: [],
  },
  {
    id: "org-team-rubicon",
    name: "Team Rubicon",
    category: "Debris / heavy work",
    certifications: ["chainsaw operations", "route clearance"],
    capacity_status: "available",
    active_sectors: [],
  },
  {
    id: "org-samaritans-purse",
    name: "Samaritan's Purse",
    category: "Recovery / debris",
    certifications: ["ash & debris search (state certified)", "chainsaw operations"],
    capacity_status: "available",
    active_sectors: [],
  },
  {
    id: "org-sbdr",
    name: "Southern Baptist Disaster Relief",
    category: "Recovery / feeding",
    certifications: ["ash & debris search (state certified)", "mobile feeding"],
    capacity_status: "stretched",
    active_sectors: [],
  },
];

/** Names for feed copy. */
export const ORG_NAMES: Record<string, string> = Object.fromEntries(
  ORGS.map((org) => [org.id, org.name]),
);

export type ScriptStep = {
  /** seconds after demo start */
  at: number;
  event: {
    type: FeedEventType;
    sector_id: string | null;
    text: string;
  };
  /** state mutations applied when the step becomes active */
  effects?: {
    sector_id: string;
    priority?: SectorPriority;
    coverage_status?: "unassigned" | "claimed" | "active";
    assigned_org_id?: string | null;
  }[];
};

/**
 * Deterministic demo sequence (the stage "happy path"):
 * fire loads -> sectors escalate -> Salvation Army claims S3 ->
 * certification gap detected in S7 -> Samaritan's Purse fills it.
 */
export const SCRIPT: ScriptStep[] = [
  {
    at: 0,
    event: {
      type: "predictive_alert",
      sector_id: "S1",
      text: "Spread model run #12: front moving SW from Eaton Canyon at 2.1 mph under 38 mph NE gusts.",
    },
  },
  {
    at: 18,
    event: {
      type: "predictive_alert",
      sector_id: "S3",
      text: "S3 Altadena Central escalated to CRITICAL — projected impact in 5h; 1,830 households, 18% without vehicles.",
    },
    effects: [{ sector_id: "S3", priority: "critical" }],
  },
  {
    at: 40,
    event: {
      type: "predictive_alert",
      sector_id: "S6",
      text: "S6 Woodbury flagged: assisted-living facility inside 9h spread cone — medical transfer support will be needed.",
    },
    effects: [{ sector_id: "S6", priority: "critical" }],
  },
  {
    at: 62,
    event: {
      type: "claim",
      sector_id: "S3",
      text: "The Salvation Army claimed S3 Altadena Central (shelter intake + feeding).",
    },
    effects: [
      { sector_id: "S3", coverage_status: "claimed", assigned_org_id: "org-salvation-army" },
    ],
  },
  {
    at: 84,
    event: {
      type: "message",
      sector_id: "S3",
      text: "The Salvation Army — advance team staging at Lake & Mariposa; shelter intake opens in 40 min.",
    },
  },
  {
    at: 108,
    event: {
      type: "gap_detected",
      sector_id: "S7",
      text: "GAP: S7 The Meadows needs certified ash/debris search — only 2 of 45 partner orgs are state-certified, none assigned.",
    },
    effects: [{ sector_id: "S7", priority: "critical" }],
  },
  {
    at: 128,
    event: {
      type: "message",
      sector_id: "S7",
      text: "Cal OES liaison — requesting a certified debris-search team for S7; note Chaney Trail is the only access road.",
    },
  },
  {
    at: 150,
    event: {
      type: "claim",
      sector_id: "S7",
      text: "Samaritan's Purse claimed S7 The Meadows (certified ash & debris search).",
    },
    effects: [
      { sector_id: "S7", coverage_status: "claimed", assigned_org_id: "org-samaritans-purse" },
    ],
  },
  {
    at: 172,
    event: {
      type: "message",
      sector_id: "S7",
      text: "Samaritan's Purse — certified assessment team en route; staging at the Chaney Trail junction.",
    },
  },
  {
    at: 195,
    event: {
      type: "claim",
      sector_id: "S3",
      text: "S3 Altadena Central is now ACTIVE — Salvation Army shelter intake operating.",
    },
    effects: [
      { sector_id: "S3", coverage_status: "active", assigned_org_id: "org-salvation-army" },
    ],
  },
  {
    at: 220,
    event: {
      type: "predictive_alert",
      sector_id: "S4",
      text: "S4 Altadena West will need coverage within 8h — 22% no-vehicle households; pre-position accessible transport now.",
    },
    effects: [{ sector_id: "S4", priority: "warning" }],
  },
];

export function facilitiesForSector(sectorId: string): SectorFacility[] {
  return FACILITIES.features
    .filter((feature) => feature.properties.sector === sectorId)
    .map((feature) => ({
      id: feature.properties.id,
      name: feature.properties.name,
      type: feature.properties.ftype as SectorFacility["type"],
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
    }));
}

export function sectorPolygon(sectorId: string) {
  return SECTOR_POLYGONS[sectorId];
}
