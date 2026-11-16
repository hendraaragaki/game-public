// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between six screens: title, play, building clear, paused, game over and win.
//
// ?seed=N fixes the random pattern. ?shot=start|play|mid|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CLEAN, EVENT_EMPTY, EVENT_GUST, EVENT_HIT, EVENT_LEVEL, EVENT_OVER, EVENT_PIGEON, EVENT_REFILL, EVENT_WARN, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

let currentScreen = SCREEN_TITLE;

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let spraySound = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function setScreen(next) {
    screen = next;
    currentScreen = next;
  }

  function syncSpraySound() {
    const spraying = world.state.gondola.spraying && screen === SCREEN_PLAY;
    if (spraying && !spraySound) {
      audio.sprayStart();
      spraySound = true;
    } else if (!spraying && spraySound) {
      audio.sprayStop();
      spraySound = false;
    }
  }

  function startGame() {
    audio.unlock();
    audio.startDrone();
    world.reset();
    accumulator = 0;
    setScreen(SCREEN_PLAY);
    announce(`Playing. Building 1. ${LIVES} lives. Clean every window before the shift ends.`);
  }

  function finishRun(win) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    setScreen(win ? SCREEN_WIN : SCREEN_OVER);
    if (win) {
      audio.win();
      announce(`Tower complete! Final score ${world.state.score}. Best ${best}.`);
    } else {
      audio.lose();
      announce(`Shift over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_CLEAN) audio.ding(world.state.combo);
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_GUST) audio.gust();
    if (events & EVENT_REFILL) audio.refill();
    if (events & EVENT_PIGEON) audio.pigeon();
    if (events & EVENT_WARN) audio.warn();
    if (events & EVENT_EMPTY) announce('Tank empty. Back to the roof to refill!');
    if (events & EVENT_LEVEL) {
      if (events & EVENT_WIN) {
        finishRun(true);
      } else {
        audio.levelClear();
        setScreen(SCREEN_LEVEL);
        announce(`Building ${world.state.level} clear! Bonus ${world.state.lastBonus}.`);
      }
    } else if (events & EVENT_OVER) {
      finishRun(false);
    }
  }

  // Read-only state plus a test hook for the soak script; the game itself never uses test.
  window.__game = {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
    test: {
      hurt() {
        handleEvents(world.debug('hurt'));
      },
      clear() {
        world.debug('clear');
      },
      timeout() {
        world.debug('timeout');
      },
    },
  };

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        audio.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_LEVEL) {
      if (actions & ACTION_CONFIRM) {
        audio.click();
        world.startLevel(world.state.level + 1);
        accumulator = 0;
        setScreen(SCREEN_PLAY);
        announce(`Building ${world.state.level}. Clean every window before the shift ends.`);
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      setScreen(SCREEN_PLAY);
      announce('Playing.');
    }
  }

  function readAim() {
    const mouse = input.mouse();
    if (!mouse.seen) return { aimX: world.state.gondola.x, aimY: world.state.gondola.y - 100, aimSeen: false };
    const field = renderer.toField(mouse.x, mouse.y);
    return { aimX: field.x, aimY: field.y, aimSeen: true };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dx: 0, dy: 0, spraying: false, aimX: 0, aimY: 0, aimSeen: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const dir = input.direction();
    const aim = readAim();
    const events = world.step(STEP, { dx: dir.x, dy: dir.y, spraying: input.spraying(), aimX: aim.aimX, aimY: aim.aimY, aimSeen: aim.aimSeen }, false);
    handleEvents(events);
    syncSpraySound();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      syncSpraySound();
    }
    renderer.draw(world.state, screen, best, { muted: audio.isMuted() });
  }

  // Leaving the tab pauses a running game rather than letting the shift run out unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    }
  });

  announce('Gondola Langit. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
