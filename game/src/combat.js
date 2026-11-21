// Combat: bullets and what they hit, the damage people and cars take, the
// cash a fallen walker sometimes drops, and the particle bursts the renderer
// paints for impacts, muzzles and fires. Shooting is loud: it frightens
// walkers and, when anyone is around to hear it, it feeds the wanted heat.
import {
  BULLET_DAMAGE, BULLET_RANGE, BULLET_SPEED, HEAT_PER_COP_DOWN, HEAT_PER_PED_DOWN,
  HEAT_PER_PED_HIT_BY_CAR, HEAT_PER_SHOT,
} from './config.js';
import { circleHitsBuilding } from './city.js';
import { scarePeds } from './pedestrians.js';
import { clamp } from './random.js';

/** A puff of particles. kind: 'spark' | 'smoke' | 'fire' | 'splash'. */
export function burst(state, x, y, color, n, speed, kind = 'spark', size = 3) {
  for (let i = 0; i < n; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const s = state.rng.range(speed * 0.25, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (kind === 'smoke' || kind === 'fire' ? 26 : 0),
      life: 0,
      maxLife: state.rng.range(0.3, kind === 'smoke' ? 1.5 : 0.7),
      color, kind, size: size * state.rng.range(0.6, 1.4),
    });
  }
}

/** Fire one bullet. fromPlayer decides who it can hurt and who gets the blame. */
export function spawnBullet(state, x, y, angle, fromPlayer) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    travelled: 0,
    dmg: BULLET_DAMAGE,
    fromPlayer,
  });
}

/** The player's shot, from the muzzle, toward the aim angle. */
export function playerShoot(state) {
  const p = state.player;
  const mx = p.x + Math.cos(p.aim) * 16;
  const my = p.y + Math.sin(p.aim) * 16;
  spawnBullet(state, mx, my, p.aim + state.rng.range(-0.02, 0.02), true);
  burst(state, mx, my, '#ffd166', 3, 60, 'spark', 2.5);
  state.events.push({ type: 'shot', x: p.x, y: p.y, mag: 1 });
  scarePeds(state, p.x, p.y, 300);
  // Shots only raise heat when someone is around to hear them.
  if (state.witnessNear) state.heat = clamp(state.heat + HEAT_PER_SHOT, 0, 5);
  p.muzzle = 0.05;
}

/** An officer's shot: slower cadence handled by police.js, wider spread. */
export function copShoot(state, cop) {
  const p = state.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const base = Math.atan2(ty - cop.y, tx - cop.x);
  const angle = base + state.rng.range(-0.09, 0.09);
  spawnBullet(state, cop.x + Math.cos(angle) * 14, cop.y + Math.sin(angle) * 14, angle, false);
  state.events.push({ type: 'shot', x: cop.x, y: cop.y, mag: 0.7 });
}

/** Hurt the player (cop bullets, crashes at speed). Death is main's call. */
export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.health <= 0) return;
  p.health -= amount;
  p.hurtT = 0.35;
  burst(state, p.car ? p.car.x : p.x, p.car ? p.car.y : p.y, '#e63946', 4, 80);
}

function downPed(state, ped, byPlayer) {
  if (ped.down > 0) return;
  ped.down = 0.001;
  ped.health = 0;
  burst(state, ped.x, ped.y, '#b03030', 8, 90);
  scarePeds(state, ped.x, ped.y, 260);
  if (byPlayer) {
    state.heat = clamp(state.heat + HEAT_PER_PED_DOWN, 0, 5);
    state.stats.pedsDown += 1;
    // Fallen walkers sometimes drop the cash they were carrying.
    if (state.rng.chance(0.55)) {
      state.pickups.push({ x: ped.x, y: ped.y, amount: state.rng.int(8, 30), bob: state.rng.range(0, 6) });
    }
  }
}

/** A walker knocked down by a moving car: same fall, a driver's blame. */
export function knockDownPed(state, ped, byPlayer) {
  if (ped.down > 0) return;
  ped.down = 0.001;
  ped.health = 0;
  burst(state, ped.x, ped.y, '#b03030', 8, 90);
  scarePeds(state, ped.x, ped.y, 260);
  if (byPlayer) {
    state.heat = clamp(state.heat + HEAT_PER_PED_HIT_BY_CAR, 0, 5);
    state.stats.pedsDown += 1;
  }
}

/** An officer knocked down by a moving car. */
export function knockDownCop(state, cop, byPlayer) {
  downCop(state, cop, byPlayer);
}

function downCop(state, cop, byPlayer) {
  if (cop.down > 0) return;
  cop.down = 0.001;
  cop.health = 0;
  burst(state, cop.x, cop.y, '#33415c', 8, 90);
  scarePeds(state, cop.x, cop.y, 260);
  if (byPlayer) {
    state.heat = clamp(state.heat + HEAT_PER_COP_DOWN, 0, 5);
    state.stats.copsDown += 1;
  }
}

