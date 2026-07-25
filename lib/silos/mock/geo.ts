/**
 * SIMULATED geometry for the SILOS demo, hand-authored on real Eaton Fire /
 * Altadena geography (fire origin at Eaton Canyon, Santa Ana-driven spread
 * to the west/southwest). Shapes approximate real neighborhoods and the
 * documented fire footprint but are NOT official perimeters or census
 * geographies. See data/source-manifest.json (`silos-simulated-demo`).
 */
import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";

function polygon(points: [number, number][]): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[...points, points[0]]],
    },
  };
}

/**
 * Fire boundary at demo T0 — irregular Eaton Canyon mouth into east Altadena.
 * Hand-authored GIS-style perimeter (NOT an official CAL FIRE product).
 */
export const FIRE_BOUNDARY: Feature<Polygon> = polygon([
  [-118.078, 34.214],
  [-118.081, 34.208],
  [-118.079, 34.201],
  [-118.083, 34.193],
  [-118.081, 34.186],
  [-118.086, 34.179],
  [-118.092, 34.175],
  [-118.099, 34.174],
  [-118.105, 34.177],
  [-118.109, 34.183],
  [-118.11, 34.19],
  [-118.107, 34.198],
  [-118.103, 34.205],
  [-118.096, 34.211],
  [-118.088, 34.215],
]);

/** Modeled spread (SIMULATED, not an official forecast) — irregular rings. */
export const PREDICTION_STEPS: { hour_offset: number; polygon: Feature<Polygon> }[] = [
  {
    hour_offset: 3,
    polygon: polygon([
      [-118.075, 34.216],
      [-118.08, 34.206],
      [-118.078, 34.196],
      [-118.084, 34.186],
      [-118.088, 34.176],
      [-118.098, 34.171],
      [-118.11, 34.172],
      [-118.12, 34.178],
      [-118.124, 34.188],
      [-118.121, 34.2],
      [-118.114, 34.21],
      [-118.1, 34.216],
      [-118.088, 34.218],
    ]),
  },
  {
    hour_offset: 6,
    polygon: polygon([
      [-118.072, 34.218],
      [-118.078, 34.205],
      [-118.076, 34.192],
      [-118.082, 34.178],
      [-118.09, 34.168],
      [-118.106, 34.163],
      [-118.122, 34.165],
      [-118.136, 34.172],
      [-118.142, 34.184],
      [-118.138, 34.198],
      [-118.128, 34.21],
      [-118.11, 34.218],
      [-118.09, 34.22],
    ]),
  },
  {
    hour_offset: 12,
    polygon: polygon([
      [-118.07, 34.22],
      [-118.076, 34.204],
      [-118.074, 34.188],
      [-118.08, 34.172],
      [-118.092, 34.16],
      [-118.112, 34.154],
      [-118.132, 34.156],
      [-118.15, 34.164],
      [-118.162, 34.176],
      [-118.164, 34.192],
      [-118.154, 34.208],
      [-118.134, 34.218],
      [-118.108, 34.222],
      [-118.086, 34.222],
    ]),
  },
];

/**
 * Operational sector polygons — irregular neighborhood-scale GIS shapes
 * (still simulated; not official administrative boundaries).
 */
