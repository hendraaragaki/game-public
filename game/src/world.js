// The game's rules and state, with no drawing and no browser in it: the gondola, the window
// grid, spray and water, the hazards (sprites, falling shards, wind), lives, the festival timer and
// the ten towers. step() advances one fixed step and returns what happened as bit flags,
// so the caller can react (sound, announcements) without the world knowing about screens or
// sound. Nothing here allocates after createWorld returns: windows, hazards, particles and
// floaters all live in pools allocated at boot.

import { COMBO, FACE, FIELD, GONDOLA, LEVELS, LIVES, SPRITE, POOL, SCORE, STEP, SHARD, WIND, WINDOW } from './config.js';

export const EVENT_CLEAN = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_LEVEL = 8;
export const EVENT_WIN = 16;
export const EVENT_GUST = 32;
export const EVENT_REFILL = 64;
export const EVENT_SPRITE = 128;
export const EVENT_WARN = 256;
export const EVENT_EMPTY = 512;

const MAX_WINDOWS = 80;
const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

export function createWorld(random) {
  const gondola = {
    x: FIELD.width / 2, y: 90, vx: 0, vy: 0,
    water: GONDOLA.tank, spraying: false, aimAngle: -Math.PI / 2,
    invuln: 0, stun: 0, wasRefilling: false, wasSpraying: false, wasEmpty: false,
  };
  const windows = [];
  for (let index = 0; index < MAX_WINDOWS; index += 1) {
    windows.push({ active: false, x: 0, y: 0, w: 0, h: 0, dirt: 0, initialDirt: 0, sinceSpray: 0, clean: false });
  }
  const sprites = [];
  for (let index = 0; index < POOL.sprites; index += 1) {
    sprites.push({ active: false, x: 0, y: 0, vx: 0, phase: 0, dropped: false });
  }
  const shards = [];
  for (let index = 0; index < POOL.shards; index += 1) {
    shards.push({ active: false, x: 0, y: 0, vy: 0, warn: 0, angle: 0, spin: 0 });
  }
  const particles = [];
  for (let index = 0; index < POOL.particles; index += 1) {
    particles.push({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  }
  const floaters = [];
  for (let index = 0; index < POOL.floaters; index += 1) {
    floaters.push({ active: false, x: 0, y: 0, text: '', life: 0, maxLife: 1, color: '#fff', size: 20 });
  }
  const wind = { active: false, dir: 1, strength: 0, left: 0, nextIn: 8 };
  const state = {
    gondola, windows, sprites, shards, particles, floaters, wind,
    level: 1, score: 0, combo: 0, comboTimer: 0, lives: LIVES,
    timeLeft: 0, cleaned: 0, totalWindows: 0, elapsed: 0,
    spriteTimer: 6, shardTimer: 5, shake: 0, towerDone: false, over: false,
    lastBonus: 0, lastReason: '',
  };

  function levelConfig() {
    return LEVELS[state.level - 1];
  }

  function freeParticle() {
    for (let index = 0; index < particles.length; index += 1) if (!particles[index].active) return particles[index];
    return null;
  }

  function spawnParticle(kind, x, y, vx, vy, life, size, color) {
    const p = freeParticle();
    if (p === null) return;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
  }

  function freeFloater() {
    for (let index = 0; index < floaters.length; index += 1) if (!floaters[index].active) return floaters[index];
    return null;
  }

  function spawnFloater(x, y, text, color, size) {
    const f = freeFloater();
    if (f === null) return;
    f.active = true;
    f.x = x + (Math.random() - 0.5) * 30;
    f.y = y;
    f.text = text;
    f.life = 1.1;
    f.maxLife = 1.1;
    f.color = color;
    f.size = size || 20;
  }

  /** Lay out the window grid for the current tower and reset the festival timer. */
  function startLevel(level) {
    state.level = level;
    const cfg = LEVELS[level - 1];
    const gridTop = FACE.y + 56;
    const gridHeight = FACE.height - 96;
    const cellW = FACE.width / cfg.cols;
    const cellH = gridHeight / cfg.rows;
    let count = 0;
    for (let row = 0; row < cfg.rows; row += 1) {
      for (let col = 0; col < cfg.cols; col += 1) {
        const w = windows[count];
        w.active = true;
        w.w = cellW - 26;
        w.h = cellH - 20;
        w.x = FACE.x + col * cellW + (cellW - w.w) / 2;
        w.y = gridTop + row * cellH + (cellH - w.h) / 2;
        w.initialDirt = cfg.dirtMin + random() * (cfg.dirtMax - cfg.dirtMin);
        w.dirt = w.initialDirt;
        w.sinceSpray = 0;
        w.clean = false;
        count += 1;
      }
    }
    for (let index = count; index < windows.length; index += 1) windows[index].active = false;
    state.totalWindows = count;
    state.cleaned = 0;
    state.timeLeft = cfg.timeSeconds;
    state.elapsed = 0;
    state.towerDone = false;
    state.over = false;
    gondola.x = FIELD.width / 2;
    gondola.y = 90;
    gondola.vx = 0;
    gondola.vy = 0;
    gondola.water = GONDOLA.tank;
    gondola.spraying = false;
    gondola.invuln = 0;
    gondola.stun = 0;
    for (const p of sprites) p.active = false;
    for (const t of shards) t.active = false;
    for (const p of particles) p.active = false;
    for (const f of floaters) f.active = false;
    wind.active = false;
    wind.nextIn = cfg.windEvery[0] + random() * (cfg.windEvery[1] - cfg.windEvery[0]);
    state.spriteTimer = cfg.spriteEvery[0] + random() * (cfg.spriteEvery[1] - cfg.spriteEvery[0]);
    state.shardTimer = cfg.shardEvery[0] + random() * (cfg.shardEvery[1] - cfg.shardEvery[0]);
  }

  function reset() {
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.lives = LIVES;
    state.shake = 0;
    startLevel(1);
  }

  function multiplier() {
    return 1 + COMBO.step * Math.min(state.combo, COMBO.maxCombo);
  }

  function cleanWindow(w, events) {
    w.dirt = 0;
    w.clean = true;
    state.cleaned += 1;
    state.combo += 1;
    state.comboTimer = COMBO.windowSeconds;
    const points = Math.round(SCORE.windowBase * multiplier());
    state.score += points;
    const cx = w.x + w.w / 2;
    const cy = w.y + w.h / 2;
    for (let i = 0; i < 10; i += 1) {
      const a = random() * TWO_PI;
      const s = 60 + random() * 140;
      spawnParticle(1, cx, cy, Math.cos(a) * s, Math.sin(a) * s - 40, 0.5 + random() * 0.3, 2 + random() * 2, '#bfe9ff');
    }
    spawnFloater(cx, cy, `+${points}`, '#f2c94c', 22);
    if (state.combo >= 3) spawnFloater(cx, cy - 26, `COMBO x${state.combo}`, '#ff9a3d', 18);
    return events | EVENT_CLEAN;
  }

  function hitGondola(events, fromX) {
    if (gondola.invuln > 0 || state.lives <= 0) return events;
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    gondola.invuln = GONDOLA.invulnerable;
    gondola.stun = GONDOLA.stun;
    gondola.vx = (gondola.x < fromX ? -1 : 1) * 380;
    gondola.vy = -170;
    state.shake = 12;
    for (let i = 0; i < 14; i += 1) {
      const a = random() * TWO_PI;
      const s = 80 + random() * 180;
      spawnParticle(1, gondola.x, gondola.y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + random() * 0.3, 2 + random() * 3, '#e5534b');
    }
    if (state.lives <= 0) {
      state.over = true;
      state.lastReason = 'lives';
      return events | EVENT_HIT | EVENT_OVER;
    }
    return events | EVENT_HIT;
  }

  function spawnSprite() {
    for (let index = 0; index < sprites.length; index += 1) {
      const p = sprites[index];
      if (p.active) continue;
      const fromLeft = random() < 0.5;
      p.active = true;
      p.x = fromLeft ? -30 : FIELD.width + 30;
      p.y = FACE.y + 60 + random() * (FACE.height - 140);
      p.vx = (fromLeft ? 1 : -1) * (SPRITE.speedMin + random() * (SPRITE.speedMax - SPRITE.speedMin));
      p.phase = random() * TWO_PI;
      p.dropped = false;
      return true;
    }
    return false;
  }

  function spawnShard() {
    for (let index = 0; index < shards.length; index += 1) {
      const t = shards[index];
      if (t.active) continue;
      t.active = true;
      t.x = FACE.x + 60 + random() * (FACE.width - 120);
      t.y = FACE.y + 6;
      t.vy = 0;
      t.warn = SHARD.warnSeconds;
      t.angle = random() * TWO_PI;
      t.spin = (random() < 0.5 ? -1 : 1) * (3 + random() * 4);
      return true;
    }
    return false;
  }

  /**
   * One fixed step. `input` is {dx, dy, spraying, aimX, aimY, aimSeen}. With `harmless` set
   * (the title screen's backdrop) the gondola drifts, windows stay dirty and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    const cfg = levelConfig();
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 30 * dt);

    // --- gondola movement (acceleration, damping, wind, bounds) ---
    const stunned = gondola.stun > 0;
    if (gondola.stun > 0) gondola.stun -= dt;
    if (gondola.invuln > 0) gondola.invuln -= dt;
    if (!stunned && !harmless) {
      const len = Math.hypot(input.dx, input.dy) || 1;
      gondola.vx += (input.dx / len) * GONDOLA.accel * dt;
      gondola.vy += (input.dy / len) * GONDOLA.accel * dt;
    }
    if (wind.active) gondola.vx += wind.dir * wind.strength * dt;
    const damp = Math.max(0, 1 - 5 * dt);
    if (input.dx === 0) gondola.vx *= damp;
    if (input.dy === 0) gondola.vy *= damp;
    const speed = Math.hypot(gondola.vx, gondola.vy);
    const max = GONDOLA.maxSpeed + (wind.active ? 60 : 0);
    if (speed > max) {
      gondola.vx = (gondola.vx / speed) * max;
      gondola.vy = (gondola.vy / speed) * max;
    }
    gondola.x = Math.min(FACE.x + FACE.width - 56, Math.max(FACE.x + 56, gondola.x + gondola.vx * dt));
    gondola.y = Math.min(FACE.y + FACE.height - 34, Math.max(66, gondola.y + gondola.vy * dt));

    // --- spray: aim, water, cone, droplets ---
    if (input.aimSeen) gondola.aimAngle = Math.atan2(input.aimY - gondola.y, input.aimX - gondola.x);
    else gondola.aimAngle = -Math.PI / 2;
    const wantSpray = !harmless && input.spraying && gondola.water > 0;
    const triedEmpty = !harmless && input.spraying && gondola.water <= 0 && !gondola.wasEmpty;
    if (triedEmpty) events |= EVENT_EMPTY;
    gondola.wasEmpty = !harmless && input.spraying && gondola.water <= 0;
    gondola.spraying = wantSpray;
    if (wantSpray) {
      gondola.water = Math.max(0, gondola.water - GONDOLA.waterUse * dt);
      const nx = gondola.x + Math.cos(gondola.aimAngle) * 34;
      const ny = gondola.y + Math.sin(gondola.aimAngle) * 10;
      for (let i = 0; i < 6; i += 1) {
        const spread = (random() - 0.5) * GONDOLA.sprayHalfAngle * 2;
        const a = gondola.aimAngle + spread;
        const s = 520 + random() * 200;
        spawnParticle(2, nx, ny, Math.cos(a) * s, Math.sin(a) * s, 0.3 + random() * 0.2, 3, '#bfe9ff');
      }
      for (let index = 0; index < windows.length; index += 1) {
        const w = windows[index];
        if (!w.active || w.clean) continue;
        const cx = w.x + w.w / 2 - gondola.x;
        const cy = w.y + w.h / 2 - gondola.y;
        const dist = Math.hypot(cx, cy);
        if (dist > GONDOLA.sprayRange + Math.max(w.w, w.h) / 2) continue;
        const ang = Math.atan2(cy, cx);
        if (Math.abs(angleDiff(ang, gondola.aimAngle)) > GONDOLA.sprayHalfAngle + 0.14) continue;
        w.dirt -= GONDOLA.sprayRate * dt;
        w.sinceSpray = 0;
        if (w.dirt <= 0) events = cleanWindow(w, events);
      }
    }

    // --- water refill at the roof ---
    const refilling = !harmless && gondola.y <= GONDOLA.roofY && gondola.water < GONDOLA.tank;
    if (refilling) {
      gondola.water = Math.min(GONDOLA.tank, gondola.water + GONDOLA.refillRate * dt);
      if (!gondola.wasRefilling) events |= EVENT_REFILL;
    }
    gondola.wasRefilling = refilling;
    gondola.wasSpraying = wantSpray;

    if (harmless) {
      updateParticles(dt);
      return events;
    }

    // --- combo clock and re-soiling ---
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    for (let index = 0; index < windows.length; index += 1) {
      const w = windows[index];
      if (!w.active || w.clean) continue;
      w.sinceSpray += dt;
      // A window left half-clean slowly gets dirty again, up to how dirty it started.
      if (w.sinceSpray > WINDOW.resoilDelay && w.dirt < w.initialDirt) {
        w.dirt = Math.min(w.initialDirt, w.dirt + WINDOW.resoilRate * dt);
      }
    }

    // --- festival timer ---
    if (!state.towerDone) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.over = true;
        state.lastReason = 'time';
        return events | EVENT_OVER;
      }
    }

    // --- wind gusts ---
    if (wind.active) {
      wind.left -= dt;
      if (wind.left <= 0) {
        wind.active = false;
        wind.nextIn = cfg.windEvery[0] + random() * (cfg.windEvery[1] - cfg.windEvery[0]);
      }
    } else {
      wind.nextIn -= dt;
      if (wind.nextIn <= 0) {
        wind.active = true;
        wind.dir = random() < 0.5 ? -1 : 1;
        wind.strength = cfg.windStrength;
        wind.left = WIND.gustSeconds[0] + random() * (WIND.gustSeconds[1] - WIND.gustSeconds[0]);
        events |= EVENT_GUST;
      }
    }

    // --- sprites ---
    state.spriteTimer -= dt;
    if (state.spriteTimer <= 0) {
      if (spawnSprite()) events |= EVENT_SPRITE;
      state.spriteTimer = cfg.spriteEvery[0] + random() * (cfg.spriteEvery[1] - cfg.spriteEvery[0]);
    }
    for (let index = 0; index < sprites.length; index += 1) {
      const p = sprites[index];
      if (!p.active) continue;
      p.phase += dt * 9;
      p.x += p.vx * dt;
      p.y += Math.sin(p.phase) * 26 * dt;
      if (p.x < -60 || p.x > FIELD.width + 60) {
        p.active = false;
        continue;
      }
      if (!p.dropped && random() < 0.002) {
        p.dropped = true;
        let nearest = null;
        let nearestD = 1e9;
        for (let wi = 0; wi < windows.length; wi += 1) {
          const w = windows[wi];
          if (!w.active) continue;
          const d = Math.hypot(w.x + w.w / 2 - p.x, w.y + w.h / 2 - p.y);
          if (d < nearestD) {
            nearestD = d;
            nearest = w;
          }
        }
        if (nearest !== null && nearestD < 120 && !nearest.clean) {
          nearest.dirt = Math.min(nearest.initialDirt, nearest.dirt + SPRITE.dropDirt);
          spawnFloater(nearest.x + nearest.w / 2, nearest.y, 'Sprite!', '#ff9ecf', 15);
        }
      }
      const gx = gondola.x;
      const gy = gondola.y - 8;
      if (Math.hypot(p.x - gx, p.y - gy) < SPRITE.radius + 26) {
        p.active = false;
        events = hitGondola(events, p.x);
        if (events & EVENT_OVER) return events;
      }
    }

    // --- falling shards ---
    state.shardTimer -= dt;
    if (state.shardTimer <= 0) {
      if (spawnShard()) events |= EVENT_WARN;
      state.shardTimer = cfg.shardEvery[0] + random() * (cfg.shardEvery[1] - cfg.shardEvery[0]);
    }
    for (let index = 0; index < shards.length; index += 1) {
      const t = shards[index];
      if (!t.active) continue;
      if (t.warn > 0) {
        t.warn -= dt;
        continue;
      }
      t.vy = SHARD.fallSpeed;
      t.y += t.vy * dt;
      t.angle += t.spin * dt;
      if (t.y > FACE.y + FACE.height - 8) {
        t.active = false;
        for (let i = 0; i < 6; i += 1) {
          spawnParticle(1, t.x, FACE.y + FACE.height - 10, (random() - 0.5) * 120, -40 - random() * 60, 0.4, 2, '#c9c2b4');
        }
        continue;
      }
      if (Math.hypot(t.x - gondola.x, t.y - (gondola.y - 8)) < SHARD.radius + 26) {
        t.active = false;
        events = hitGondola(events, t.x);
        if (events & EVENT_OVER) return events;
      }
    }

    // --- tower cleared? ---
    if (!state.towerDone && state.cleaned >= state.totalWindows) {
      state.towerDone = true;
      state.lastBonus = Math.round(state.timeLeft) * SCORE.timeBonus + state.lives * SCORE.lifeBonus;
      state.score += state.lastBonus;
      events |= EVENT_LEVEL;
      if (state.level >= LEVELS.length) events |= EVENT_WIN;
    }

    updateParticles(dt);
    return events;
  }

  /**
   * Test-only hook (used by the soak script, never by the game itself): 'hurt' applies one
   * hit to the gondola, 'clear' cleans every window so the next step clears the tower,
   * 'timeout' leaves a hair of festival time so the next step ends the festival. Returns events.
   */
  function debug(action) {
    if (action === 'hurt') return hitGondola(0, gondola.x + 100);
    if (action === 'clear') {
      for (let index = 0; index < windows.length; index += 1) {
        const w = windows[index];
        if (!w.active) continue;
        w.dirt = 0;
        w.clean = true;
      }
      state.cleaned = state.totalWindows;
      return 0;
    }
    if (action === 'timeout') {
      state.timeLeft = 0.01;
      return 0;
    }
    return 0;
  }

  function updateParticles(dt) {
    for (let index = 0; index < particles.length; index += 1) {
      const p = particles[index];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 2) p.vy += 260 * dt;
      else p.vy += 60 * dt;
    }
    for (let index = 0; index < floaters.length; index += 1) {
      const f = floaters[index];
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) f.active = false;
      else f.y -= 34 * dt;
    }
  }

  reset();
  return { state, reset, startLevel, step, debug };
}
