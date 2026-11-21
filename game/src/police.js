// The Port Solana PD: the wanted heat that crimes feed and hiding starves,
// the Interceptors that hunt the player across the grid, and the officers on
// foot who close in with pistols out once the heat is high enough. Stay out
// of sight long enough and the heat bleeds away, star by star.
import { HEAT_DECAY, HEAT_HIDE_DELAY, ROADS_X, ROADS_Y } from './config.js';
import { copShoot } from './combat.js';
import { resolveCircle } from './city.js';
import { angleDelta, clamp, dist } from './random.js';
import { makeCar, stepCar } from './vehicles.js';

/** Where the player is for police purposes: their car if they are driving. */
export function playerPos(state) {
  const p = state.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

function desiredCopCars(state) {
  if (state.heat < 0.5) return 0;
  return Math.min(1 + Math.floor(state.heat), 5);
}

function desiredFootCops(state) {
  if (state.heat < 2.5) return 0;
  // Officers on foot only matter when the player is reachable on foot.
  if (state.player.car && Math.abs(state.player.car.vx) + Math.abs(state.player.car.vy) > 160) return 0;
  return Math.min(2 + Math.floor(state.heat - 2.5), 4);
}

function spawnCopCar(state) {
  const p = playerPos(state);
  // Come from a road a few blocks away, never from inside the player's view.
  for (let tries = 0; tries < 10; tries += 1) {
    let x;
    let y;
    if (state.rng.chance(0.5)) {
      x = state.rng.pick(ROADS_X);
      y = clamp(p.y + state.rng.range(-820, 820), 90, 2510);
    } else {
      x = clamp(p.x + state.rng.range(-820, 820), 420, 3510);
      y = state.rng.pick(ROADS_Y);
    }
    if (Math.hypot(x - p.x, y - p.y) < 560) continue;
    const car = makeCar(state.rng, 'cop', x, y, state.rng.range(0, Math.PI * 2), 'cop');
    state.cars.push(car);
    state.cops.push({ kind: 'car', car, down: 0 });
    return;
  }
}

function spawnFootCop(state) {
  const p = playerPos(state);
  const a = state.rng.range(0, Math.PI * 2);
  const cop = {
    kind: 'foot',
    x: clamp(p.x + Math.cos(a) * 430, 420, 3560),
    y: clamp(p.y + Math.sin(a) * 430, 30, 2560),
    angle: 0, health: 60, fireCd: state.rng.range(0.6, 1.6), down: 0, bob: 0,
  };
  resolveCircle(state.city, cop, 10);
  state.cops.push(cop);
}

/** The pursuit driver: aim at where the player will be, ram what you reach. */
function copCarControl(state, car) {
  const p = playerPos(state);
  const pvx = state.player.car ? state.player.car.vx : 0;
  const pvy = state.player.car ? state.player.car.vy : 0;
  const d = Math.hypot(p.x - car.x, p.y - car.y);
  const lead = clamp(d / 420, 0, 0.7);
  const tx = p.x + pvx * lead;
  const ty = p.y + pvy * lead;
  const wanted = Math.atan2(ty - car.y, tx - car.x);
  const delta = angleDelta(car.angle, wanted);
  const fSpeed = car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
  const control = { throttle: 0, steer: clamp(delta * 2.6, -1, 1), brake: false, handbrake: Math.abs(delta) > 1.9 };
  if (state.heat < 0.5) {
    // Standing down: pull over and let the player go.
    control.throttle = fSpeed > 40 ? 0 : 0.3;
    control.steer = 0;
    return control;
  }
  // Against a driver, close in. Against someone on foot, stop close by and
  // let the officers on foot make the arrest.
  const stopAt = state.player.car ? 0 : 95;
  if (d > stopAt + 12) control.throttle = 1;
  else if (fSpeed > 26) control.brake = true;
  if (Math.abs(delta) > 2.4 && d < 130) control.throttle = -0.7; // reverse out of a bad angle
  return control;
}

function updateFootCop(state, cop, dt) {
  if (cop.down > 0) return;
  const p = playerPos(state);
  const d = Math.hypot(p.x - cop.x, p.y - cop.y);
  cop.bob += dt * 9;
  let mx = 0;
  let my = 0;
  if (state.heat < 0.5) {
    // Standing down: walk away from the player.
    mx = (cop.x - p.x) / (d || 1);
    my = (cop.y - p.y) / (d || 1);
  } else if (d > 150) {
    mx = (p.x - cop.x) / d;
    my = (p.y - cop.y) / d;
  } else if (d < 88) {
    mx = (cop.x - p.x) / d;
    my = (cop.y - p.y) / d;
  }
  const speed = state.heat < 0.5 ? 70 : 148;
  cop.x += mx * speed * dt;
  cop.y += my * speed * dt;
  cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
  resolveCircle(state.city, cop, 10);

  cop.fireCd -= dt;
  if (state.heat >= 1 && d < 330 && cop.fireCd <= 0 && !state.player.car) {
    cop.fireCd = state.rng.range(1.15, 1.95);
    copShoot(state, cop);
  } else if (state.heat >= 2 && d < 300 && cop.fireCd <= 0 && state.player.car) {
    cop.fireCd = state.rng.range(1.4, 2.2);
    copShoot(state, cop);
  }

  // Close enough with the player on foot? The arrest meter fills.
  if (!state.player.car && d < 30 && state.heat >= 0.5) {
    state.player.bustedMeter = clamp(state.player.bustedMeter + dt / 2.4, 0, 1);
  }
}

/** One frame of law enforcement: heat, spawning, pursuit, arrests. */
export function updatePolice(state, dt) {
  const p = playerPos(state);

  // Who can see the player right now?
  let seen = false;
  for (const cop of state.cops) {
    const cx = cop.kind === 'car' ? cop.car.x : cop.x;
    const cy = cop.kind === 'car' ? cop.car.y : cop.y;
    if (Math.hypot(cx - p.x, cy - p.y) < 560) { seen = true; break; }
  }
  state.seenNow = seen;
  if (seen) state.lastSeenT = state.time;

  // Heat bleeds off while nobody has eyes on the player.
  if (state.heat > 0 && !seen && state.time - state.lastSeenT > HEAT_HIDE_DELAY) {
    state.heat = Math.max(0, state.heat - HEAT_DECAY * dt);
  }
  if (state.heat < 0.5 && state.player.bustedMeter > 0) {
    state.player.bustedMeter = Math.max(0, state.player.bustedMeter - dt * 0.8);
  }

  // Spawn and retire units to match the heat.
  const carCops = state.cops.filter((c) => c.kind === 'car' && c.down === 0);
  const footCops = state.cops.filter((c) => c.kind === 'foot' && c.down === 0);
  if (carCops.length < desiredCopCars(state)) spawnCopCar(state);
  if (footCops.length < desiredFootCops(state)) spawnFootCop(state);

  const kept = [];
  for (const cop of state.cops) {
    if (cop.kind === 'car') {
      if (cop.car.exploded) cop.down = 1;
      if (cop.down > 0) continue; // crew lost with the car; main scrubs the wreck from state.cars later
      stepCar(state, cop.car, copCarControl(state, cop.car), dt);
      if (state.heat < 0.5 && dist(cop.car, p) > 900) {
        state.cars = state.cars.filter((c) => c !== cop.car);
        continue;
      }
    } else {
      if (cop.down > 0) { cop.down += dt; if (cop.down > 14) continue; }
      updateFootCop(state, cop, dt);
      if (state.heat < 0.5 && dist(cop, p) > 800) continue;
    }
    kept.push(cop);
  }
  state.cops = kept;
}
