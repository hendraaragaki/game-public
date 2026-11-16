// The screenshot scenes behind ?shot=start|play|mid|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so
// the frame is what a short game really looks like and the same seed always gives the same
// frame. The play and mid scenes use a careful pilot (clean the nearest dirty window, dodge
// hazards); the end scene uses a reckless one that steers into sprites and shards, so it loses
// its three lives the way a hurried player does.

import { FIELD, STEP } from './config.js';
import { EVENT_LEVEL, EVENT_OVER } from './world.js';
import { SCREEN_LEVEL, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const MID_SECONDS = 22;
const END_LIMIT_SECONDS = 240;

/** The nearest dirty window to the gondola, or null when the tower is clean. */
function nearestDirtyWindow(state) {
  const g = state.gondola;
  let best = null;
  let bestD = Infinity;
  for (let index = 0; index < state.windows.length; index += 1) {
    const w = state.windows[index];
    if (!w.active || w.clean) continue;
    const d = Math.hypot(w.x + w.w / 2 - g.x, w.y + w.h / 2 - g.y);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

/** The nearest live hazard (a sprite, or a shard already falling) to the gondola. */
function nearestThreat(state) {
  const g = state.gondola;
  let best = null;
  let bestD = Infinity;
  for (let index = 0; index < state.sprites.length; index += 1) {
    const p = state.sprites[index];
    if (!p.active) continue;
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d < bestD) {
      bestD = d;
      best = { x: p.x, y: p.y, kind: 'sprite' };
    }
  }
  for (let index = 0; index < state.shards.length; index += 1) {
    const t = state.shards[index];
    if (!t.active || t.warn > 0) continue;
    const d = Math.hypot(t.x - g.x, t.y - g.y);
    if (d < bestD) {
      bestD = d;
      best = { x: t.x, y: t.y, kind: 'shard' };
    }
  }
  return best === null || bestD > 150 ? null : best;
}

/**
 * One autopilot step. The careful pilot cleans the nearest dirty window and dodges hazards;
 * the reckless pilot (end scene) steers into the nearest hazard and never sprays.
 */
function autopilot(state, reckless) {
  const g = state.gondola;
  const threat = nearestThreat(state);
  if (reckless) {
    if (threat !== null) {
      return { dx: Math.sign(threat.x - g.x), dy: Math.sign(threat.y - g.y), spraying: false, aimX: g.x, aimY: g.y - 100, aimSeen: true };
    }
    return { dx: 0, dy: 0, spraying: false, aimX: g.x, aimY: g.y - 100, aimSeen: true };
  }
  // Low on water: head for the roof to refill before cleaning again.
  if (g.water < 30) {
    const dx = Math.abs(FIELD.width / 2 - g.x) > 24 ? Math.sign(FIELD.width / 2 - g.x) : 0;
    return { dx, dy: g.y > 100 ? -1 : 0, spraying: false, aimX: g.x, aimY: g.y - 100, aimSeen: true };
  }
  if (threat !== null) {
    // Run from the hazard: sideways away from it, and up if it is a falling shard.
    const dx = threat.kind === 'shard' ? Math.sign(g.x - threat.x) || 1 : Math.sign(g.x - threat.x) || 1;
    const dy = threat.kind === 'shard' ? 0 : Math.sign(g.y - threat.y) || 0;
    return { dx, dy, spraying: false, aimX: g.x, aimY: g.y - 100, aimSeen: true };
  }
  const target = nearestDirtyWindow(state);
  if (target === null) return { dx: 0, dy: 0, spraying: false, aimX: g.x, aimY: g.y - 100, aimSeen: true };
  const tx = target.x + target.w / 2;
  const ty = target.y + target.h / 2;
  const dist = Math.hypot(tx - g.x, ty - g.y);
  const dx = Math.abs(tx - g.x) > 24 ? Math.sign(tx - g.x) : 0;
  const dy = Math.abs(ty - g.y) > 24 ? Math.sign(ty - g.y) : 0;
  return { dx, dy, spraying: dist < 280, aimX: tx, aimY: ty, aimSeen: true };
}

function playFor(world, seconds, reckless) {
  const limit = seconds / STEP;
  for (let index = 0; index < limit; index += 1) {
    const events = world.step(STEP, autopilot(world.state, reckless), false);
    if (events & EVENT_OVER) return SCREEN_OVER;
    if (events & EVENT_LEVEL) return SCREEN_LEVEL;
  }
  return SCREEN_PLAY;
}

/**
 * Set `world` to the named scene (start, play, mid or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'mid' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { dx: 0, dy: 0, spraying: false, aimX: 0, aimY: 0, aimSeen: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'mid') {
    world.startLevel(2);
    const screen = playFor(world, MID_SECONDS, false);
    return { screen, best: world.state.score };
  }
  if (name === 'end') {
    const screen = playFor(world, END_LIMIT_SECONDS, true);
    return { screen: screen === SCREEN_PLAY ? SCREEN_OVER : screen, best: world.state.score };
  }
  const screen = playFor(world, PLAY_SECONDS, false);
  return { screen, best: world.state.score };
}
