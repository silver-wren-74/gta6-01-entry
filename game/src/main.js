// Neon Tide — boot, the fixed-step loop, and Dario himself: walking,
// sprinting, shooting, stealing cars and driving them, and what happens when
// the city wins (WASTED at the hospital, BUSTED at the station). The world
// lives in the modules; this file conducts them.
//
// ?seed=N fixes the city. ?shot=cover|city|mission|drive (with &seed=N)
// stages that screenshot scene instead of running the loop.
import {
  FIRE_INTERVAL, HEAT_PER_THEFT, PLAYER_HEALTH, PLAYER_RADIUS, SPRINT_SPEED,
  STEP, WALK_SPEED, WORLD_H, WORLD_W,
} from './config.js';
import { buildCity, LANDMARKS, resolveCircle } from './city.js';
import { createRng, clamp, dist } from './random.js';
import { SoundEngine } from './audio.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawHUD } from './hud.js';
import { stageShot } from './shots.js';
import { forwardSpeed, recycleTraffic, spawnParked, spawnTraffic, speedOf, stepCar, trafficControl } from './vehicles.js';
import { makePed, recyclePeds, scarePeds, spawnPeds, updatePeds } from './pedestrians.js';
import { damagePlayer, knockDownCop, knockDownPed, playerShoot, updateBullets, updateParticles, updatePickups } from './combat.js';
import { playerPos, updatePolice } from './police.js';
import { updateMissions } from './missions.js';
import { clearSave, loadSave, writeSave } from './save.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261121;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const sound = new SoundEngine();

/** A fresh Port Solana and a fresh Dario, from one seed. */
export function createGame(gameSeed) {
  const rng = createRng(gameSeed);
  const city = buildCity(rng);
  const start = LANDMARKS.start;
  const state = {
    rng, city,
    time: 0,
    screen: 'title',
    player: {
      x: start.x, y: start.y, aim: 0.6,
      health: PLAYER_HEALTH, money: 60, car: null,
      fireCd: 0, muzzle: 0, hurtT: 0, bustedMeter: 0,
    },
    cars: [], peds: [], cops: [], bullets: [], particles: [], pickups: [], skids: [],
    events: [], messages: [],
    heat: 0, lastSeenT: -99, seenNow: false, witnessNear: false,
    story: { idx: 0, active: false, stepIdx: 0, done: false },
    courier: { active: false },
    missionCar: null, missionCard: null, objective: null, holdT: 0,
    stats: { earned: 0, missionsDone: 0, courierDone: 0, pedsDown: 0, copsDown: 0 },
    camera: { x: 0, y: 0 },
    shake: 0,
    promptText: null,
    muted: false,
    saveData: loadSave(),
    saveDirty: false,
    started: false,
  };
  state.allVehicles = state.cars;
  spawnTraffic(state, 16, state.player);
  spawnParked(state);
  spawnPeds(state, 36);
  return state;
}

let state = createGame(seed);

/** Apply a save: money, story progress, standing spot, stats. */
function applySave(data) {
  state.player.money = data.money;
  state.story.idx = Math.min(data.storyIdx || 0, 5);
  state.story.done = !!data.storyDone;
  state.player.x = data.x;
  state.player.y = data.y;
  if (data.stats) state.stats = { ...state.stats, ...data.stats };
}

function beginPlay(fromSave) {
  if (fromSave && state.saveData) applySave(state.saveData);
  state.screen = 'play';
  state.started = true;
  sound.ensure();
  sound.ui();
  status.textContent = 'Neon Tide started.';
}

/** The police presence is wiped and the heat forgotten (hospital / station). */
function clearPolice() {
  state.cops = [];
  state.cars = state.cars.filter((car) => car.driver !== 'cop');
  state.heat = 0;
  state.player.bustedMeter = 0;
}

function respawn(atLandmark, fine) {
  const p = state.player;
  if (p.car) {
    p.car.driver = 'parked';
    p.car = null;
  }
  p.money = Math.max(0, p.money - fine);
  p.health = PLAYER_HEALTH;
  p.x = LANDMARKS[atLandmark].x;
  p.y = LANDMARKS[atLandmark].y;
  clearPolice();
  state.screen = 'play';
  state.saveDirty = true;
}

