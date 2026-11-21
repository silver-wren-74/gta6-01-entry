// The save file: one JSON record in localStorage holding the story progress,
// the money, the stats and where Dario was standing. Written when a mission
// or a courier run pays out (and from the pause menu); read on the title
// screen, where Continue picks the city up exactly there.
import { SAVE_KEY } from './config.js';

/** The stored save, or null when there is none (or it is unreadable). */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Persist the parts of the state worth keeping. */
export function writeSave(state) {
  try {
    const p = state.player;
    const data = {
      money: p.money,
      storyIdx: state.story.idx,
      storyDone: state.story.done,
      x: p.car ? p.car.x : p.x,
      y: p.car ? p.car.y : p.y,
      stats: state.stats,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private windows): the game just forgets.
  }
}

/** Forget the save (New Game). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* nothing to forget */ }
}