export const SECTOR_POLYGONS: Record<string, Feature<Polygon>> = {
  S1: polygon([
    [-118.104, 34.171],
    [-118.096, 34.17],
    [-118.088, 34.172],
    [-118.083, 34.178],
    [-118.081, 34.186],
    [-118.084, 34.194],
    [-118.092, 34.197],
    [-118.102, 34.196],
    [-118.106, 34.188],
    [-118.105, 34.178],
  ]),
  S2: polygon([
    [-118.118, 34.167],
    [-118.108, 34.166],
    [-118.104, 34.17],
    [-118.103, 34.182],
    [-118.105, 34.194],
    [-118.11, 34.198],
    [-118.118, 34.197],
    [-118.12, 34.186],
    [-118.119, 34.174],
  ]),
  S3: polygon([
    [-118.138, 34.176],
    [-118.128, 34.175],
    [-118.118, 34.178],
    [-118.116, 34.188],
    [-118.118, 34.2],
    [-118.128, 34.203],
    [-118.138, 34.2],
    [-118.14, 34.188],
  ]),
  S4: polygon([
    [-118.16, 34.176],
    [-118.148, 34.175],
    [-118.138, 34.178],
    [-118.136, 34.19],
    [-118.138, 34.202],
    [-118.15, 34.203],
    [-118.16, 34.198],
    [-118.162, 34.186],
  ]),
  S5: polygon([
    [-118.154, 34.2],
    [-118.142, 34.199],
    [-118.132, 34.202],
    [-118.13, 34.21],
    [-118.136, 34.216],
    [-118.148, 34.217],
    [-118.156, 34.212],
    [-118.156, 34.204],
  ]),
  S6: polygon([
    [-118.148, 34.16],
    [-118.132, 34.158],
    [-118.118, 34.16],
    [-118.116, 34.168],
    [-118.12, 34.176],
    [-118.134, 34.178],
    [-118.146, 34.174],
    [-118.15, 34.166],
  ]),
  S7: polygon([
    [-118.174, 34.2],
    [-118.164, 34.198],
    [-118.156, 34.202],
    [-118.155, 34.21],
    [-118.16, 34.218],
    [-118.168, 34.221],
    [-118.176, 34.216],
    [-118.176, 34.206],
  ]),
  S8: polygon([
    [-118.152, 34.148],
    [-118.134, 34.147],
    [-118.116, 34.15],
    [-118.112, 34.158],
    [-118.12, 34.164],
    [-118.138, 34.163],
    [-118.152, 34.158],
  ]),
};

export function sectorCenter(id: string): [number, number] {
  const ring = SECTOR_POLYGONS[id]?.geometry.coordinates[0];
  if (!ring) {
    return [-118.115, 34.19];
  }
  let lng = 0;
  let lat = 0;
  // Skip the closing vertex (duplicate of the first).
  const count = ring.length - 1;
  for (let i = 0; i < count; i += 1) {
    lng += ring[i][0];
    lat += ring[i][1];
  }
  return [lng / count, lat / count];
}

/** Dominant vulnerability class for choropleth coloring. */
export type VulnClass = "elderly" | "no_vehicle" | "language" | "egress" | "mixed";

export type PopulationVulnProps = {
  tract: string;
  svi: number;
  class: VulnClass;
  dominant: string;
};

function vulnPoly(
  points: [number, number][],
  props: PopulationVulnProps,
): Feature<Polygon, PopulationVulnProps> {
  return { ...polygon(points), properties: props };
}

/**
 * Ground-level population-vulnerability polygons (demo choropleth).
 * Colored by dominant vulnerable group until a live ACS feed is wired.
 */
/**
 * Ground-draped vulnerability polygons (demo choropleth). Irregular tract-like
 * shapes — not grid cells. Still simulated until a live ACS feed is wired.
 */