/** Is anyone close enough to see (and report) what the player does? */
function computeWitness() {
  const p = state.player;
  state.witnessNear = false;
  for (const ped of state.peds) {
    if (ped.down === 0 && Math.hypot(ped.x - p.x, ped.y - p.y) < 280) { state.witnessNear = true; return; }
  }
  for (const cop of state.cops) {
    const cx = cop.kind === 'car' ? cop.car.x : cop.x;
    const cy = cop.kind === 'car' ? cop.car.y : cop.y;
    if (Math.hypot(cx - p.x, cy - p.y) < 340) { state.witnessNear = true; return; }
  }
}

/** Sound and shake for the frame's events, then the queue is emptied. */
function drainEvents() {
  const p = playerPos(state);
  for (const ev of state.events) {
    const near = Math.hypot(ev.x - p.x, ev.y - p.y) < 850;
    if (state.muted) continue;
    if (ev.type === 'shot') sound.shot();
    else if (ev.type === 'hit' && near) sound.hit();
    else if (ev.type === 'crash') {
      if (near) sound.crash(ev.mag);
      if (Math.hypot(ev.x - p.x, ev.y - p.y) < 200) state.shake = Math.max(state.shake, ev.mag * 7);
    } else if (ev.type === 'cash') sound.cash();
    else if (ev.type === 'pickup') sound.pickup();
    else if (ev.type === 'complete') sound.complete();
    else if (ev.type === 'fail') sound.fail();
    else if (ev.type === 'ui') sound.ui();
    else if (ev.type === 'door') sound.door();
    else if (ev.type === 'horn' && near) sound.horn();
  }
  state.events.length = 0;
}

function nearestEnterableCar() {
  const p = state.player;
  let best = null;
  let bestD = 56;
  for (const car of state.cars) {
    if (car.exploded) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y) - car.length * 0.3;
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const p = state.player;
  const wasParked = car.driver === 'parked';
  car.driver = 'player';
  car.ai = null;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  state.events.push({ type: 'door', x: car.x, y: car.y, mag: 1 });
  if (wasParked && state.witnessNear && !car.isMissionCar) {
    state.heat = clamp(state.heat + HEAT_PER_THEFT, 0, 5);
    state.messages.push({ text: 'Wheels taken — and someone saw it.', t: 3.4, color: '#ffd166' });
  }
  scarePeds(state, car.x, car.y, 90);
}

function exitCar() {
  const p = state.player;
  const car = p.car;
  car.driver = 'parked';
  p.car = null;
  // Step out to the car's left, onto whatever ground is there.
  p.x = car.x + Math.cos(car.angle - Math.PI / 2) * (car.width + 14);
  p.y = car.y + Math.sin(car.angle - Math.PI / 2) * (car.width + 14);
  resolveCircle(state.city, p, PLAYER_RADIUS);
  state.events.push({ type: 'door', x: car.x, y: car.y, mag: 1 });
}

