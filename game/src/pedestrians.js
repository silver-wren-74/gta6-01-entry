// Pedestrians: Port Solana's walkers. Each one follows the sidewalk lines
// beside the roads, turning onto crossing streets at corners, until something
// frightens them — a shot, a scream of tyres, a car on the pavement — and
// then they run from it, arms up, until it is far behind them.
import { PED_NAMES, PED_SHIRTS, WORLD_H, WORLD_W } from './config.js';
import { resolveCircle, sidewalkLines } from './city.js';
import { clamp, dist } from './random.js';

const WALK = 62;
const RUN = 205;
const LINES = sidewalkLines();

let nextPedId = 1;

/** A walker on a random sidewalk line. fleeT counts down panic; down is a fall. */
export function makePed(rng, near = null) {
  const line = rng.pick(LINES);
  const along = near
    ? clamp((line.axis === 'y' ? near.y : near.x) + rng.range(-700, 700), line.min, line.max)
    : rng.range(line.min, line.max);
  const ped = {
    id: nextPedId++,
    name: rng.pick(PED_NAMES),
    shirt: rng.pick(PED_SHIRTS),
    skin: rng.pick(['#e8b08a', '#c68642', '#8d5524', '#f1c27d', '#ffdbac']),
    x: line.axis === 'y' ? line.at : along,
    y: line.axis === 'y' ? along : line.at,
    angle: rng.range(0, Math.PI * 2),
    vx: 0, vy: 0,
    line,
    dir: rng.chance(0.5) ? 1 : -1,
    health: 30,
    fleeT: 0,
    fleeX: 0,
    fleeY: 0,
    down: 0, // >0: fallen, counts up to removal
    bob: rng.range(0, 6),
  };
  return ped;
}

/** Fill the sidewalks; `count` walkers spread across the whole city. */
export function spawnPeds(state, count) {
  for (let i = 0; i < count; i += 1) state.peds.push(makePed(state.rng));
}

/** Frighten every walker near a point: they run directly away from it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.fleeT = state.rng.range(2.2, 3.6);
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

/** Advance all walkers. Dead and long-fallen walkers are removed by main. */
export function updatePeds(state, dt) {
  const rng = state.rng;
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down += dt;
      ped.vx = 0;
      ped.vy = 0;
      continue;
    }
    ped.bob += dt * (ped.fleeT > 0 ? 13 : 8);
    let mx = 0;
    let my = 0;
    let speed = WALK;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      mx = dx / d;
      my = dy / d;
      speed = RUN;
    } else {
      // Walk the line; at a crossing street, sometimes swap onto it.
      const line = ped.line;
      if (line.axis === 'y') {
        my = ped.dir;
        if (rng.chance(0.006)) {
          const cross = LINES.filter((l) => l.axis === 'x' && Math.abs(l.at - ped.y) < 90);
          if (cross.length) {
            ped.line = rng.pick(cross);
            ped.dir = rng.chance(0.5) ? 1 : -1;
          }
        }
        if (ped.y < line.min + 4) ped.dir = 1;
        if (ped.y > line.max - 4) ped.dir = -1;
        // Keep to the line's fixed coordinate.
        ped.x += (line.at - ped.x) * Math.min(1, dt * 4);
      } else {
        mx = ped.dir;
        if (rng.chance(0.006)) {
          const cross = LINES.filter((l) => l.axis === 'y' && Math.abs(l.at - ped.x) < 90);
          if (cross.length) {
            ped.line = rng.pick(cross);
            ped.dir = rng.chance(0.5) ? 1 : -1;
          }
        }
        if (ped.x < line.min + 4) ped.dir = 1;
        if (ped.x > line.max - 4) ped.dir = -1;
        ped.y += (line.at - ped.y) * Math.min(1, dt * 4);
      }
    }
    ped.vx = mx * speed;
    ped.vy = my * speed;
    ped.x += ped.vx * dt;
    ped.y += ped.vy * dt;
    if (mx !== 0 || my !== 0) ped.angle = Math.atan2(my, mx);
    resolveCircle(state.city, ped, 9);
    ped.x = clamp(ped.x, 12, WORLD_W - 12);
    ped.y = clamp(ped.y, 12, WORLD_H - 12);
  }
}

/** Keep walkers near the player as they roam: distant ones reappear closer. */
export function recyclePeds(state) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    if (dist(ped, p) < 1000) continue;
    const fresh = makePed(state.rng, p);
    ped.x = fresh.x;
    ped.y = fresh.y;
    ped.line = fresh.line;
    ped.dir = fresh.dir;
    ped.fleeT = 0;
  }
}
