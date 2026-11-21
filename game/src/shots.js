// The screenshot scenes behind ?shot=cover|city|mission|drive. Each one
// arranges the real game state — Dario, cars, officers, heat, an objective —
// the way a moment of play would, steps the world a few times so tyres,
// walkers and light bars settle, and leaves the frame for main to paint.
// Same seed, same frame: the staging draws only from the state's rng.
import { LANDMARKS } from './city.js';
import { makeCar } from './vehicles.js';

function putPlayerInCar(state, type, x, y, angle, vx = 0, vy = 0, color = null) {
  const car = makeCar(state.rng, type, x, y, angle, 'player');
  if (color) car.color = color;
  car.vx = vx;
  car.vy = vy;
  state.cars.push(car);
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  return car;
}

function addCopCar(state, x, y, angle) {
  const car = makeCar(state.rng, 'cop', x, y, angle, 'cop');
  state.cars.push(car);
  state.cops.push({ kind: 'car', car, down: 0 });
  return car;
}

function addFootCop(state, x, y, angle) {
  state.cops.push({ kind: 'foot', x, y, angle, health: 60, fireCd: 1.4, down: 0, bob: 0 });
}

function addTraffic(state, type, x, y, angle) {
  const car = makeCar(state.rng, type, x, y, angle, 'parked');
  state.cars.push(car);
  return car;
}

/** Stage the named scene on a freshly built state. Unknown names stage 'city'. */
export function stageShot(state, name) {
  const p = state.player;
  state.screen = 'play';
  if (name === 'cover') {
    // The Comet run: gold sport car, three stars, two Interceptors behind,
    // the chop shop marker across the map — the whole game in one frame.
    const car = putPlayerInCar(state, 'sport', 1560, 1043, 0.12, 305, 18, '#f4d35e');
    car.isMissionCar = true;
    state.missionCar = car;
    addCopCar(state, 1330, 1043, 0.05);
    addCopCar(state, 1235, 997, -0.06);
    addTraffic(state, 'taxi', 1980, 997, Math.PI);
    addTraffic(state, 'sedan', 1900, 1043, 0);
    state.heat = 3;
    state.seenNow = true;
    const at = LANDMARKS.chopShop;
    state.objective = { x: at.x, y: at.y, label: 'Deliver the Comet to Reyes Chop Shop', color: '#ff5d8f', dist: 1900 };
    p.money = 400;
  } else if (name === 'mission') {
    // Pier 9: covering the Tide Runner's crew, hold timer half gone, the
    // PSPD arriving down the coast road.
    p.x = 210;
    p.y = 1546;
    p.aim = 0.5;
    addCopCar(state, 474, 1470, Math.PI / 2);
    addFootCop(state, 330, 1505, Math.PI);
    addTraffic(state, 'van', 474, 1830, -Math.PI / 2);
    state.heat = 2;
    state.seenNow = true;
    const at = LANDMARKS.pier;
    state.objective = { x: at.x, y: at.y, label: 'Cover the crew while they cast off', color: '#ff5d8f', dist: 60, holdPct: 0.55 };
    state.missionCard = {
      title: 'Mission 5 — Neon Tide',
      lines: ['Vera: Keep them off the pier until the lines are cast.'],
      t: 7,
    };
    p.money = 4300;
  } else if (name === 'drive') {
    // Flat out down the coast road in a borrowed sedan, courier clock running.
    putPlayerInCar(state, 'sedan', 474, 1690, Math.PI / 2, 8, 385, '#3e7cb1');
    addTraffic(state, 'truck', 447, 1470, Math.PI / 2);
    addTraffic(state, 'sport', 497, 1420, Math.PI / 2);
    addCopCar(state, 447, 1930, Math.PI / 2);
    state.heat = 1;
    state.seenNow = true;
    const at = LANDMARKS.hotelMarlin;
    state.objective = { x: at.x, y: at.y, label: 'Deliver to Hotel Marlin — 32s', color: '#57cc5e', dist: 2450 };
    p.money = 1250;
    // A breath of tyre smoke behind the rear wheels.
    for (let i = 0; i < 10; i += 1) {
      state.particles.push({
        x: 474 + state.rng.range(-9, 9), y: 1650 - i * 7,
        vx: state.rng.range(-8, 8), vy: state.rng.range(-16, -4),
        life: state.rng.range(0, 0.4), maxLife: 1.2, color: '#3a3f47', kind: 'smoke', size: 7,
      });
    }
  } else {
    // 'city': on foot downtown at the morning rush, rooftops on every side,
    // traffic on both avenues, and Vera's first marker waiting across town.
    p.x = 2206;
    p.y = 954;
    p.aim = 0.3;
    addTraffic(state, 'taxi', 2293, 1180, Math.PI / 2);
    addTraffic(state, 'sedan', 1850, 1043, 0);
    addTraffic(state, 'sport', 2247, 700, -Math.PI / 2);
    const at = LANDMARKS.start;
    state.objective = { x: at.x, y: at.y, label: "Meet Vera's contact — First Run", color: '#ffd166', dist: 1655 };
    p.money = 120;
  }
}
