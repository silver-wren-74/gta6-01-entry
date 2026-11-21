// Cars: the factory that builds them, the arcade physics that moves them
// (velocity split into forward and lateral parts, grip killing the lateral
// part — less of it with the handbrake up, which is what drifting is), and
// the traffic driver who follows the avenues, turns at crossings and queues
// behind the car in front.
import { CAR_PAINTS, CAR_TYPES, ROADS_X, ROADS_Y, ROAD_W, WORLD_H, WORLD_W } from './config.js';
import { resolveCircle } from './city.js';
import { angleDelta, clamp, dist } from './random.js';

const LANE = 23; // distance from a road's centre line to its driving lanes

let nextCarId = 1;

/** Build a car. driver: 'traffic' | 'parked' | 'player' | 'cop'. */
export function makeCar(rng, type, x, y, angle, driver = 'parked') {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId++,
    type, label: spec.label,
    length: spec.length, width: spec.width,
    x, y, angle, vx: 0, vy: 0,
    color: type === 'cop' ? '#f2f0e6' : type === 'taxi' ? '#f4b41a' : rng.pick(CAR_PAINTS),
    health: 100,
    driver,
    burning: 0,
    ai: null, // traffic state, set by giveTrafficBrain
    hornAt: 0,
  };
}

/** Signed speed along the car's nose, px/s. */
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

/** Total speed, px/s. */
export function speedOf(car) {
  return Math.hypot(car.vx, car.vy);
}

/** Give a car the traffic brain: it picks a road and drives its length. */
export function giveTrafficBrain(rng, car) {
  const vertical = rng.chance(0.55);
  if (vertical) {
    const roadIdx = rng.int(0, ROADS_X.length - 1);
    const dir = rng.chance(0.5) ? 1 : -1;
    car.ai = { axis: 'y', roadIdx, dir, turning: null, cruise: rng.range(0.55, 0.8) };
    car.x = ROADS_X[roadIdx] + dir * LANE;
    car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const roadIdx = rng.int(0, ROADS_Y.length - 1);
    const dir = rng.chance(0.5) ? 1 : -1;
    car.ai = { axis: 'x', roadIdx, dir, turning: null, cruise: rng.range(0.55, 0.8) };
    car.y = ROADS_Y[roadIdx] - dir * LANE;
    car.angle = dir > 0 ? 0 : Math.PI;
  }
  car.driver = 'traffic';
  return car;
}

/**
 * Advance one car by dt under a control {throttle -1..1, steer -1..1,
 * brake, handbrake}. Handles building and water collision; hard hits cost
 * health and are reported on state.events for sound and camera shake.
 */
export function stepCar(state, car, control, dt) {
  const spec = CAR_TYPES[car.type];
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let fSpeed = car.vx * fx + car.vy * fy;
  let lx = car.vx - fx * fSpeed;
  let ly = car.vy - fy * fSpeed;

  // Steering bites harder as the car gets moving, and reverses in reverse.
  const authority = clamp(Math.abs(fSpeed) / 70, 0, 1) * (fSpeed < -1 ? -1 : 1);
  car.angle += control.steer * 1.85 * authority * dt * (control.handbrake ? 1.3 : 1);

  if (control.brake) {
    fSpeed -= Math.sign(fSpeed) * Math.min(Math.abs(fSpeed), 420 * dt);
  } else {
    fSpeed += control.throttle * spec.accel * dt;
  }
  // Drag and rolling resistance; coasting slows a car faster than cruising.
  fSpeed -= fSpeed * (control.throttle === 0 ? 0.75 : 0.22) * dt;
  fSpeed = clamp(fSpeed, -spec.topSpeed * 0.32, spec.topSpeed);

  // Grip eats lateral slide; the handbrake lets it live, which is the drift.
  const grip = control.handbrake ? 1.6 : spec.grip;
  const keep = Math.max(0, 1 - grip * dt);
  lx *= keep;
  ly *= keep;

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * fSpeed + lx;
  car.vy = nfy * fSpeed + ly;

  const beforeX = car.x;
  const beforeY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Collide as two circles, nose and tail, so a car can clip a corner.
  const r = car.width * 0.62;
  const off = car.length * 0.27;
  for (const s of [1, -1]) {
    const p = { x: car.x + nfx * off * s, y: car.y + nfy * off * s };
    resolveCircle(state.city, p, r);
    car.x += p.x - (car.x + nfx * off * s);
    car.y += p.y - (car.y + nfy * off * s);
  }
  const shove = Math.hypot(car.x - beforeX - car.vx * dt, car.y - beforeY - car.vy * dt);
  if (shove > 1.2) {
    const impact = speedOf(car);
    car.vx *= 0.45;
    car.vy *= 0.45;
    if (impact > 170) {
      car.health -= (impact - 170) / 14;
      state.events.push({ type: 'crash', x: car.x, y: car.y, mag: clamp(impact / 380, 0.3, 1) });
    }
  }
  if (car.health <= 0 && car.burning === 0) car.burning = 0.001; // catches fire in main's effects pass
  car.drifting = Math.hypot(lx, ly) > 55 && Math.abs(fSpeed) > 90;
}

