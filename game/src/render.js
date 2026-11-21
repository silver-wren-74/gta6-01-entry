// The renderer: everything the camera sees of Port Solana, painted on one
// canvas in world order — bay and beach, streets, blocks and roofs, docks,
// palms, skid marks, cars, walkers, officers, Dario, bullets and sparks —
// with soft shadows thrown south-east by a hard sun. The HUD and the screens
// live in hud.js; this file is only the world.
import {
  BEACH_X, COLORS, ROADS_X, ROADS_Y, ROAD_W, WATER_X, WORLD_H, WORLD_W,
} from './config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 960;
  let viewH = 540;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGround(state, cam) {
    const city = state.city;
    const x0 = cam.x - 80;
    const y0 = cam.y - 80;
    const x1 = cam.x + viewW + 80;
    const y1 = cam.y + viewH + 80;

    // Land base, then the bay with its slow shimmer, then the beach strip.
    ctx.fillStyle = COLORS.pavement;
    ctx.fillRect(cam.x - 4, cam.y - 4, viewW + 8, viewH + 8);
    const wg = ctx.createLinearGradient(Math.max(x0, 0), 0, WATER_X, 0);
    wg.addColorStop(0, COLORS.waterDeep);
    wg.addColorStop(1, COLORS.water);
    ctx.fillStyle = wg;
    ctx.fillRect(x0, y0, WATER_X - x0, y1 - y0);
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 26; i += 1) {
      const sx = ((i * 173 + Math.sin(state.time * 0.7 + i) * 22) % WATER_X + WATER_X) % WATER_X;
      const sy = y0 + ((i * 331) % Math.max(1, y1 - y0));
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 16, sy);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(WATER_X, y0, BEACH_X - WATER_X, y1 - y0);

    // Parks: grass with a pale path cross.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = COLORS.parkPath;
      ctx.fillRect(park.x, park.y + park.h / 2 - 7, park.w, 14);
      ctx.fillRect(park.x + park.w / 2 - 7, park.y, 14, park.h);
    }

    // Sidewalk aprons behind buildings, then the streets over everything.
    ctx.fillStyle = COLORS.sidewalk;
    for (const b of city.buildings) {
      if (b.x - 12 > x1 || b.x + b.w + 12 < x0 || b.y - 12 > y1 || b.y + b.h + 12 < y0) continue;
      ctx.fillRect(b.x - 11, b.y - 11, b.w + 22, b.h + 22);
    }
    ctx.fillStyle = COLORS.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
    // Kerb edges and dashed centre lines.
    ctx.strokeStyle = COLORS.roadEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const rx of ROADS_X) {
      ctx.moveTo(rx - ROAD_W / 2, 0); ctx.lineTo(rx - ROAD_W / 2, WORLD_H);
      ctx.moveTo(rx + ROAD_W / 2, 0); ctx.lineTo(rx + ROAD_W / 2, WORLD_H);
    }
    for (const ry of ROADS_Y) {
      ctx.moveTo(0, ry - ROAD_W / 2); ctx.lineTo(WORLD_W, ry - ROAD_W / 2);
      ctx.moveTo(0, ry + ROAD_W / 2); ctx.lineTo(WORLD_W, ry + ROAD_W / 2);
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    ctx.beginPath();
    for (const rx of ROADS_X) { ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); }
    for (const ry of ROADS_Y) { ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); }
    ctx.stroke();
    ctx.setLineDash([]);
    // Crosswalks at every crossing.
    ctx.fillStyle = COLORS.crosswalk;
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(rx + i * 18 - 6, ry - ROAD_W / 2 - 12, 12, 9);
          ctx.fillRect(rx + i * 18 - 6, ry + ROAD_W / 2 + 3, 12, 9);
          ctx.fillRect(rx - ROAD_W / 2 - 12, ry + i * 18 - 6, 9, 12);
          ctx.fillRect(rx + ROAD_W / 2 + 3, ry + i * 18 - 6, 9, 12);
        }
      }
    }

    // Docks: planks over the water, posts at the corners.
    for (const d of city.docks) {
      ctx.fillStyle = '#9a6b45';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(60,38,20,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = d.x + 18; x < d.x + d.w; x += 18) { ctx.moveTo(x, d.y); ctx.lineTo(x, d.y + d.h); }
      ctx.stroke();
      ctx.fillStyle = '#6e4f30';
      for (const [px, py] of [[d.x + 4, d.y + 4], [d.x + 4, d.y + d.h - 10], [d.x + d.w - 10, d.y + 4], [d.x + d.w - 10, d.y + d.h - 10]]) {
        ctx.fillRect(px, py, 6, 6);
      }
    }
    // The Tide Runner, moored at Pier 9: a white hull with a neon stripe.
    ctx.save();
    ctx.translate(96, 1560);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(-64, -16, 138, 38, 16); ctx.fill();
    ctx.fillStyle = '#f2f0e6';
    roundRect(-68, -20, 138, 38, 16); ctx.fill();
    ctx.fillStyle = '#ff5d8f';
    ctx.fillRect(-68, -4, 138, 7);
    ctx.fillStyle = '#264653';
    roundRect(6, -13, 34, 24, 5); ctx.fill();
    ctx.restore();
  }

  function drawBuildings(state, cam) {
    const x0 = cam.x - 120;
    const y0 = cam.y - 120;
    const x1 = cam.x + viewW + 120;
    const y1 = cam.y + viewH + 120;
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      const lift = 4 + b.floors * 1.6;
      // Sun from the north-west: the shadow falls south-east, longer when taller.
      ctx.fillStyle = 'rgba(40,30,20,0.25)';
      ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      // Rooftop clutter: a water tank or an AC box, and a parapet line.
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(b.x + b.w * 0.16, b.y + b.h * 0.16, Math.min(30, b.w * 0.2), Math.min(22, b.h * 0.2));
      if (b.name && b.w > 120 && b.h > 74) {
        ctx.fillStyle = 'rgba(30,20,40,0.55)';
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 4);
      }
    }
    // Palms: a trunk dot and six fronds.
    for (const t of state.city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.strokeStyle = COLORS.palmLeaf;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + t.x * 0.01;
        ctx.moveTo(t.x + 5, t.y + 5);
        ctx.quadraticCurveTo(
          t.x + Math.cos(a) * 13 * t.s, t.y + Math.sin(a) * 13 * t.s - 3,
          t.x + Math.cos(a) * 19 * t.s, t.y + Math.sin(a) * 19 * t.s + 3,
        );
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(t.x + 5, t.y + 6, 6 * t.s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.palmTrunk;
      ctx.beginPath(); ctx.arc(t.x, t.y, 3.4 * t.s, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawCar(state, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = car.length;
    const W = car.width;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(-L / 2 + 3, -W / 2 + 4, L, W, 6); ctx.fill();
    if (car.isMissionCar) {
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.6 + Math.sin(state.time * 5) * 0.3})`;
      ctx.lineWidth = 3;
      roundRect(-L / 2 - 5, -W / 2 - 5, L + 10, W + 10, 9); ctx.stroke();
    }
    ctx.fillStyle = car.exploded ? '#2b2b2b' : car.color;
    roundRect(-L / 2, -W / 2, L, W, 6); ctx.fill();
    if (car.type === 'cop') {
      ctx.fillStyle = '#22252b';
      roundRect(-L / 2, -W / 2, L * 0.36, W, 5); ctx.fill();
      roundRect(L * 0.18, -W / 2, L * 0.32, W, 5); ctx.fill();
      // Light bar, flashing with the frame clock.
      const phase = Math.floor(state.time * 6 + car.id) % 2 === 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#5e2b27';
      ctx.fillRect(-5, -W / 2 + 2, 10, 6);
      ctx.fillStyle = phase ? '#274b73' : '#3fa9f5';
      ctx.fillRect(-5, W / 2 - 8, 10, 6);
    }
    // Cabin and glass.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    roundRect(-L * 0.16, -W / 2 + 3, L * 0.34, W - 6, 4); ctx.fill();
    ctx.fillStyle = 'rgba(160,210,235,0.5)';
    ctx.fillRect(L * 0.14, -W / 2 + 4, 4, W - 8);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#22252b';
      ctx.fillRect(-4, -5, 8, 10);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-3, -3, 6, 6);
    }
    if (car.type === 'truck') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(-L / 2 + 3, -W / 2 + 3, L * 0.3, W - 6);
    }
    if (car.type === 'van') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-L * 0.05, -W / 2 + 3, L * 0.2, W - 6);
    }
    // Headlights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
    ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
    ctx.restore();
    // Damage smoke is particles' job; a hurt car also drips a dark stain.
    if (car.health < 45 && !car.exploded) {
      ctx.fillStyle = 'rgba(30,30,30,0.10)';
      ctx.beginPath(); ctx.arc(car.x, car.y, car.length * 0.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPerson(x, y, angle, body, skin, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);
    if (opts.down) ctx.globalAlpha = 0.75;
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    // Shoulders point the way they face; a gun arm when armed.
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(1.5, 0, 5.2, 0, Math.PI * 2); ctx.fill();
    if (opts.gun) {
      ctx.strokeStyle = '#1d1d22';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, 3); ctx.lineTo(17, 3); ctx.stroke();
    }
    if (opts.cap) {
      ctx.fillStyle = opts.cap;
      ctx.beginPath(); ctx.arc(2.5, 0, 5.4, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
      ctx.fillRect(2, -1.6, 6, 3.2);
    }
    ctx.restore();
  }

  function draw(state) {
    const cam = state.camera;
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawGround(state, cam);
    // Skid marks under everything that moves.
    for (const s of state.skids) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = `rgba(20,20,24,${0.34 * s.life})`;
      ctx.fillRect(-7, -2, 14, 4);
      ctx.restore();
    }
    drawBuildings(state, cam);
    // Cash pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 2;
      ctx.fillStyle = COLORS.cash;
      ctx.fillRect(pk.x - 7, pk.y - 4 + bob, 14, 8);
      ctx.fillStyle = '#eaffea';
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 3 + bob);
    }
    // The objective beacon: a pillar of light and a floating diamond.
    const ob = state.objective;
    if (ob && state.screen === 'play') {
      const pulse = 0.55 + Math.sin(state.time * 4) * 0.2;
      const grad = ctx.createLinearGradient(0, ob.y - 190, 0, ob.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, ob.color);
      ctx.globalAlpha = pulse * 0.5;
      ctx.fillStyle = grad;
      ctx.fillRect(ob.x - 9, ob.y - 190, 18, 190);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(ob.x, ob.y - 26 + Math.sin(state.time * 3) * 5);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = ob.color;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    for (const car of state.allVehicles) drawCar(state, car);
    for (const ped of state.peds) {
      if (ped.down > 0) drawPerson(ped.x, ped.y, ped.angle + 1.2, '#6b6b6b', ped.skin, { down: true });
      else drawPerson(ped.x + Math.sin(ped.bob) * 0.8, ped.y, ped.angle, ped.shirt, ped.skin, {});
    }
    for (const cop of state.cops) {
      if (cop.kind !== 'foot') continue;
      if (cop.down > 0) drawPerson(cop.x, cop.y, cop.angle + 1.2, '#23272e', '#e8b08a', { down: true });
      else drawPerson(cop.x, cop.y, cop.angle, '#2b3a55', '#e8b08a', { gun: state.heat >= 1, cap: '#16233c' });
    }
    // Dario, when he is not behind a wheel.
    const p = state.player;
    if (!p.car && state.screen !== 'title') {
      drawPerson(p.x, p.y, p.aim, COLORS.playerBody, COLORS.playerSkin, { gun: true });
      if (p.muzzle > 0) {
        const mx = p.x + Math.cos(p.aim) * 22;
        const my = p.y + Math.sin(p.aim) * 22;
        ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
        ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Bullets as short bright streaks.
    ctx.strokeStyle = '#ffe9a3';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (const b of state.bullets) {
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    // Particles.
    for (const pt of state.particles) {
      const t = 1 - pt.life / pt.maxLife;
      if (pt.kind === 'smoke') {
        ctx.fillStyle = `rgba(52,54,60,${0.30 * t})`;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - t * 0.6), 0, Math.PI * 2); ctx.fill();
      } else if (pt.kind === 'fire') {
        ctx.fillStyle = t > 0.5 ? `rgba(244, 211, 94, ${t})` : `rgba(231, 111, 81, ${t})`;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * t + 1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = t;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    // A warm vignette to sit the scene in late light.
    const vg = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.42, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.78);
    vg.addColorStop(0, 'rgba(255,170,80,0)');
    vg.addColorStop(1, 'rgba(64,20,60,0.20)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  return {
    draw,
    get viewW() { return viewW; },
    get viewH() { return viewH; },
    ctx,
  };
}
