// Port Solana itself: the street grid, the blocks between the streets, the
// buildings that fill them, the parks, the marina docks reaching into the bay,
// and the named places the story sends you to. Also the geometry helpers every
// other module leans on: building collision, water, and road lookups.
import {
  BEACH_X, COLORS, ROADS_X, ROADS_Y, ROAD_W, ROOF_COLORS, SIDEWALK_OFF,
  WATER_X, WORLD_H, WORLD_W,
} from './config.js';
import { clamp } from './random.js';

/** Named places, keyed by the id the missions use. x/y is the kerb outside. */
export const LANDMARKS = {
  marinaMarket:  { x: 560,  y: 940,  label: 'Marina Market' },
  hotelMarlin:   { x: 1560, y: 520,  label: 'Hotel Marlin' },
  palmsGarage:   { x: 2760, y: 1720, label: 'Palms Garage' },
  chopShop:      { x: 3270, y: 2130, label: 'Reyes Chop Shop' },
  bank:          { x: 1780, y: 940,  label: 'Solana Bank' },
  policeStation: { x: 2380, y: 520,  label: 'Port Solana PD' },
  hospital:      { x: 580,  y: 2130, label: 'Harbor Hospital' },
  safehouse:     { x: 1180, y: 2130, label: 'Casa Azul Safehouse' },
  pier:          { x: 128,  y: 1560, label: 'Pier 9 — the Tide Runner' },
  depot:         { x: 2760, y: 520,  label: 'Solana Sprint Depot' },
  tideRecords:   { x: 1180, y: 940,  label: 'Tide Records' },
  cafeBrisa:     { x: 2160, y: 1720, label: 'Café Brisa' },
  palmaJewelers: { x: 2760, y: 940,  label: 'Palma Jewelers' },
  start:         { x: 560,  y: 1120, label: 'Marina Steps' },
};

/** Shop names dealt out to ordinary buildings so the roofs read as a real city. */
const SHOP_NAMES = [
  'Café Brisa', 'Tide Records', 'Palma Jewelers', 'Hotel Marlin', 'Solana Bank',
  'Marina Market', 'Bodega Sol', 'Neon Gym', 'Palms Garage', 'La Ola Tacos',
  'Vista Pharmacy', 'Coral Books', 'Hotel Brisa', 'Solana Bank', 'Marea Sushi',
  'The Salty Anchor', 'Oficina Norte', 'Palm Court Flats', 'Azure Realty',
  'Taller Reyes', 'Cine Solana', 'Flor de Mar', 'Hotel Delfín', 'Banco del Puerto',
];

/**
 * Build the whole city from a seeded rng. Returns:
 *   buildings: [{x,y,w,h,floors,roof,name?}] — solid, collidable
 *   trees:     [{x,y,s}] palms, decorative with a small solid trunk
 *   docks:     [{x,y,w,h}] planks over the water you can walk and drive on
 *   parks:     [{x,y,w,h}] grass blocks with paths and palms, no buildings
 *   lotSpots:  [{x,y,angle}] parking bays where parked cars sit
 */
