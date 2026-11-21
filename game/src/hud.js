// The HUD and the screens: everything painted over the world — money and
// health, the wanted stars (which blink while the police are still
// searching), the objective banner, Vera's mission cards, the minimap with
// its police blips, and the title, pause, WASTED and BUSTED screens.
import { COLORS, ROADS_X, ROADS_Y, WATER_X, WORLD_H, WORLD_W } from './config.js';

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(9, 13, 22, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function star(ctx, x, y, r, filled, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

function drawMinimap(ctx, state, viewW, viewH) {
  const mw = 208;
  const mh = 150;
  const x = viewW - mw - 16;
  const y = viewH - mh - 16;
  const s = Math.min(mw / WORLD_W, mh / WORLD_H);
  panel(ctx, x - 6, y - 6, mw + 12, mh + 12, 0.62);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#8f887a';
  ctx.fillRect(x, y, mw, mh);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x, y, WATER_X * s, mh);
  ctx.strokeStyle = '#3a3f47';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const rx of ROADS_X) { ctx.moveTo(x + rx * s, y); ctx.lineTo(x + rx * s, y + WORLD_H * s); }
  for (const ry of ROADS_Y) { ctx.moveTo(x, y + ry * s); ctx.lineTo(x + WORLD_W * s, y + ry * s); }
  ctx.stroke();
  // The objective, pulsing.
  const ob = state.objective;
  if (ob) {
    ctx.fillStyle = ob.color;
    ctx.beginPath();
    ctx.arc(x + ob.x * s, y + ob.y * s, 4 + Math.sin(state.time * 5) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.missionCar && !state.missionCar.exploded) {
    ctx.fillStyle = '#f4d35e';
    ctx.fillRect(x + state.missionCar.x * s - 2.5, y + state.missionCar.y * s - 2.5, 5, 5);
  }
  // Police blips flash blue and red.
  const phase = Math.floor(state.time * 5) % 2 === 0;
  for (const cop of state.cops) {
    const cx = cop.kind === 'car' ? cop.car.x : cop.x;
    const cy = cop.kind === 'car' ? cop.car.y : cop.y;
    ctx.fillStyle = phase ? '#3fa9f5' : '#ff3b30';
    ctx.fillRect(x + cx * s - 2, y + cy * s - 2, 4, 4);
  }
  // Dario: a white arrow at his heading.
  const p = state.player;
  const px = x + (p.car ? p.car.x : p.x) * s;
  const py = y + (p.car ? p.car.y : p.y) * s;
  const heading = p.car ? p.car.angle : p.aim;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawBanner(ctx, state, viewW) {
  const ob = state.objective;
  if (!ob) return;
  const metres = Math.max(0, Math.round(ob.dist / 9));
  const text = `${ob.label}  ·  ${metres} m`;
  ctx.font = '600 16px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 36;
  panel(ctx, viewW / 2 - w / 2, 14, w, 34, 0.6);
  ctx.fillStyle = ob.color;
  ctx.beginPath();
  ctx.arc(viewW / 2 - w / 2 + 18, 31, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(text, viewW / 2 + 8, 37);
  if (ob.holdPct !== undefined) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(viewW / 2 - 90, 54, 180, 7);
    ctx.fillStyle = ob.color;
    ctx.fillRect(viewW / 2 - 90, 54, 180 * Math.min(1, ob.holdPct), 7);
  }
}

function drawMissionCard(ctx, state, viewW) {
  const card = state.missionCard;
  if (!card || card.t <= 0) return;
  const alpha = Math.min(1, card.t / 1.2);
  const w = Math.min(560, viewW - 40);
  const h = 58 + card.lines.length * 21;
  const x = viewW / 2 - w / 2;
  const y = 64;
  ctx.globalAlpha = alpha;
  panel(ctx, x, y, w, h, 0.78);
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(card.title, viewW / 2, y + 26);
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '14px system-ui, sans-serif';
  card.lines.forEach((line, i) => {
    // Wrap long lines by hand: split at the last space before 78 chars.
    let rest = line;
    let row = 0;
    while (rest.length > 78) {
      const cut = rest.lastIndexOf(' ', 78);
      ctx.fillText(rest.slice(0, cut), viewW / 2, y + 50 + (i + row) * 21);
      rest = rest.slice(cut + 1);
      row += 1;
    }
    ctx.fillText(rest, viewW / 2, y + 50 + (i + row) * 21);
  });
  ctx.globalAlpha = 1;
}

export function drawHUD(renderer, state) {
  const { ctx } = renderer;
  const viewW = renderer.viewW;
  const viewH = renderer.viewH;
  const p = state.player;

  if (state.screen === 'title') {
    // A scrim so the title reads over the living city behind it.
    const grad = ctx.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, 'rgba(10,10,30,0.42)');
    grad.addColorStop(0.55, 'rgba(10,10,30,0.10)');
    grad.addColorStop(1, 'rgba(10,10,30,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText('NEON TIDE', viewW / 2 + 4, viewH * 0.34 + 5);
    const titleGrad = ctx.createLinearGradient(viewW / 2 - 260, 0, viewW / 2 + 260, 0);
    titleGrad.addColorStop(0, '#ffd166');
    titleGrad.addColorStop(0.5, '#ff5d8f');
    titleGrad.addColorStop(1, '#06d6a0');
    ctx.fillStyle = titleGrad;
    ctx.fillText('NEON TIDE', viewW / 2, viewH * 0.34);
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = '#fdf6e3';
    ctx.fillText('An open-world crime story in Port Solana — five jobs for Vera Calloway,', viewW / 2, viewH * 0.34 + 38);
    ctx.fillText('a city of palms and neon, and the PSPD between you and the tide.', viewW / 2, viewH * 0.34 + 64);
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    const hasSave = !!state.saveData;
    ctx.fillText(hasSave ? 'ENTER — continue      N — new game' : 'ENTER — start the story', viewW / 2, viewH * 0.62);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('WASD / arrows — move and drive      E — enter / leave a car      Mouse — aim, click — shoot', viewW / 2, viewH * 0.62 + 34);
    ctx.fillText('SHIFT — sprint / boost your legs      SPACE — handbrake      P — pause      M — mute', viewW / 2, viewH * 0.62 + 56);
    if (hasSave) {
      ctx.fillStyle = '#57cc5e';
      ctx.fillText(`Save found: $${state.saveData.money}, ${state.saveData.storyDone ? 'story complete' : `mission ${state.saveData.storyIdx + 1} of 5 next`}`, viewW / 2, viewH * 0.62 + 84);
    }
    return;
  }

  // Money and health, top-left.
  panel(ctx, 14, 14, 208, 64, 0.55);
  ctx.textAlign = 'left';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillStyle = '#57cc5e';
  ctx.fillText(`$${p.money}`, 28, 46);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(28, 56, 180, 9);
  ctx.fillStyle = p.health > 30 ? '#e63946' : (Math.floor(state.time * 6) % 2 ? '#e63946' : '#ff8fa3');
  ctx.fillRect(28, 56, 180 * Math.max(0, p.health) / 100, 9);

  // Wanted stars, top-right. They blink while the police are still searching.
  const stars = Math.ceil(state.heat);
  if (stars > 0) {
    panel(ctx, viewW - 196, 14, 182, 44, 0.55);
    const searching = !state.seenNow && state.heat > 0;
    const blink = searching && Math.floor(state.time * 2.4) % 2 === 0;
    for (let i = 0; i < 5; i += 1) {
      star(ctx, viewW - 168 + i * 34, 36, 13, i < stars && !blink, '#ffd166');
    }
  }

  drawBanner(ctx, state, viewW);
  drawMissionCard(ctx, state, viewW);

  // The prompt line ("E — take the Comet") and the message feed, bottom-centre-left.
  ctx.textAlign = 'left';
  let msgY = viewH - 190;
  for (const msg of state.messages) {
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(9,13,22,0.5)';
    const w = ctx.measureText(msg.text).width + 18;
    ctx.fillRect(14, msgY - 16, w, 22);
    ctx.fillStyle = msg.color || '#fff';
    ctx.fillText(msg.text, 23, msgY);
    msgY -= 26;
  }
  if (state.promptText) {
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(state.promptText, viewW / 2, viewH - 108);
  }

  // Driving info, bottom-left: the car, its speed, its health.
  if (p.car) {
    panel(ctx, 14, viewH - 92, 232, 78, 0.55);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(p.car.label, 28, viewH - 66);
    const kmh = Math.round(Math.hypot(p.car.vx, p.car.vy) * 0.31);
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`${kmh} km/h`, 28, viewH - 38);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(118, viewH - 48, 112, 8);
    ctx.fillStyle = p.car.health > 35 ? '#57cc5e' : '#e63946';
    ctx.fillRect(118, viewH - 48, 112 * Math.max(0, p.car.health) / 100, 8);
  }

  // The arrest meter, centre-bottom, only while it is filling.
  if (p.bustedMeter > 0.02 && state.screen === 'play') {
    ctx.textAlign = 'center';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillStyle = '#3fa9f5';
    ctx.fillText('BUSTED?', viewW / 2, viewH - 150);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(viewW / 2 - 90, viewH - 142, 180, 9);
    ctx.fillStyle = '#3fa9f5';
    ctx.fillRect(viewW / 2 - 90, viewH - 142, 180 * p.bustedMeter, 9);
  }

  drawMinimap(ctx, state, viewW, viewH);

  // Hurt flash and the low-health heartbeat.
  if (p.hurtT > 0) {
    ctx.fillStyle = `rgba(200, 30, 40, ${0.22 * (p.hurtT / 0.35)})`;
    ctx.fillRect(0, 0, viewW, viewH);
  } else if (p.health < 28 && state.screen === 'play') {
    ctx.fillStyle = `rgba(200, 30, 40, ${0.08 + Math.sin(state.time * 5) * 0.04})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  if (state.screen === 'pause') {
    ctx.fillStyle = 'rgba(8, 10, 18, 0.66)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '900 54px system-ui, sans-serif';
    ctx.fillText('PAUSED', viewW / 2, viewH * 0.4);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(`Money $${p.money} · Missions done ${state.stats.missionsDone} · Courier runs ${state.stats.courierDone} · Earned $${state.stats.earned}`, viewW / 2, viewH * 0.4 + 42);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('P — resume      S — save here      ENTER — resume', viewW / 2, viewH * 0.4 + 78);
  }
  if (state.screen === 'over' || state.screen === 'busted') {
    const wasted = state.screen === 'over';
    ctx.fillStyle = wasted ? 'rgba(60, 4, 10, 0.62)' : 'rgba(6, 16, 44, 0.62)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.font = '900 76px system-ui, sans-serif';
    ctx.fillStyle = wasted ? '#e63946' : '#3fa9f5';
    ctx.fillText(wasted ? 'WASTED' : 'BUSTED', viewW / 2, viewH * 0.44);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(wasted ? 'The Harbor Hospital patches you up. It is not free.' : 'The PSPD take their cut and let you walk.', viewW / 2, viewH * 0.44 + 40);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('ENTER — back on the street', viewW / 2, viewH * 0.44 + 74);
  }
}