/** Move every bullet, test it against the world, apply what it hits. */
export function updateBullets(state, dt) {
  const kept = [];
  for (const b of state.bullets) {
    const stepX = b.vx * dt;
    const stepY = b.vy * dt;
    b.x += stepX;
    b.y += stepY;
    b.travelled += Math.hypot(stepX, stepY);
    let dead = b.travelled > BULLET_RANGE;
    if (!dead && circleHitsBuilding(state.city, b.x, b.y, 2)) {
      burst(state, b.x, b.y, '#ffd166', 3, 70);
      dead = true;
    }
    if (!dead) {
      // Cars first: a bullet into a panel stops there.
      for (const car of state.allVehicles) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < car.length * 0.46) {
          car.health -= b.dmg * 0.3;
          if (car.health <= 0 && car.burning === 0) car.burning = 0.001;
          burst(state, b.x, b.y, '#ffd166', 4, 90);
          state.events.push({ type: 'hit', x: b.x, y: b.y, mag: 0.6 });
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.fromPlayer) {
      for (const ped of state.peds) {
        if (ped.down === 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 10) {
          ped.health -= b.dmg;
          burst(state, b.x, b.y, '#b03030', 4, 80);
          if (ped.health <= 0) downPed(state, ped, true);
          else { ped.fleeT = 3; ped.fleeX = b.x; ped.fleeY = b.y; }
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of state.cops) {
          if (cop.kind !== 'foot' || cop.down > 0) continue;
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 11) {
            cop.health -= b.dmg;
            burst(state, b.x, b.y, '#33415c', 4, 80);
            if (cop.health <= 0) downCop(state, cop, true);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && !b.fromPlayer) {
      const p = state.player;
      const tx = p.car ? p.car.x : p.x;
      const ty = p.car ? p.car.y : p.y;
      const rr = p.car ? p.car.length * 0.46 : 11;
      if (Math.hypot(tx - b.x, ty - b.y) < rr) {
        // A car soaks most of a bullet meant for its driver.
        damagePlayer(state, p.car ? b.dmg * 0.22 : b.dmg * 0.55);
        dead = true;
      }
    }
    if (!dead) kept.push(b);
  }
  state.bullets = kept;
}

/** Cash pickups: drift toward the player when close, collect on touch. */
export function updatePickups(state, dt) {
  const p = state.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const kept = [];
  for (const pk of state.pickups) {
    pk.bob += dt * 5;
    const d = Math.hypot(pk.x - tx, pk.y - ty);
    if (d < 120) {
      pk.x += ((tx - pk.x) / d) * 130 * dt;
      pk.y += ((ty - pk.y) / d) * 130 * dt;
    }
    if (d < 26) {
      p.money += pk.amount;
      state.stats.earned += pk.amount;
      state.events.push({ type: 'cash', x: pk.x, y: pk.y, mag: 1 });
      state.messages.push({ text: `+$${pk.amount}`, t: 1.6, color: '#57cc5e' });
      continue;
    }
    kept.push(pk);
  }
  state.pickups = kept;
}

/** Particles age and die; burning cars keep smoking and can cook off. */
export function updateParticles(state, dt) {
  const kept = [];
  for (const pt of state.particles) {
    pt.life += dt;
    if (pt.life >= pt.maxLife) continue;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 1.6 * dt;
    pt.vy *= 1 - 1.6 * dt;
    kept.push(pt);
  }
  state.particles = kept;
  for (const car of state.allVehicles) {
    if (car.burning > 0) {
      car.burning += dt;
      if (state.rng.chance(0.5)) {
        burst(state, car.x + state.rng.range(-12, 12), car.y + state.rng.range(-8, 8),
          state.rng.chance(0.5) ? '#3a3f47' : '#e76f51', 1, 26, state.rng.chance(0.6) ? 'smoke' : 'fire', 6);
      }
      if (car.burning > 6 && !car.exploded) {
        car.exploded = true;
        car.health = -50;
        burst(state, car.x, car.y, '#f4d35e', 26, 240, 'fire', 6);
        burst(state, car.x, car.y, '#3a3f47', 16, 120, 'smoke', 8);
        state.events.push({ type: 'crash', x: car.x, y: car.y, mag: 1 });
        // A cook-off hurts whoever stands too close — including the player.
        const p = state.player;
        const pd = Math.hypot((p.car ? p.car.x : p.x) - car.x, (p.car ? p.car.y : p.y) - car.y);
        if (pd < 90 && p.car !== car) damagePlayer(state, 22);
      }
    }
  }
}