export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const lotSpots = [];

  // The blocks are the rectangles between neighbouring roads, plus the strips
  // between the beach road and the bay and beyond the last roads to the edge.
  const xEdges = [BEACH_X, ...ROADS_X.flatMap((x) => [x - ROAD_W / 2, x + ROAD_W / 2]), WORLD_W];
  const yEdges = [0, ...ROADS_Y.flatMap((y) => [y - ROAD_W / 2, y + ROAD_W / 2]), WORLD_H];
  const xBlocks = [];
  for (let i = 0; i + 1 < xEdges.length; i += 2) xBlocks.push([xEdges[i], xEdges[i + 1]]);
  const yBlocks = [];
  for (let i = 0; i + 1 < yEdges.length; i += 2) yBlocks.push([yEdges[i], yEdges[i + 1]]);

  let shopIndex = 0;
  for (const [bx0, bx1] of xBlocks) {
    for (const [by0, by1] of yBlocks) {
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 120 || bh < 120) continue;
      const roll = rng.next();
      // A few blocks are parks or a parking lot instead of buildings.
      if (roll < 0.10) {
        parks.push({ x: bx0, y: by0, w: bw, h: bh });
        const palms = rng.int(4, 8);
        for (let i = 0; i < palms; i += 1) {
          trees.push({ x: rng.range(bx0 + 30, bx1 - 30), y: rng.range(by0 + 30, by1 - 30), s: rng.range(0.85, 1.25) });
        }
        continue;
      }
      if (roll < 0.16) {
        // Parking lot: two rows of bays along the block's long axis.
        for (let x = bx0 + 46; x < bx1 - 30; x += 52) {
          lotSpots.push({ x, y: by0 + 44, angle: Math.PI / 2 });
          lotSpots.push({ x, y: by1 - 44, angle: -Math.PI / 2 });
        }
        continue;
      }
      // Buildings: inset by the sidewalk, then split the block 1, 2 or 4 ways.
      const ix0 = bx0 + 30;
      const iy0 = by0 + 30;
      const ix1 = bx1 - 30;
      const iy1 = by1 - 30;
      const splitX = rng.chance(0.55) && ix1 - ix0 > 260;
      const splitY = rng.chance(0.45) && iy1 - iy0 > 260;
      const xs = splitX ? [ix0, (ix0 + ix1) / 2 + 10, (ix0 + ix1) / 2 - 10, ix1] : [ix0, ix1];
      const ys = splitY ? [iy0, (iy0 + iy1) / 2 + 10, (iy0 + iy1) / 2 - 10, iy1] : [iy0, iy1];
      for (let xi = 0; xi + 1 < xs.length; xi += 2) {
        for (let yi = 0; yi + 1 < ys.length; yi += 2) {
          const w = xs[xi + 1] - xs[xi];
          const h = ys[yi + 1] - ys[yi];
          if (w < 60 || h < 60) continue;
          const floors = rng.int(2, 9);
          const building = {
            x: xs[xi], y: ys[yi], w, h, floors,
            roof: rng.pick(ROOF_COLORS),
            name: null,
          };
          // Roughly one building in three carries a shop name on its roof.
          if (rng.chance(0.34)) {
            building.name = SHOP_NAMES[shopIndex % SHOP_NAMES.length];
            shopIndex += 1;
          }
          buildings.push(building);
        }
      }
      // A palm or two on the block's corners.
      if (rng.chance(0.7)) trees.push({ x: bx0 + 14, y: by0 + 14, s: rng.range(0.8, 1.15) });
      if (rng.chance(0.7)) trees.push({ x: bx1 - 14, y: by1 - 14, s: rng.range(0.8, 1.15) });
    }
  }

  // Palms along the beach promenade.
  for (let y = 60; y < WORLD_H - 40; y += rng.range(90, 150)) {
    trees.push({ x: rng.range(BEACH_X - 34, BEACH_X - 8), y, s: rng.range(0.9, 1.3) });
  }

  // Marina docks: three piers reaching west into the bay from the promenade.
  const docks = [760, 1500, 2240].map((y) => ({ x: 40, y: y - 26, w: 290, h: 52 }));

  return { buildings, trees, parks, lotSpots, docks };
}

/** Is the point in the bay and not on a dock plank? */
export function isWater(city, x, y) {
  if (x >= WATER_X) return false;
  for (const d of city.docks) {
    if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return false;
  }
  return true;
}

/** Push a circle (entity at x/y with radius r) out of every building and the water. Mutates and returns the entity. */
export function resolveCircle(city, e, r) {
  for (const b of city.buildings) {
    const nx = clamp(e.x, b.x, b.x + b.w);
    const ny = clamp(e.y, b.y, b.y + b.h);
    const dx = e.x - nx;
    const dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      e.x = nx + (dx / d) * r;
      e.y = ny + (dy / d) * r;
    } else {
      // Centre inside the building: leave by the nearest face.
      const left = e.x - b.x;
      const right = b.x + b.w - e.x;
      const top = e.y - b.y;
      const bottom = b.y + b.h - e.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) e.x = b.x - r;
      else if (m === right) e.x = b.x + b.w + r;
      else if (m === top) e.y = b.y - r;
      else e.y = b.y + b.h + r;
    }
  }
  if (isWater(city, e.x, e.y)) e.x = Math.max(e.x, WATER_X + r * 0.2);
  e.x = clamp(e.x, r, WORLD_W - r);
  e.y = clamp(e.y, r, WORLD_H - r);
  return e;
}

/** Does a circle at (x, y) overlap any building? Used for bullets and spawns. */
export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** Is the point on a road (asphalt), for traffic and spawn logic? */
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

/** The sidewalk lines pedestrians walk: fixed coordinate + axis for each side of each road. */
export function sidewalkLines() {
  const lines = [];
  for (const rx of ROADS_X) {
    lines.push({ axis: 'y', at: rx - SIDEWALK_OFF, min: 20, max: WORLD_H - 20 });
    lines.push({ axis: 'y', at: rx + SIDEWALK_OFF, min: 20, max: WORLD_H - 20 });
  }
  for (const ry of ROADS_Y) {
    lines.push({ axis: 'x', at: ry - SIDEWALK_OFF, min: BEACH_X + 10, max: WORLD_W - 20 });
    lines.push({ axis: 'x', at: ry + SIDEWALK_OFF, min: BEACH_X + 10, max: WORLD_W - 20 });
  }
  return lines;
}

export { COLORS };
