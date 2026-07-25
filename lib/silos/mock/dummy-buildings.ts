/**
 * Lightweight demo building massing — not LARIAC / not survey-grade.
 *
 * Street-block layout with rotated footprints, mixed sizes, and a few L-shapes.
 * Kept around ~1000 extrusions so MapLibre stays smooth for the hackathon demo.
 */
import type { Feature, FeatureCollection, Polygon, Position } from "geojson";

export type DummyBuildingProps = {
  height: number;
  /** neutral | fire | pred — updated at runtime for hazard tinting */
  tint: "neutral" | "fire" | "pred";
};

/** Deterministic pseudo-random in [0, 1). */
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function feature(
  ring: Position[],
  height: number,
): Feature<Polygon, DummyBuildingProps> {
  const closed = ring[0][0] === ring[ring.length - 1][0]
    && ring[0][1] === ring[ring.length - 1][1]
    ? ring
    : [...ring, ring[0]];
  return {
    type: "Feature",
    properties: { height, tint: "neutral" },
    geometry: { type: "Polygon", coordinates: [closed] },
  };
}

/** Axis-aligned or rotated rectangle around a center. */
function rect(
  cx: number,
  cy: number,
  halfW: number,
  halfD: number,
  angleRad: number,
  height: number,
): Feature<Polygon, DummyBuildingProps> {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const corners: Position[] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ].map(([dx, dy]) => [cx + dx * c - dy * s, cy + dx * s + dy * c]);
  return feature(corners, height);
}

/** Simple L-plan (two wings) for occasional larger buildings. */
function lShape(
  cx: number,
  cy: number,
  w: number,
  d: number,
  wing: number,
  angleRad: number,
  height: number,
): Feature<Polygon, DummyBuildingProps> {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const local: Position[] = [
    [0, 0],
    [w, 0],
    [w, wing],
    [wing, wing],
    [wing, d],
    [0, d],
  ];
  const ring = local.map(([dx, dy]) => {
    const x = dx - w * 0.35;
    const y = dy - d * 0.35;
    return [cx + x * c - y * s, cy + x * s + y * c] as Position;
  });
  return feature(ring, height);
}

type Zone = {
  west: number;
  east: number;
  south: number;
  north: number;
  blockLng: number;
  blockLat: number;
  lotsMin: number;
  lotsMax: number;
  skip: number;
};

/**
 * Place buildings along the inner edges of a street block (parcel-like).
 * Looks denser / more urban than a uniform point grid.
 */