/** The traffic driver's control for this frame. */
export function trafficControl(state, car, dt) {
  const ai = car.ai;
  const control = { throttle: 0, steer: 0, brake: false, handbrake: false };
  if (!ai) return control;

  // Where the nose should point: along the lane, or at the corner mid-turn.
  let targetX;
  let targetY;
  if (ai.turning) {
    targetX = ai.turning.x;
    targetY = ai.turning.y;
    if (Math.hypot(car.x - targetX, car.y - targetY) < 42) {
      // Through the corner: adopt the new road.
      ai.axis = ai.turning.axis;
      ai.roadIdx = ai.turning.roadIdx;
      ai.dir = ai.turning.dir;
      ai.turning = null;
    }
  } else if (ai.axis === 'y') {
    targetX = ROADS_X[ai.roadIdx] + ai.dir * LANE;
    targetY = car.y + ai.dir * 320;
    // Approaching a crossing? Sometimes turn onto it.
    for (let i = 0; i < ROADS_Y.length; i += 1) {
      const ry = ROADS_Y[i];
      const ahead = (ry - car.y) * ai.dir;
      if (ahead > 6 && ahead < 30 && state.rng.chance(0.012)) {
        const dir = state.rng.chance(0.5) ? 1 : -1;
        ai.turning = { x: ROADS_X[ai.roadIdx], y: ry, axis: 'x', roadIdx: i, dir };
        break;
      }
    }
  } else {
    targetX = car.x + ai.dir * 320;
    targetY = ROADS_Y[ai.roadIdx] - ai.dir * LANE;
    for (let i = 0; i < ROADS_X.length; i += 1) {
      const rx = ROADS_X[i];
      const ahead = (rx - car.x) * ai.dir;
      if (ahead > 6 && ahead < 30 && state.rng.chance(0.012)) {
        const dir = state.rng.chance(0.5) ? 1 : -1;
        ai.turning = { x: rx, y: ROADS_Y[ai.roadIdx], axis: 'y', roadIdx: i, dir };
        break;
      }
    }
  }

  const wanted = Math.atan2(targetY - car.y, targetX - car.x);
  const delta = angleDelta(car.angle, wanted);
  control.steer = clamp(delta * 2.4, -1, 1);
  const fSpeed = forwardSpeed(car);
  const topSpeed = CAR_TYPES[car.type].topSpeed * ai.cruise;
  control.throttle = fSpeed < topSpeed ? 0.85 : 0;
  if (Math.abs(delta) > 0.5) control.throttle = Math.min(control.throttle, 0.3);

  // Queue behind anything close ahead; honk if it lasts.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of state.allVehicles) {
    if (other === car) continue;
    const relX = other.x - car.x;
    const relY = other.y - car.y;
    const ahead = relX * fx + relY * fy;
    const side = Math.abs(relX * -fy + relY * fx);
    if (ahead > 0 && ahead < 74 && side < 20) {
      control.throttle = 0;
      control.brake = fSpeed > 30;
      if (state.time - car.hornAt > 4 && fSpeed < 12) {
        car.hornAt = state.time;
        state.events.push({ type: 'horn', x: car.x, y: car.y, mag: 0.5 });
      }
      break;
    }
  }
  // Near the map edge, traffic turns around by picking the crossing behind.
  if (car.x < 60 || car.x > WORLD_W - 60 || car.y < 60 || car.y > WORLD_H - 60) {
    ai.dir = -ai.dir;
    if (ai.axis === 'y') car.x = ROADS_X[ai.roadIdx] + ai.dir * LANE;
    else car.y = ROADS_Y[ai.roadIdx] - ai.dir * LANE;
  }
  void dt;
  return control;
}

/** Fill the city with moving traffic, spread over the grid, away from `avoid`. */
export function spawnTraffic(state, count, avoid) {
  const types = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'truck'];
  for (let i = 0; i < count; i += 1) {
    let car = null;
    for (let tries = 0; tries < 12; tries += 1) {
      car = makeCar(state.rng, state.rng.pick(types), 0, 0, 0, 'traffic');
      if (state.rng.chance(0.5)) {
        car.x = state.rng.pick(ROADS_X);
        car.y = state.rng.range(120, WORLD_H - 120);
      } else {
        car.x = state.rng.range(480, WORLD_W - 120);
        car.y = state.rng.pick(ROADS_Y);
      }
      giveTrafficBrain(state.rng, car);
      // Snap onto the brain's road.
      if (car.ai.axis === 'y') car.y = state.rng.range(120, WORLD_H - 120);
      else car.x = state.rng.range(480, WORLD_W - 120);
      if (dist(car, avoid) > 420) break;
      car = null;
    }
    if (car) state.cars.push(car);
  }
}

/** Park cars in the lot bays and along a few kerbs. */
export function spawnParked(state) {
  const types = ['sedan', 'sedan', 'sport', 'van', 'truck', 'taxi'];
  for (const spot of state.city.lotSpots) {
    if (!state.rng.chance(0.55)) continue;
    const car = makeCar(state.rng, state.rng.pick(types), spot.x, spot.y, spot.angle, 'parked');
    state.cars.push(car);
  }
  // A couple of kerbside cars near the start, one of them quick.
  const starter = makeCar(state.rng, 'sport', 610, 1150, Math.PI / 2, 'parked');
  state.cars.push(starter);
  state.cars.push(makeCar(state.rng, 'sedan', 380, 1330, -Math.PI / 2, 'parked'));
}

/** Keep traffic near the player: far cars are quietly moved to a road in range. */
export function recycleTraffic(state) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    if (dist(car, p) < 1150) continue;
    if (state.rng.chance(0.5)) {
      car.x = state.rng.pick(ROADS_X);
      car.y = clamp(p.y + state.rng.range(-950, 950), 120, WORLD_H - 120);
    } else {
      car.x = clamp(p.x + state.rng.range(-950, 950), 480, WORLD_W - 120);
      car.y = state.rng.pick(ROADS_Y);
    }
    giveTrafficBrain(state.rng, car);
    if (car.ai.axis === 'y') car.y = clamp(p.y + state.rng.range(-950, 950), 120, WORLD_H - 120);
    else car.x = clamp(p.x + state.rng.range(-950, 950), 480, WORLD_W - 120);
    car.vx = 0;
    car.vy = 0;
  }
}

export { ROAD_W };
