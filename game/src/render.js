// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the sky. Canvas
// shapes and text only: the building face, windows in their clean/dirty states, the gondola
// with its worker and tank, spray, pigeons, falling tools, wind streaks, particles, the HUD
// and the panels. Text that holds a number is rebuilt only when the number changes, so a
// frame allocates nothing.

import { FACE, FIELD, FONT, LIVES, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVEL = 'level';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 34, bottom: 72 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const comboLabel = cachedLabel('Combo x');
  const buildingLabel = cachedLabel('Building ');
  const cleanLabel = cachedLabel('');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const bonusLabel = cachedLabel('Bonus +');
  const timeLabel = cachedLabel('');

  // Fixed decoration, generated once from a seed so every run paints the same sky.
  let seed = 1234;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 4294967296);
  }
  const clouds = [];
  for (let i = 0; i < 4; i += 1) {
    clouds.push({ x: rnd() * FIELD.width, y: 30 + rnd() * 130, s: 0.6 + rnd() * 0.9, v: 4 + rnd() * 7 });
  }
  const birds = [];
  for (let i = 0; i < 5; i += 1) birds.push({ x: rnd() * FIELD.width, y: 60 + rnd() * 120, s: 6 + rnd() * 5, v: 12 + rnd() * 10 });

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }
  function plainText(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size).replace('bold ', '');
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawSky(state) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Sun.
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(1120, 92, 34, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.25;
    context.beginPath();
    context.arc(1120, 92, 52, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    // Drifting clouds.
    context.fillStyle = 'rgba(255,255,255,0.75)';
    for (const c of clouds) {
      const cx = ((c.x + state.elapsed * c.v) % (FIELD.width + 220)) - 110;
      context.beginPath();
      context.ellipse(cx, c.y, 52 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
      context.ellipse(cx + 30 * c.s, c.y + 5, 36 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
      context.fill();
    }
    // Distant birds.
    context.strokeStyle = 'rgba(40,40,60,0.7)';
    context.lineWidth = 2;
    for (const b of birds) {
      const bx = ((b.x + state.elapsed * b.v) % (FIELD.width + 80)) - 40;
      const flap = Math.sin(state.elapsed * 6 + b.x) * 3;
      context.beginPath();
      context.moveTo(bx - b.s, b.y);
      context.quadraticCurveTo(bx - b.s / 2, b.y - 4 - flap, bx, b.y);
      context.quadraticCurveTo(bx + b.s / 2, b.y - 4 - flap, bx + b.s, b.y);
      context.stroke();
    }
    // Neighbouring rooftops at the bottom corners.
    context.fillStyle = '#4a4460';
    context.fillRect(0, 612, 96, 108);
    context.fillRect(24, 588, 48, 24);
    context.fillRect(FIELD.width - 96, 628, 96, 92);
    context.fillRect(FIELD.width - 72, 604, 48, 24);
  }

  function drawFace(state) {
    // The tower itself.
    context.fillStyle = PALETTE.face;
    context.fillRect(FACE.x, FACE.y, FACE.width, FACE.height);
    context.fillStyle = PALETTE.faceDark;
    context.fillRect(FACE.x, FACE.y, 10, FACE.height);
    context.fillRect(FACE.x + FACE.width - 10, FACE.y, 10, FACE.height);
    // Roof parapet, water tank and antenna.
    context.fillStyle = PALETTE.faceDark;
    context.fillRect(FACE.x - 8, FACE.y - 14, FACE.width + 16, 18);
    context.fillStyle = '#7a828e';
    context.fillRect(FACE.x + 60, FACE.y - 44, 54, 32);
    context.fillStyle = '#5d6472';
    context.beginPath();
    context.ellipse(FACE.x + 87, FACE.y - 44, 27, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#3e3a36';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(FACE.x + FACE.width - 90, FACE.y - 14);
    context.lineTo(FACE.x + FACE.width - 90, FACE.y - 58);
    context.stroke();
    context.fillStyle = PALETTE.danger;
    context.beginPath();
    context.arc(FACE.x + FACE.width - 90, FACE.y - 60, 4, 0, Math.PI * 2);
    context.fill();
    // Floor lines between window rows.
    context.fillStyle = PALETTE.floorLine;
    for (let y = FACE.y + 56; y < FACE.y + FACE.height - 20; y += 96) {
      context.fillRect(FACE.x + 10, y, FACE.width - 20, 3);
    }
    // Windows.
    for (let index = 0; index < state.windows.length; index += 1) {
      const w = state.windows[index];
      if (!w.active) continue;
      const dirt = w.dirt / 100;
      context.fillStyle = PALETTE.frame;
      roundRect(w.x - 4, w.y - 4, w.w + 8, w.h + 8, 6);
      context.fill();
      context.fillStyle = lerpColor(PALETTE.glassClean, PALETTE.glassDirty, dirt);
      roundRect(w.x, w.y, w.w, w.h, 4);
      context.fill();
      if (dirt < 0.45) {
        // Clean glass catches the sky: a pale shine diagonal.
        context.fillStyle = 'rgba(255,255,255,0.35)';
        context.beginPath();
        context.moveTo(w.x + 8, w.y + w.h);
        context.lineTo(w.x + w.w * 0.45, w.y);
        context.lineTo(w.x + w.w * 0.65, w.y);
        context.lineTo(w.x + 28, w.y + w.h);
        context.closePath();
        context.fill();
      }
      if (dirt > 0.15) {
        // Grime blotches grow with the dirt.
        context.fillStyle = `rgba(58,44,26,${0.25 + dirt * 0.45})`;
        context.beginPath();
        context.arc(w.x + w.w * 0.3, w.y + w.h * 0.35, w.w * 0.16 * dirt + 4, 0, Math.PI * 2);
        context.arc(w.x + w.w * 0.68, w.y + w.h * 0.62, w.w * 0.2 * dirt + 4, 0, Math.PI * 2);
        context.fill();
        context.fillRect(w.x + 4, w.y + w.h - 8, w.w - 8, 4);
      }
      // Cross frame.
      context.fillStyle = PALETTE.frame;
      context.fillRect(w.x + w.w / 2 - 2, w.y, 4, w.h);
      context.fillRect(w.x, w.y + w.h / 2 - 2, w.w, 4);
    }
  }

  function drawGondola(state) {
    const g = state.gondola;
    const blink = g.invuln > 0 && Math.floor(g.invuln * 10) % 2 === 0;
    // Cables up to the roof.
    context.strokeStyle = PALETTE.cable;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(g.x - 30, g.y - 12);
    context.lineTo(g.x - 30, FACE.y - 12);
    context.moveTo(g.x + 30, g.y - 12);
    context.lineTo(g.x + 30, FACE.y - 12);
    context.stroke();
    if (blink) return;
    const tilt = state.wind.active ? state.wind.dir * 0.06 : 0;
    context.save();
    context.translate(g.x, g.y);
    context.rotate(tilt);
    // Spray cone while spraying.
    if (g.spraying) {
      context.save();
      context.rotate(g.aimAngle);
      const grad = context.createLinearGradient(30, 0, 290, 0);
      grad.addColorStop(0, 'rgba(191,233,255,0.55)');
      grad.addColorStop(1, 'rgba(191,233,255,0)');
      context.fillStyle = grad;
      context.beginPath();
      context.moveTo(30, -6);
      context.lineTo(290, -52);
      context.lineTo(290, 52);
      context.lineTo(30, 6);
      context.closePath();
      context.fill();
      context.restore();
    }
    // Platform.
    context.fillStyle = PALETTE.gondolaDark;
    roundRect(-44, -2, 88, 26, 5);
    context.fill();
    context.fillStyle = PALETTE.gondola;
    roundRect(-44, -6, 88, 12, 5);
    context.fill();
    // Railings.
    context.strokeStyle = PALETTE.gondolaDark;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-40, -6);
    context.lineTo(-40, -26);
    context.lineTo(40, -26);
    context.lineTo(40, -6);
    context.stroke();
    // Water tank with a visible level.
    context.fillStyle = '#2b2b2b';
    roundRect(18, -24, 20, 20, 3);
    context.fill();
    const level = (g.water / 100) * 16;
    context.fillStyle = g.water < 25 ? PALETTE.danger : PALETTE.water;
    context.fillRect(20, -6 - level, 16, level);
    // Worker: hi-vis body, head, hard hat, arm toward the nozzle.
    context.fillStyle = PALETTE.worker;
    roundRect(-12, -38, 22, 22, 6);
    context.fill();
    context.fillStyle = PALETTE.workerSkin;
    context.beginPath();
    context.arc(-1, -44, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.hardHat;
    context.beginPath();
    context.arc(-1, -47, 9, Math.PI, 0);
    context.fill();
    context.fillRect(-11, -48, 20, 3);
    // Nozzle arm toward the aim.
    context.strokeStyle = PALETTE.workerSkin;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(8, -30);
    context.lineTo(8 + Math.cos(g.aimAngle) * 26, -30 + Math.sin(g.aimAngle) * 26);
    context.stroke();
    context.fillStyle = '#2b2b2b';
    context.beginPath();
    context.arc(8 + Math.cos(g.aimAngle) * 28, -30 + Math.sin(g.aimAngle) * 28, 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPigeons(state) {
    for (let index = 0; index < state.pigeons.length; index += 1) {
      const p = state.pigeons[index];
      if (!p.active) continue;
      const flap = Math.sin(p.phase) * 6;
      const dir = p.vx > 0 ? 1 : -1;
      context.save();
      context.translate(p.x, p.y);
      context.scale(dir, 1);
      context.fillStyle = PALETTE.pigeon;
      context.beginPath();
      context.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(11, -4, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.pigeonDark;
      context.beginPath();
      context.moveTo(-4, -2);
      context.quadraticCurveTo(-16, -12 - flap, -22, -2 - flap);
      context.quadraticCurveTo(-12, 2, -4, 2);
      context.closePath();
      context.fill();
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.arc(13, -5, 1.6, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawTools(state) {
    for (let index = 0; index < state.tools.length; index += 1) {
      const t = state.tools[index];
      if (!t.active) continue;
      if (t.warn > 0) {
        // Telegraph: a flashing marker at the roof and a shadow on the face.
        const on = Math.floor(t.warn * 8) % 2 === 0;
        if (on) {
          context.fillStyle = PALETTE.danger;
          context.beginPath();
          context.moveTo(t.x, FACE.y + 2);
          context.lineTo(t.x - 9, FACE.y + 18);
          context.lineTo(t.x + 9, FACE.y + 18);
          context.closePath();
          context.fill();
        }
        context.fillStyle = 'rgba(0,0,0,0.18)';
        context.beginPath();
        context.ellipse(t.x, t.y + 60, 16, 5, 0, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.save();
      context.translate(t.x, t.y);
      context.rotate(t.angle);
      context.fillStyle = PALETTE.tool;
      context.fillRect(-3, -14, 6, 28);
      context.fillStyle = PALETTE.toolDark;
      context.beginPath();
      context.arc(0, -14, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.face;
      context.beginPath();
      context.arc(0, -14, 4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawParticles(state) {
    for (let index = 0; index < state.particles.length; index += 1) {
      const p = state.particles[index];
      if (!p.active) continue;
      const a = p.life / p.maxLife;
      context.globalAlpha = a;
      context.fillStyle = p.color;
      if (p.kind === 2) {
        // Droplet: a short streak along its velocity.
        context.strokeStyle = p.color;
        context.lineWidth = p.size;
        context.beginPath();
        context.moveTo(p.x, p.y);
        context.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        context.stroke();
      } else {
        context.beginPath();
        context.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    for (let index = 0; index < state.floaters.length; index += 1) {
      const f = state.floaters[index];
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life / f.maxLife + 0.3);
      text(f.text, f.x, f.y, f.size, f.color, 'center');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 16, 26, PALETTE.text, 'left');
    if (state.combo >= 2) {
      text(comboLabel(state.combo), 24, 46, 22, PALETTE.combo, 'left');
    }
    const mins = Math.floor(state.timeLeft / 60);
    const secs = Math.floor(state.timeLeft % 60);
    const timeText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    const timeColor = state.timeLeft < 20 ? PALETTE.danger : PALETTE.text;
    text(buildingLabel(state.level), FIELD.width / 2, 16, 26, PALETTE.text, 'center');
    text(timeText, FIELD.width / 2, 46, 24, timeColor, 'center');
    text(cleanLabel(`${state.cleaned}/${state.totalWindows} windows`), FIELD.width / 2, 74, 18, PALETTE.muted, 'center');
    // Lives as hard hats, top right.
    const firstLife = FIELD.width - 24 - LIVES * 30;
    text('Lives', firstLife - 10, 16, 26, PALETTE.text, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      const lx = firstLife + life * 30;
      context.fillStyle = life < state.lives ? PALETTE.hardHat : 'rgba(255,255,255,0.18)';
      context.beginPath();
      context.arc(lx + 11, 26, 10, Math.PI, 0);
      context.fill();
      context.fillRect(lx + 1, 24, 20, 3);
    }
    // Water gauge under the lives.
    const gw = 130;
    const gx = FIELD.width - 24 - gw;
    const gy = 58;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(gx, gy, gw, 16, 8);
    context.fill();
    context.fillStyle = state.gondola.water < 25 ? PALETTE.danger : PALETTE.water;
    const ww = Math.max(0, (state.gondola.water / 100) * (gw - 4));
    if (ww > 0) {
      roundRect(gx + 2, gy + 2, ww, 12, 6);
      context.fill();
    }
    plainText('WATER', gx - 8, gy + 1, 13, PALETTE.text, 'right');
    if (state.gondola.y <= 96 && state.gondola.water < 100) {
      plainText('REFILLING…', gx + gw / 2, gy + 24, 13, PALETTE.water, 'center');
    }
    // Wind banner while a gust blows.
    if (state.wind.active) {
      const arrow = state.wind.dir > 0 ? 'WIND  >>>' : '<<<  WIND';
      context.globalAlpha = 0.85;
      text(arrow, FIELD.width / 2, 104, 20, PALETTE.skyBottom, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(20,16,12,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, PANEL.width, height, 12);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(x, y, PANEL.width, height, 12);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      plainText(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Clean every window before the shift ends.',
    'Ride the gondola with WASD or arrows. Aim with the mouse.',
    'Hold Space or click to spray. Water refills only at the roof.',
    'Pigeons and falling tools cost a life. Mind the wind.',
    '',
  ];
  const PAUSED_LINES = ['The windows will wait for you.'];
  const OVER_LINES = ['', '', ''];
  const WIN_LINES = ['', '', ''];
  const LEVEL_LINES = ['', '', ''];

  /** Paint one frame: the sky, the face, the things on it, then the HUD or a panel. */
  function draw(state, screen, best, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.skyTop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const sx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const sy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawSky(state);
    drawFace(state);
    drawTools(state);
    drawPigeons(state);
    drawGondola(state);
    drawParticles(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('GONDOLA LANGIT', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_LEVEL) {
      LEVEL_LINES[0] = `Building ${state.level} is spotless!`;
      LEVEL_LINES[1] = bonusLabel(state.lastBonus);
      LEVEL_LINES[2] = finalLabel(state.score);
      drawPanel('Building clear!', LEVEL_LINES, state.level >= 3 ? 'Press Space for the results' : 'Press Space for the next building');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = state.lastReason === 'time' ? 'The shift ended with dirty windows.' : 'The gondola took one hit too many.';
      OVER_LINES[1] = finalLabel(state.score);
      OVER_LINES[2] = bestLabel(best);
      drawPanel('Shift over', OVER_LINES, 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = 'Every building on the tower is spotless.';
      WIN_LINES[1] = finalLabel(state.score);
      WIN_LINES[2] = bestLabel(best);
      drawPanel('Tower complete!', WIN_LINES, 'Press Space or click to play again');
    }
    if (extra && extra.muted) {
      plainText('MUTED (M)', FIELD.width - 16, FIELD.height - 28, 14, PALETTE.muted, 'right');
    }
  }

  /** Convert client (CSS pixel) coordinates to field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x / (window.devicePixelRatio || 1)) / view.scale * (window.devicePixelRatio || 1),
      y: (clientY - rect.top - view.y / (window.devicePixelRatio || 1)) / view.scale * (window.devicePixelRatio || 1),
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField, view };
}