function fillBlock(
  blockLng: number,
  blockLat: number,
  blockW: number,
  blockH: number,
  seed: number,
  lotsMin: number,
  lotsMax: number,
  out: Feature<Polygon, DummyBuildingProps>[],
): void {
  const pad = Math.min(blockW, blockH) * 0.12;
  const innerW = blockW - pad * 2;
  const innerH = blockH - pad * 2;
  const baseAngle = (hash01(seed) - 0.5) * 0.12; // slight block rotation
  const lots = lotsMin + Math.floor(hash01(seed + 1) * (lotsMax - lotsMin + 1));

  for (let side = 0; side < 4; side++) {
    const sideLots = Math.max(2, Math.floor(lots / 2) + (side % 2));
    for (let k = 0; k < sideLots; k++) {
      const idx = seed * 40 + side * 10 + k;
      if (hash01(idx) < 0.12) {
        continue;
      }
      const t = (k + 0.5 + (hash01(idx + 1) - 0.5) * 0.25) / sideLots;
      let cx = blockLng + pad;
      let cy = blockLat + pad;
      let angle = baseAngle;
      const along = side % 2 === 0 ? innerW : innerH;
      const depth = (side % 2 === 0 ? innerH : innerW) * (0.22 + hash01(idx + 2) * 0.18);
      const front = along * (0.28 + hash01(idx + 3) * 0.35) / sideLots;

      if (side === 0) {
        // south edge, face south
        cx = blockLng + pad + t * innerW;
        cy = blockLat + pad + depth * 0.55;
        angle = baseAngle;
      } else if (side === 1) {
        // east edge
        cx = blockLng + pad + innerW - depth * 0.55;
        cy = blockLat + pad + t * innerH;
        angle = baseAngle + Math.PI / 2;
      } else if (side === 2) {
        // north edge
        cx = blockLng + pad + t * innerW;
        cy = blockLat + pad + innerH - depth * 0.55;
        angle = baseAngle;
      } else {
        // west edge
        cx = blockLng + pad + depth * 0.55;
        cy = blockLat + pad + t * innerH;
        angle = baseAngle + Math.PI / 2;
      }

      const halfW = front * 0.45;
      const halfD = depth * 0.42;
      // Mix of bungalow / 2-story / occasional taller commercial
      const roll = hash01(idx + 4);
      const height =
        roll < 0.55 ? 5 + hash01(idx + 5) * 3.5
        : roll < 0.88 ? 8 + hash01(idx + 5) * 5
        : 12 + hash01(idx + 5) * 10;

      if (hash01(idx + 6) < 0.08 && halfW > 0.00035) {
        out.push(
          lShape(
            cx,
            cy,
            halfW * 2.1,
            halfD * 2.1,
            Math.min(halfW, halfD) * 1.1,
            angle,
            height,
          ),
        );
      } else {
        out.push(rect(cx, cy, halfW, halfD, angle, height));
      }
    }
  }
}

const ZONES: Zone[] = [
  // Dense core — fire / east Altadena
  {
    west: -118.128,
    east: -118.082,
    south: 34.175,
    north: 34.212,
    blockLng: 0.0038,
    blockLat: 0.0033,
    lotsMin: 3,
    lotsMax: 5,
    skip: 0.08,
  },
  // Mid ring — Pasadena / west Altadena (sparser fill)
  {
    west: -118.148,
    east: -118.075,
    south: 34.165,
    north: 34.22,
    blockLng: 0.0052,
    blockLat: 0.0046,
    lotsMin: 2,
    lotsMax: 4,
    skip: 0.42,
  },
];

/** Soft GPU budget for fill-extrusion on mid-range laptops. */
const MAX_BUILDINGS = 1000;

/** Static dummy massing for the SILOS map (generated once). */
export const DUMMY_BUILDINGS: FeatureCollection<Polygon, DummyBuildingProps> =
  (() => {
    const features: Feature<Polygon, DummyBuildingProps>[] = [];
    const seen = new Set<string>();
    let blockId = 0;

    for (const zone of ZONES) {
      for (
        let blng = zone.west;
        blng < zone.east - zone.blockLng * 0.5;
        blng += zone.blockLng
      ) {
        for (
          let blat = zone.south;
          blat < zone.north - zone.blockLat * 0.5;
          blat += zone.blockLat
        ) {
          blockId += 1;
          if (hash01(blockId * 3) < zone.skip) {
            continue;
          }
          // Dedup overlapping mid-ring cells that sit inside the dense core.
          const key = `${blng.toFixed(3)},${blat.toFixed(3)}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);

          const batch: Feature<Polygon, DummyBuildingProps>[] = [];
          fillBlock(
            blng + (hash01(blockId) - 0.5) * zone.blockLng * 0.08,
            blat + (hash01(blockId + 1) - 0.5) * zone.blockLat * 0.08,
            zone.blockLng * (0.88 + hash01(blockId + 2) * 0.1),
            zone.blockLat * (0.88 + hash01(blockId + 3) * 0.1),
            blockId,
            zone.lotsMin,
            zone.lotsMax,
            batch,
          );
          if (features.length + batch.length > MAX_BUILDINGS) {
            features.push(...batch.slice(0, MAX_BUILDINGS - features.length));
            return { type: "FeatureCollection", features };
          }
          features.push(...batch);
        }
      }
    }

    return { type: "FeatureCollection", features };
  })();