export const POPULATION_VULNERABILITY: FeatureCollection<Polygon, PopulationVulnProps> =
  {
    type: "FeatureCollection",
    features: [
      vulnPoly(
        [
          [-118.136, 34.179],
          [-118.128, 34.178],
          [-118.12, 34.181],
          [-118.118, 34.19],
          [-118.122, 34.198],
          [-118.132, 34.199],
          [-118.138, 34.192],
          [-118.137, 34.184],
        ],
        {
          tract: "Altadena Central",
          svi: 0.86,
          class: "no_vehicle",
          dominant: "No-vehicle households + language barrier",
        },
      ),
      vulnPoly(
        [
          [-118.158, 34.178],
          [-118.148, 34.177],
          [-118.14, 34.182],
          [-118.138, 34.192],
          [-118.144, 34.2],
          [-118.154, 34.199],
          [-118.16, 34.19],
        ],
        {
          tract: "Altadena West",
          svi: 0.78,
          class: "mixed",
          dominant: "Low income + no-vehicle households",
        },
      ),
      vulnPoly(
        [
          [-118.172, 34.202],
          [-118.164, 34.2],
          [-118.158, 34.204],
          [-118.157, 34.212],
          [-118.164, 34.218],
          [-118.172, 34.216],
          [-118.174, 34.208],
        ],
        {
          tract: "The Meadows",
          svi: 0.71,
          class: "elderly",
          dominant: "Elderly residents + single access road",
        },
      ),
      vulnPoly(
        [
          [-118.146, 34.162],
          [-118.134, 34.16],
          [-118.122, 34.163],
          [-118.12, 34.17],
          [-118.126, 34.176],
          [-118.14, 34.176],
          [-118.148, 34.17],
        ],
        {
          tract: "Woodbury corridor",
          svi: 0.64,
          class: "elderly",
          dominant: "Elderly residents + care facilities",
        },
      ),
      vulnPoly(
        [
          [-118.116, 34.168],
          [-118.108, 34.167],
          [-118.104, 34.174],
          [-118.105, 34.188],
          [-118.11, 34.194],
          [-118.116, 34.192],
          [-118.118, 34.178],
        ],
        {
          tract: "East Altadena",
          svi: 0.52,
          class: "egress",
          dominant: "Limited egress routes",
        },
      ),
      vulnPoly(
        [
          [-118.1, 34.175],
          [-118.092, 34.174],
          [-118.086, 34.18],
          [-118.085, 34.19],
          [-118.092, 34.195],
          [-118.1, 34.192],
          [-118.102, 34.182],
        ],
        {
          tract: "Eaton Canyon rim",
          svi: 0.68,
          class: "egress",
          dominant: "Dead-end canyon streets",
        },
      ),
      vulnPoly(
        [
          [-118.138, 34.186],
          [-118.13, 34.185],
          [-118.124, 34.19],
          [-118.126, 34.198],
          [-118.134, 34.199],
          [-118.14, 34.194],
        ],
        {
          tract: "Lake Ave corridor",
          svi: 0.81,
          class: "language",
          dominant: "Language barrier + dense multifamily",
        },
      ),
      vulnPoly(
        [
          [-118.152, 34.166],
          [-118.144, 34.165],
          [-118.138, 34.17],
          [-118.14, 34.178],
          [-118.148, 34.178],
          [-118.154, 34.172],
        ],
        {
          tract: "Lincoln Ave south",
          svi: 0.74,
          class: "no_vehicle",
          dominant: "No-vehicle households",
        },
      ),
    ],
  };

/** Demo 3D building footprints — always available without remote vector tiles. */
export type DummyBuildingProps = { height: number; fireEta: "h6" | "h12" | "clear" };

function buildingBox(
  lng: number,
  lat: number,
  w: number,
  h: number,
  height: number,
  fireEta: DummyBuildingProps["fireEta"],
): Feature<Polygon, DummyBuildingProps> {
  return {
    type: "Feature",
    properties: { height, fireEta },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [lng, lat],
        [lng + w, lat],
        [lng + w, lat + h],
        [lng, lat + h],
        [lng, lat],
      ]],
    },
  };
}

/** Grid of extruded building blocks across Altadena for the demo pitch. */
export const DUMMY_BUILDINGS: FeatureCollection<Polygon, DummyBuildingProps> = (() => {
  const features: Feature<Polygon, DummyBuildingProps>[] = [];
  // denser east/central Altadena, lighter foothills
  const cells: Array<[number, number, number, DummyBuildingProps["fireEta"]]> = [];
  for (let lng = -118.16; lng <= -118.09; lng += 0.0045) {
    for (let lat = 34.165; lat <= 34.205; lat += 0.0038) {
      const inFire = lng > -118.11 && lat > 34.175;
      const nearFire = lng > -118.13 && lat > 34.17;
      const fireEta: DummyBuildingProps["fireEta"] = inFire
        ? "h6"
        : nearFire
          ? "h12"
          : "clear";
      const height = 6 + ((Math.abs(Math.sin(lng * 80 + lat * 90)) * 18) | 0);
      cells.push([lng, lat, height, fireEta]);
    }
  }
  for (const [lng, lat, height, fireEta] of cells) {
    features.push(buildingBox(lng, lat, 0.0018, 0.0014, height, fireEta));
    features.push(
      buildingBox(lng + 0.0022, lat + 0.0006, 0.0014, 0.0011, height * 0.7, fireEta),
    );
  }
  return { type: "FeatureCollection", features };
})();