function updatePlayer(dt) {
  const p = state.player;
  p.fireCd -= dt;
  p.muzzle = Math.max(0, p.muzzle - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  state.promptText = null;

  if (p.car) {
    const car = p.car;
    if (car.exploded) {
      damagePlayer(state, 26);
      exitCar();
      return;
    }
    const axis = input.axis();
    const control = {
      throttle: axis.y < 0 ? 1 : axis.y > 0 ? -0.85 : 0,
      steer: axis.x,
      brake: false,
      handbrake: input.down('Space'),
    };
    stepCar(state, car, control, dt);
    p.x = car.x;
    p.y = car.y;
    p.aim = car.angle;
    if (input.pressed('KeyE')) exitCar();
    // Tyre smoke and skid marks while drifting or spinning the wheels.
    if (car.drifting || (control.handbrake && speedOf(car) > 60)) {
      const back = car.length * 0.32;
      for (const s of [1, -1]) {
        const wx = car.x - Math.cos(car.angle) * back + Math.cos(car.angle + Math.PI / 2) * car.width * 0.4 * s;
        const wy = car.y - Math.sin(car.angle) * back + Math.sin(car.angle + Math.PI / 2) * car.width * 0.4 * s;
        state.skids.push({ x: wx, y: wy, angle: car.angle, life: 1 });
      }
    }
    return;
  }

  // On foot.
  const axis = input.axis();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
  if (axis.x !== 0 || axis.y !== 0) {
    const len = Math.hypot(axis.x, axis.y);
    p.x += (axis.x / len) * speed * dt;
    p.y += (axis.y / len) * speed * dt;
  }
  resolveCircle(state.city, p, PLAYER_RADIUS);
  // Cars are solid to walk into.
  for (const car of state.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    const rr = car.length * 0.44 + PLAYER_RADIUS;
    if (d > 0.01 && d < rr) {
      p.x = car.x + ((p.x - car.x) / d) * rr;
      p.y = car.y + ((p.y - car.y) / d) * rr;
    }
  }
  // Aim at the mouse, in world space.
  const cam = state.camera;
  const wx = cam.x + input.mouse.x;
  const wy = cam.y + input.mouse.y;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  if (input.mouse.down && p.fireCd <= 0) {
    p.fireCd = FIRE_INTERVAL;
    playerShoot(state);
  }
  const near = nearestEnterableCar();
  if (near) {
    state.promptText = `E — take the ${near.label}`;
    if (input.pressed('KeyE')) enterCar(near);
  }
  if (p.bustedMeter >= 1) {
    state.screen = 'busted';
    status.textContent = 'Busted.';
  }
}

/** Car-on-car shoves, and what fast cars do to people in the road. */
function collideVehiclesAndPeople(dt) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = a.length * 0.42 + b.length * 0.42;
      const d = Math.hypot(dx, dy);
      if (d < 0.01 || d >= rr) continue;
      const push = (rr - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      const avx = (a.vx + b.vx) / 2;
      const avy = (a.vy + b.vy) / 2;
      a.vx = avx * 0.9;
      a.vy = avy * 0.9;
      b.vx = avx * 0.9;
      b.vy = avy * 0.9;
      if (rel > 150) {
        a.health -= (rel - 150) / 16;
        b.health -= (rel - 150) / 16;
        state.events.push({ type: 'crash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, mag: clamp(rel / 380, 0.3, 1) });
        if (a === state.player.car || b === state.player.car) {
          if (rel > 260) damagePlayer(state, (rel - 260) / 22);
        }
      }
      resolveCircle(state.city, a, a.width * 0.6);
      resolveCircle(state.city, b, b.width * 0.6);
    }
  }
  // People in the road.
  for (const car of cars) {
    const sp = speedOf(car);
    if (sp < 55) continue;
    const byPlayer = car === state.player.car;
    const byCop = car.driver === 'cop';
    if (!byPlayer && !byCop) continue;
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.length * 0.46) {
        knockDownPed(state, ped, byPlayer);
        car.vx *= 0.82;
        car.vy *= 0.82;
        state.events.push({ type: 'hit', x: ped.x, y: ped.y, mag: 1 });
      }
    }
    if (byPlayer || byCop) {
      for (const cop of state.cops) {
        if (cop.kind !== 'foot' || cop.down > 0) continue;
        if (Math.hypot(cop.x - car.x, cop.y - car.y) < car.length * 0.46) {
          knockDownCop(state, cop, byPlayer);
          car.vx *= 0.82;
          car.vy *= 0.82;
        }
      }
    }
  }
  void dt;
}

function updateCamera(dt) {
  const cam = state.camera;
  if (state.screen === 'title') {
    // A slow drift over downtown while the city lives behind the title.
    const cx = 1670 + Math.sin(state.time * 0.05) * 420;
    const cy = 1120 + Math.cos(state.time * 0.037) * 300;
    cam.x = cx - renderer.viewW / 2;
    cam.y = cy - renderer.viewH / 2;
    return;
  }
  const p = playerPos(state);
  const look = p.car ? 0.32 : 0.12;
  const tx = p.x + (p.car ? p.car.vx : 0) * look - renderer.viewW / 2;
  const ty = p.y + (p.car ? p.car.vy : 0) * look - renderer.viewH / 2;
  const k = Math.min(1, dt * 5);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.x = clamp(cam.x, 0, Math.max(0, WORLD_W - renderer.viewW));
  cam.y = clamp(cam.y, 0, Math.max(0, WORLD_H - renderer.viewH));
  if (state.shake > 0.1) {
    cam.x += state.rng.range(-state.shake, state.shake);
    cam.y += state.rng.range(-state.shake, state.shake);
    state.shake *= 1 - 6 * dt;
  }
}

