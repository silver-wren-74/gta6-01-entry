// The story of Neon Tide, in five jobs for the fixer Vera Calloway, plus the
// endless courier work of the Solana Sprint depot. A small objective engine
// walks each mission's steps — go somewhere, steal a named car, shake the
// heat, hold a pier — pays out at the end, and always knows the one marker
// the HUD and the world should be showing.
import { LANDMARKS } from './city.js';
import { clamp } from './random.js';
import { makeCar } from './vehicles.js';

// Step types: goto (reach the point), steal (get into the flagged car),
// deliverCar (be in the flagged car at the point), escape (heat to zero, or
// reach the safehouse), hold (stay in the circle while the timer runs).
export const STORY = [
  {
    id: 'first-run',
    title: 'First Run',
    from: 'start',
    reward: 400,
    intro: [
      'Vera (phone): Dario? Vera Calloway. I move things that do not fit in envelopes.',
      'A parcel is waiting at Marina Market. Take it to the Hotel Marlin. Quietly.',
    ],
    steps: [
      { type: 'goto', at: 'marinaMarket', label: 'Pick up the parcel at Marina Market' },
      { type: 'goto', at: 'hotelMarlin', label: 'Deliver the parcel to the Hotel Marlin' },
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    from: 'cafeBrisa',
    reward: 900,
    intro: [
      'Vera: A gold Comet GT is sitting at Palms Garage with the keys in it. Criminal, really.',
      'Bring it to Reyes Chop Shop. If the alarm wakes the PSPD, that is your problem.',
    ],
    steps: [
      { type: 'goto', at: 'palmsGarage', label: 'Go to Palms Garage' },
      { type: 'steal', label: 'Steal the gold Comet GT' },
      { type: 'deliverCar', at: 'chopShop', label: 'Deliver the Comet to Reyes Chop Shop' },
    ],
  },
  {
    id: 'collections',
    title: 'Collections',
    from: 'tideRecords',
    reward: 1200,
    intro: [
      'Vera: Three friends of mine owe for protection they never asked for.',
      'Palma Jewelers, Café Brisa, Marina Market. Collect the envelopes. Smile.',
    ],
    steps: [
      { type: 'goto', at: 'palmaJewelers', label: 'Collect at Palma Jewelers', heat: 0.7, note: 'Envelope collected. He did not smile back.' },
      { type: 'goto', at: 'cafeBrisa', label: 'Collect at Café Brisa', heat: 0.7, note: 'Envelope collected. The espresso was on the house.' },
      { type: 'goto', at: 'marinaMarket', label: 'Collect at Marina Market', heat: 0.7, note: 'Last envelope collected.' },
    ],
  },
  {
    id: 'the-long-arm',
    title: 'The Long Arm',
    from: 'bank',
    reward: 1800,
    intro: [
      'Vera: The Solana Bank keeps a ledger that could sink half the port, me included.',
      'Lift it, and then disappear: lose the PSPD completely, or reach Casa Azul.',
    ],
    steps: [
      { type: 'goto', at: 'bank', label: 'Take the ledger from Solana Bank', heatSet: 4, note: 'Alarms. Everywhere. Run.' },
      { type: 'escape', label: 'Lose the police — or reach the Casa Azul safehouse' },
    ],
  },
  {
    id: 'neon-tide',
    title: 'Neon Tide',
    from: 'hotelMarlin',
    reward: 3000,
    intro: [
      'Vera: Last job, Dario. The ledger goes out with the tide on the Tide Runner.',
      'Get to Pier 9 and keep the boat crew covered while they cast off. Then we are ghosts.',
    ],
    steps: [
      { type: 'goto', at: 'pier', label: 'Reach Pier 9 and the Tide Runner', heatSet: 3 },
      { type: 'hold', at: 'pier', seconds: 6, label: 'Cover the crew while they cast off' },
    ],
  },
];

const COURIER_SPOTS = ['marinaMarket', 'hotelMarlin', 'palmsGarage', 'bank', 'tideRecords', 'cafeBrisa', 'palmaJewelers', 'safehouse', 'depot', 'chopShop'];

function playerPoint(state) {
  const p = state.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

function startStep(state, mission, step) {
  // Notes and heat on 'goto' steps fire on arrival, in updateMissions; the
  // only step that needs setting up in advance is the steal.
  if (step.type === 'steal') {
    // The gold Comet, parked at the garage with the keys in it.
    const spot = LANDMARKS.palmsGarage;
    const car = makeCar(state.rng, 'sport', spot.x - 60, spot.y - 30, Math.PI / 2, 'parked');
    car.color = '#f4d35e';
    car.isMissionCar = true;
    state.cars.push(car);
    state.missionCar = car;
  }
}

/** Begin story mission `idx`: intro card up, first step armed. */
export function startMission(state, idx) {
  const mission = STORY[idx];
  state.story.active = true;
  state.story.stepIdx = 0;
  state.missionCard = { title: `Mission ${idx + 1} — ${mission.title}`, lines: mission.intro, t: 7 };
  state.events.push({ type: 'ui', x: 0, y: 0, mag: 1 });
  startStep(state, mission, mission.steps[0]);
}

function finishMission(state, mission) {
  const p = state.player;
  p.money += mission.reward;
  state.stats.earned += mission.reward;
  state.stats.missionsDone += 1;
  state.story.idx += 1;
  state.story.active = false;
  state.missionCar = null;
  state.messages.push({ text: `${mission.title} — complete. +$${mission.reward}`, t: 5, color: '#57cc5e' });
  state.events.push({ type: 'complete', x: p.x, y: p.y, mag: 1 });
  if (state.story.idx >= STORY.length) {
    state.story.done = true;
    state.missionCard = {
      title: 'NEON TIDE — story complete',
      lines: ['The Tide Runner is a light on the horizon, and Port Solana is yours.', 'Courier work at the Solana Sprint depot pays forever. The city stays open.'],
      t: 9,
    };
  }
  state.saveDirty = true;
}

function failMission(state, why) {
  state.story.active = false;
  state.missionCar = null;
  state.messages.push({ text: why, t: 5, color: '#e63946' });
  state.events.push({ type: 'fail', x: 0, y: 0, mag: 1 });
}

/** Offer a courier run from the depot: random drop, honest timer, cash pay. */
export function startCourier(state) {
  const from = LANDMARKS.depot;
  const spot = LANDMARKS[state.rng.pick(COURIER_SPOTS.filter((s) => s !== 'depot'))];
  const d = Math.hypot(spot.x - from.x, spot.y - from.y);
  state.courier = {
    active: true,
    x: spot.x, y: spot.y, label: spot.label,
    timeLeft: d / 235 + 26,
    timeTotal: d / 235 + 26,
    pay: Math.round(45 + d * 0.055),
  };
  state.messages.push({ text: `Courier: ${spot.label}, $${state.courier.pay} — clock is running.`, t: 4, color: '#57cc5e' });
}

/** Advance missions and courier work; refresh state.objective for the HUD. */
export function updateMissions(state, dt) {
  const p = state.player;
  const pp = playerPoint(state);
  state.objective = null;

  // Standing at a giver with no mission running starts the next one.
  if (!state.story.active && !state.story.done) {
    const mission = STORY[state.story.idx];
    const giver = LANDMARKS[mission.from];
    if (Math.hypot(pp.x - giver.x, pp.y - giver.y) < 44) {
      startMission(state, state.story.idx);
    } else {
      state.objective = { x: giver.x, y: giver.y, label: `Meet Vera's contact — ${mission.title}`, color: '#ffd166', dist: Math.hypot(pp.x - giver.x, pp.y - giver.y) };
    }
  }

  if (state.story.active) {
    const mission = STORY[state.story.idx];
    const step = mission.steps[state.story.stepIdx];
    // The flagged car is gone: the job is blown.
    if ((step.type === 'steal' || step.type === 'deliverCar') && state.missionCar && state.missionCar.exploded) {
      failMission(state, 'The Comet is a bonfire. Vera will hear about this.');
      return;
    }
    let done = false;
    if (step.type === 'goto') {
      const at = LANDMARKS[step.at];
      state.objective = { x: at.x, y: at.y, label: step.label, color: '#ff5d8f', dist: Math.hypot(pp.x - at.x, pp.y - at.y) };
      if (state.objective.dist < 52) {
        if (step.note) state.messages.push({ text: step.note, t: 4, color: '#ffd166' });
        if (step.heat) state.heat = clamp(state.heat + step.heat, 0, 5);
        if (step.heatSet) state.heat = Math.max(state.heat, step.heatSet);
        done = true;
      }
    } else if (step.type === 'steal') {
      const car = state.missionCar;
      state.objective = { x: car.x, y: car.y, label: step.label, color: '#ff5d8f', dist: Math.hypot(pp.x - car.x, pp.y - car.y) };
      if (p.car === car) {
        state.heat = Math.max(state.heat, 2);
        state.messages.push({ text: 'Alarm! The PSPD are awake.', t: 4, color: '#e63946' });
        done = true;
      }
    } else if (step.type === 'deliverCar') {
      const at = LANDMARKS[step.at];
      state.objective = { x: at.x, y: at.y, label: step.label, color: '#ff5d8f', dist: Math.hypot(pp.x - at.x, pp.y - at.y) };
      if (p.car === state.missionCar && state.objective.dist < 62) done = true;
    } else if (step.type === 'escape') {
      const safe = LANDMARKS.safehouse;
      state.objective = { x: safe.x, y: safe.y, label: step.label, color: '#ff5d8f', dist: Math.hypot(pp.x - safe.x, pp.y - safe.y) };
      if (state.heat < 0.05) {
        state.messages.push({ text: 'Gone. The city forgets your face.', t: 4, color: '#57cc5e' });
        done = true;
      } else if (state.objective.dist < 56) {
        state.heat = 0;
        state.messages.push({ text: 'Casa Azul. Safe — for now.', t: 4, color: '#57cc5e' });
        done = true;
      }
    } else if (step.type === 'hold') {
      const at = LANDMARKS[step.at];
      state.objective = { x: at.x, y: at.y, label: step.label, color: '#ff5d8f', dist: Math.hypot(pp.x - at.x, pp.y - at.y) };
      if (state.objective.dist < 72) {
        state.holdT = (state.holdT || 0) + dt;
        state.objective.holdPct = state.holdT / step.seconds;
        if (state.holdT >= step.seconds) {
          state.holdT = 0;
          done = true;
        }
      } else {
        state.holdT = Math.max(0, (state.holdT || 0) - dt * 2);
      }
    }
    if (done) {
      state.story.stepIdx += 1;
      if (state.story.stepIdx >= mission.steps.length) finishMission(state, mission);
      else startStep(state, mission, mission.steps[state.story.stepIdx]);
    }
    return;
  }

  // Courier work: offered at the depot whenever no story job is running.
  if (!state.courier.active) {
    const depot = LANDMARKS.depot;
    if (Math.hypot(pp.x - depot.x, pp.y - depot.y) < 44) {
      startCourier(state);
    } else if (!state.objective) {
      state.objective = { x: depot.x, y: depot.y, label: 'Solana Sprint depot — courier work', color: '#57cc5e', dist: Math.hypot(pp.x - depot.x, pp.y - depot.y) };
    }
  } else {
    const c = state.courier;
    c.timeLeft -= dt;
    const d = Math.hypot(pp.x - c.x, pp.y - c.y);
    state.objective = { x: c.x, y: c.y, label: `Deliver to ${c.label} — ${Math.max(0, c.timeLeft).toFixed(0)}s`, color: '#57cc5e', dist: d };
    if (d < 54) {
      const bonus = c.timeLeft > c.timeTotal * 0.35 ? 15 : 0;
      p.money += c.pay + bonus;
      state.stats.earned += c.pay + bonus;
      state.stats.courierDone += 1;
      state.messages.push({ text: `Delivered. +$${c.pay + bonus}${bonus ? ' (fast bonus)' : ''}`, t: 4, color: '#57cc5e' });
      state.events.push({ type: 'cash', x: pp.x, y: pp.y, mag: 1 });
      state.courier.active = false;
      state.saveDirty = true;
    } else if (c.timeLeft <= 0) {
      state.messages.push({ text: 'Courier run timed out. The depot shrugs.', t: 4, color: '#e63946' });
      state.courier.active = false;
    }
  }
}