export type FacilityProps = {
  id: string;
  name: string;
  ftype: string;
  sector: string;
};

/**
 * Facility markers. Names are generic descriptors on purpose — plausible
 * facility types at plausible locations, not real named businesses.
 */
export const FACILITIES: FeatureCollection<Point, FacilityProps> = {
  type: "FeatureCollection",
  features: [
    facility("f1", "Skilled nursing facility — Lake Ave", "nursing_home", "S3", -118.127, 34.188),
    facility("f2", "Senior apartments — Mariposa St", "senior_center", "S3", -118.121, 34.193),
    facility("f3", "Elementary school — Altadena Central", "school", "S3", -118.13, 34.184),
    facility("f4", "Disability services center — Lincoln Ave", "disability_facility", "S4", -118.148, 34.19),
    facility("f5", "Elementary school — Altadena West", "school", "S4", -118.142, 34.195),
    facility("f6", "Assisted living — Woodbury Rd", "nursing_home", "S6", -118.132, 34.17),
    facility("f7", "Senior center — Woodbury corridor", "senior_center", "S6", -118.124, 34.167),
    facility("f8", "Middle school — Washington Blvd", "school", "S8", -118.133, 34.156),
    facility("f9", "Retirement community — The Meadows", "nursing_home", "S7", -118.164, 34.209),
    facility("f10", "Emergency shelter site (proposed)", "shelter", "S8", -118.118, 34.154),
  ],
};

function facility(
  id: string,
  name: string,
  ftype: string,
  sector: string,
  lng: number,
  lat: number,
): Feature<Point, FacilityProps> {
  return {
    type: "Feature",
    properties: { id, name, ftype, sector },
    geometry: { type: "Point", coordinates: [lng, lat] },
  };
}

export type AccessRoadProps = {
  name: string;
  constraint: string;
  sector: string;
};

/** Single-access / constrained road segments (access-vulnerability overlay). */
export const ACCESS_ROADS: FeatureCollection<LineString, AccessRoadProps> = {
  type: "FeatureCollection",
  features: [
    accessRoad("Chaney Trail", "Only access road for The Meadows", "S7", [
      [-118.161, 34.199],
      [-118.163, 34.206],
      [-118.165, 34.212],
      [-118.166, 34.218],
    ]),
    accessRoad("Canyon Close Rd", "Dead-end canyon street, one egress", "S1", [
      [-118.09, 34.178],
      [-118.088, 34.185],
      [-118.087, 34.191],
    ]),
    accessRoad("Kinneloa Mesa Rd", "Single winding egress from mesa", "S2", [
      [-118.107, 34.172],
      [-118.109, 34.181],
      [-118.108, 34.19],
    ]),
    accessRoad("Upper Lake Ave", "Narrow foothill segment, no parallel route", "S3", [
      [-118.127, 34.196],
      [-118.127, 34.201],
      [-118.128, 34.206],
    ]),
  ],
};

function accessRoad(
  name: string,
  constraint: string,
  sector: string,
  coordinates: [number, number][],
): Feature<LineString, AccessRoadProps> {
  return {
    type: "Feature",
    properties: { name, constraint, sector },
    geometry: { type: "LineString", coordinates },
  };
}

/** Midpoint of a named access road for fly-to. */
export function accessRoadCenter(roadName: string): [number, number] | null {
  const feature = ACCESS_ROADS.features.find(
    (road) => road.properties.name.toLowerCase() === roadName.toLowerCase(),
  );
  if (!feature) {
    return null;
  }
  const coords = feature.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  return [mid[0], mid[1]];
}