function stepWorld(dt) {
  state.time += dt;
  state.allVehicles = state.cars;
  computeWitness();

  if (state.screen === 'play') {
    updatePlayer(dt);
    if (state.player.health <= 0 && state.screen === 'play') {
      state.screen = 'over';
      status.textContent = 'Wasted.';
    }
  }
  for (const car of state.cars) {
    if (car.driver === 'traffic') stepCar(state, car, trafficControl(state, car, dt), dt);
  }
  collideVehiclesAndPeople(dt);
  updatePeds(state, dt);
  if (state.screen === 'play' || state.screen === 'title') updatePolice(state, dt);
  updateBullets(state, dt);
  updatePickups(state, dt);
  updateParticles(state, dt);
  if (state.screen === 'play') updateMissions(state, dt);

  // Fallen walkers are cleared away after a while; the city refills.
  state.peds = state.peds.filter((ped) => ped.down < 22);
  while (state.peds.length < 34) {
    const ped = makePed(state.rng, state.player);
    if (dist(ped, state.player) > 500) state.peds.push(ped);
    else break;
  }
  // Messages and cards fade.
  for (const msg of state.messages) msg.t -= dt;
  state.messages = state.messages.filter((msg) => msg.t > 0);
  if (state.missionCard) {
    state.missionCard.t -= dt;
    if (state.missionCard.t <= 0) state.missionCard = null;
  }
  for (const skid of state.skids) skid.life -= dt * 0.045;
  state.skids = state.skids.filter((s) => s.life > 0).slice(-420);
  if (state.saveDirty) {
    writeSave(state);
    state.saveDirty = false;
    state.saveData = loadSave();
  }
  drainEvents();
  updateCamera(dt);
  // Sound follows the action: engine from the driven car, siren from the law.
  const p = state.player;
  let siren01 = 0;
  for (const cop of state.cops) {
    const cx = cop.kind === 'car' ? cop.car.x : cop.x;
    const cy = cop.kind === 'car' ? cop.car.y : cop.y;
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (d < 700) siren01 = Math.max(siren01, 1 - d / 700);
  }
  sound.update(dt, {
    driving: !!p.car && state.screen === 'play',
    speed01: p.car ? clamp(speedOf(p.car) / 420, 0, 1) : 0,
    siren01: state.muted ? 0 : siren01,
    music: !state.muted && state.screen !== 'title',
  });
  if (Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) {
    recycleTraffic(state);
    recyclePeds(state);
  }
}

function handleScreenKeys() {
  if (state.screen === 'title') {
    if (input.pressed('Enter')) beginPlay(true);
    else if (input.pressed('KeyN')) {
      clearSave();
      state = createGame(seed);
      beginPlay(false);
    }
    return;
  }
  if (state.screen === 'over') {
    if (input.pressed('Enter')) respawn('hospital', 150);
    return;
  }
  if (state.screen === 'busted') {
    if (input.pressed('Enter')) respawn('policeStation', Math.floor(state.player.money * 0.1) + 40);
    return;
  }
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    state.screen = state.screen === 'pause' ? 'play' : 'pause';
    sound.ensure();
    sound.ui();
  }
  if (state.screen === 'pause' && input.pressed('KeyS')) {
    writeSave(state);
    state.saveData = loadSave();
    state.messages.push({ text: 'Saved.', t: 2.4, color: '#57cc5e' });
  }
  if (input.pressed('KeyM')) state.muted = !state.muted;
  if (input.mouse.clicked) sound.ensure();
  if (input.pressed('Enter') && state.screen === 'pause') state.screen = 'play';
}

// ---- Boot: a staged screenshot scene, or the living game -------------------
if (shotName) {
  state.screen = 'play';
  stageShot(state, shotName);
  state.camera.x = clamp((state.player.car ? state.player.car.x : state.player.x) - renderer.viewW / 2, 0, Math.max(0, WORLD_W - renderer.viewW));
  state.camera.y = clamp((state.player.car ? state.player.car.y : state.player.y) - renderer.viewH / 2, 0, Math.max(0, WORLD_H - renderer.viewH));
  let painted = 0;
  const paint = () => {
    renderer.draw(state);
    drawHUD(renderer, state);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  let accumulator = 0;
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
    handleScreenKeys();
    if (state.screen !== 'pause') {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepWorld(STEP);
        accumulator -= STEP;
      }
    }
    renderer.draw(state);
    drawHUD(renderer, state);
    input.endFrame();
  };
  requestAnimationFrame(frame);
}
