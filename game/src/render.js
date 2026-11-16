// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the sky. Canvas
// shapes and text only: an anime sunset sky over the Sky Tower, windows in their clean/dirty
// states (grime spirits on dirty glass, sparkles on clean glass), Sora on her pink gondola,
// spray, sky sprites, falling star shards, wind streaks, particles, the HUD and the panels.
// Text that holds a number is rebuilt only when the number changes, so a frame allocates
// nothing. All art is drawn on canvas; no copied characters, no external assets.

import { FACE, FIELD, FONT, GONDOLA, LIVES, PALETTE } from './config.js';

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
  const towerLabel = cachedLabel('Tower ');
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
  for (let i = 0; i < 5; i += 1) {
    clouds.push({ x: rnd() * FIELD.width, y: 26 + rnd() * 120, s: 0.6 + rnd() * 0.9, v: 4 + rnd() * 7 });
  }
  const birds = [];
  for (let i = 0; i < 5; i += 1) birds.push({ x: rnd() * FIELD.width, y: 60 + rnd() * 120, s: 6 + rnd() * 5, v: 12 + rnd() * 10 });
  const sparkles = [];
  for (let i = 0; i < 16; i += 1) {
    sparkles.push({ x: rnd() * FIELD.width, y: 20 + rnd() * 260, r: 3 + rnd() * 5, p: rnd() * Math.PI * 2 });
  }
  const city = [];
  for (let i = 0; i < 10; i += 1) {
    city.push({ x: rnd() * 120, w: 26 + rnd() * 40, h: 40 + rnd() * 90, side: i % 2 === 0 ? 0 : 1 });
  }

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
  /** Text with a dark outline, so HUD numbers stay readable over the bright sky. */
  function outlineText(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.textAlign = align;
    context.lineWidth = 5;
    context.lineJoin = 'round';
    context.strokeStyle = PALETTE.textDark;
    context.strokeText(value, x, y);
    context.fillStyle = color;
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

  /** A four-point sparkle star. */
  function drawSparkle(x, y, r, color, alpha) {
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y - r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.quadraticCurveTo(x, y, x, y + r);
    context.quadraticCurveTo(x, y, x - r, y);
    context.quadraticCurveTo(x, y, x, y - r);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawHeart(x, y, size, color) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y + size * 0.25);
    context.bezierCurveTo(x - size * 0.6, y - size * 0.45, x - size * 1.1, y + size * 0.35, x, y + size);
    context.bezierCurveTo(x + size * 1.1, y + size * 0.35, x + size * 0.6, y - size * 0.45, x, y + size * 0.25);
    context.fill();
  }

  /** Sora's face, big and cute, for the title panel (an original character). */
  function drawSoraHead(x, y, r) {
    // Twin-tails.
    context.fillStyle = PALETTE.hair;
    context.beginPath();
    context.ellipse(x - r * 1.15, y + r * 0.35, r * 0.34, r * 0.62, 0.25, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(x + r * 1.15, y + r * 0.35, r * 0.34, r * 0.62, -0.25, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(x - r * 0.95, y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + r * 0.95, y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    context.fill();
    // Hair back and face.
    context.fillStyle = PALETTE.hair;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.skin;
    context.beginPath();
    context.arc(x, y + r * 0.08, r * 0.78, 0, Math.PI * 2);
    context.fill();
    // Bangs.
    context.fillStyle = PALETTE.hair;
    context.beginPath();
    context.arc(x, y - r * 0.18, r * 0.8, Math.PI, 0);
    context.fill();
    context.beginPath();
    context.moveTo(x - r * 0.7, y - r * 0.3);
    context.lineTo(x - r * 0.45, y + r * 0.15);
    context.lineTo(x - r * 0.2, y - r * 0.3);
    context.lineTo(x + r * 0.05, y + r * 0.15);
    context.lineTo(x + r * 0.3, y - r * 0.3);
    context.lineTo(x + r * 0.55, y + r * 0.1);
    context.lineTo(x + r * 0.7, y - r * 0.35);
    context.closePath();
    context.fill();
    // Big anime eyes.
    for (const side of [-1, 1]) {
      const ex = x + side * r * 0.32;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.ellipse(ex, y + r * 0.08, r * 0.17, r * 0.22, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.textDark;
      context.beginPath();
      context.arc(ex, y + r * 0.12, r * 0.1, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(ex - r * 0.04, y + r * 0.02, r * 0.045, 0, Math.PI * 2);
      context.fill();
    }
    // Blush and smile.
    context.fillStyle = 'rgba(255,158,207,0.85)';
    context.beginPath();
    context.ellipse(x - r * 0.52, y + r * 0.34, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(x + r * 0.52, y + r * 0.34, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.textDark;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y + r * 0.32, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
  }

  function drawSky(state) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Big sparkly sun with rays.
    context.fillStyle = PALETTE.sun;
    context.globalAlpha = 0.22;
    context.beginPath();
    context.arc(1120, 92, 62, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.beginPath();
    context.arc(1120, 92, 36, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,243,160,0.8)';
    context.lineWidth = 4;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + state.elapsed * 0.1;
      context.beginPath();
      context.moveTo(1120 + Math.cos(a) * 44, 92 + Math.sin(a) * 44);
      context.lineTo(1120 + Math.cos(a) * 56, 92 + Math.sin(a) * 56);
      context.stroke();
    }
    // Twinkling sparkles.
    for (let i = 0; i < sparkles.length; i += 1) {
      const s = sparkles[i];
      const tw = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(state.elapsed * 2 + s.p));
      drawSparkle(s.x, s.y, s.r, i % 3 === 0 ? PALETTE.petal : PALETTE.sparkle, tw);
    }
    // Fluffy pink clouds.
    context.fillStyle = 'rgba(255,227,241,0.85)';
    for (const c of clouds) {
      const cx = ((c.x + state.elapsed * c.v) % (FIELD.width + 220)) - 110;
      context.beginPath();
      context.ellipse(cx, c.y, 52 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
      context.ellipse(cx + 30 * c.s, c.y + 5, 36 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
      context.fill();
    }
    // Distant birds.
    context.strokeStyle = 'rgba(90,60,140,0.65)';
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
    // Pastel city at the bottom corners, windows lit for the festival.
    for (const b of city) {
      const bx = b.side === 0 ? b.x : FIELD.width - b.x - b.w;
      context.fillStyle = b.side === 0 ? '#6a5cff' : '#8a6fd6';
      context.fillRect(bx, FIELD.height - b.h, b.w, b.h);
      context.fillStyle = 'rgba(255,243,160,0.9)';
      for (let wy = FIELD.height - b.h + 10; wy < FIELD.height - 12; wy += 18) {
        for (let wx = bx + 7; wx < bx + b.w - 6; wx += 14) {
          if ((wx * 7 + wy * 13) % 3 === 0) context.fillRect(wx, wy, 5, 7);
        }
      }
    }
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
    context.fillStyle = PALETTE.gondola;
    context.fillRect(FACE.x + 60, FACE.y - 44, 54, 32);
    context.fillStyle = PALETTE.gold;
    drawSparkle(FACE.x + 87, FACE.y - 28, 7, PALETTE.gold, 0.9);
    context.fillStyle = PALETTE.faceDark;
    context.beginPath();
    context.ellipse(FACE.x + 87, FACE.y - 44, 27, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#3e3a36';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(FACE.x + FACE.width - 90, FACE.y - 14);
    context.lineTo(FACE.x + FACE.width - 90, FACE.y - 58);
    context.stroke();
    context.fillStyle = PALETTE.scarf;
    context.beginPath();
    context.arc(FACE.x + FACE.width - 90, FACE.y - 60, 5, 0, Math.PI * 2);
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
        // Clean glass catches the sky: a pale shine diagonal plus sparkles.
        context.fillStyle = 'rgba(255,255,255,0.4)';
        context.beginPath();
        context.moveTo(w.x + 8, w.y + w.h);
        context.lineTo(w.x + w.w * 0.45, w.y);
        context.lineTo(w.x + w.w * 0.65, w.y);
        context.lineTo(w.x + 28, w.y + w.h);
        context.closePath();
        context.fill();
        const tw = 0.5 + 0.5 * Math.sin(state.elapsed * 3 + index * 1.7);
        drawSparkle(w.x + w.w * 0.22, w.y + w.h * 0.28, 5, PALETTE.sparkle, 0.4 + tw * 0.5);
        drawSparkle(w.x + w.w * 0.78, w.y + w.h * 0.66, 4, PALETTE.gold, 0.4 + tw * 0.5);
      }
      if (dirt > 0.15) {
        // Grime spirits: little blobs with eyes that grow with the dirt.
        const spots = [
          { x: w.x + w.w * 0.3, y: w.y + w.h * 0.35, r: w.w * 0.16 * dirt + 4 },
          { x: w.x + w.w * 0.68, y: w.y + w.h * 0.62, r: w.w * 0.2 * dirt + 4 },
        ];
        for (const s of spots) {
          context.fillStyle = `rgba(61,42,90,${0.35 + dirt * 0.5})`;
          context.beginPath();
          context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#ffffff';
          context.beginPath();
          context.arc(s.x - s.r * 0.34, s.y - s.r * 0.12, s.r * 0.24, 0, Math.PI * 2);
          context.fill();
          context.beginPath();
          context.arc(s.x + s.r * 0.34, s.y - s.r * 0.12, s.r * 0.24, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = PALETTE.textDark;
          context.beginPath();
          context.arc(s.x - s.r * 0.34, s.y - s.r * 0.06, s.r * 0.11, 0, Math.PI * 2);
          context.fill();
          context.beginPath();
          context.arc(s.x + s.r * 0.34, s.y - s.r * 0.06, s.r * 0.11, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = `rgba(61,42,90,${0.25 + dirt * 0.3})`;
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
    const tipX = 8 + Math.cos(g.aimAngle) * 28;
    const tipY = -30 + Math.sin(g.aimAngle) * 28;
    context.save();
    context.translate(g.x, g.y);
    context.rotate(tilt);
    // Bright layered spray jet from the wand tip.
    if (g.spraying) {
      context.save();
      context.translate(tipX, tipY);
      context.rotate(g.aimAngle);
      const layers = [
        { len: 290, half: 52, from: 'rgba(191,233,255,0.30)', to: 'rgba(191,233,255,0)' },
        { len: 250, half: 34, from: 'rgba(191,233,255,0.55)', to: 'rgba(191,233,255,0)' },
        { len: 200, half: 13, from: 'rgba(255,255,255,0.9)', to: 'rgba(255,255,255,0)' },
      ];
      for (const layer of layers) {
        const grad = context.createLinearGradient(0, 0, layer.len, 0);
        grad.addColorStop(0, layer.from);
        grad.addColorStop(1, layer.to);
        context.fillStyle = grad;
        context.beginPath();
        context.moveTo(0, -5);
        context.lineTo(layer.len, -layer.half);
        context.lineTo(layer.len, layer.half);
        context.lineTo(0, 5);
        context.closePath();
        context.fill();
      }
      context.restore();
    }
    // Platform: pink with gold trim and a heart.
    context.fillStyle = PALETTE.gondolaDark;
    roundRect(-44, -2, 88, 26, 5);
    context.fill();
    context.fillStyle = PALETTE.gondola;
    roundRect(-44, -6, 88, 12, 5);
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.fillRect(-44, 8, 88, 3);
    drawHeart(-30, 2, 6, PALETTE.gold);
    drawSparkle(30, 2, 5, PALETTE.sparkle, 0.9);
    // Gold railings.
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-40, -6);
    context.lineTo(-40, -26);
    context.lineTo(40, -26);
    context.lineTo(40, -6);
    context.stroke();
    // Water tank with a visible level and a star.
    context.fillStyle = '#2b2b2b';
    roundRect(18, -24, 20, 20, 3);
    context.fill();
    const level = (g.water / 100) * 16;
    context.fillStyle = g.water < 25 ? PALETTE.danger : PALETTE.water;
    context.fillRect(20, -6 - level, 16, level);
    drawSparkle(28, -14, 4, PALETTE.sparkle, 0.9);
    // Sora: twin-tails, big eyes, sailor outfit, spray wand.
    // Twin-tails.
    context.fillStyle = PALETTE.hair;
    context.beginPath();
    context.ellipse(-17, -40, 6, 14, 0.3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(15, -40, 6, 14, -0.3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(-14, -50, 2.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(12, -50, 2.5, 0, Math.PI * 2);
    context.fill();
    // Legs and shoes.
    context.fillStyle = PALETTE.skin;
    context.fillRect(-8, -14, 6, 9);
    context.fillRect(2, -14, 6, 9);
    context.fillStyle = PALETTE.scarf;
    context.fillRect(-9, -6, 8, 4);
    context.fillRect(1, -6, 8, 4);
    // Skirt.
    context.fillStyle = PALETTE.skirt;
    context.beginPath();
    context.moveTo(-12, -24);
    context.lineTo(10, -24);
    context.lineTo(14, -12);
    context.lineTo(-16, -12);
    context.closePath();
    context.fill();
    // Sailor top with collar and scarf.
    context.fillStyle = PALETTE.outfit;
    roundRect(-12, -40, 22, 18, 6);
    context.fill();
    context.fillStyle = PALETTE.collar;
    context.beginPath();
    context.moveTo(-12, -38);
    context.lineTo(-1, -28);
    context.lineTo(10, -38);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.scarf;
    context.beginPath();
    context.arc(-1, -36, 3, 0, Math.PI * 2);
    context.fill();
    // Head, hair, big eyes, blush, smile.
    context.fillStyle = PALETTE.hair;
    context.beginPath();
    context.arc(-1, -46, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.skin;
    context.beginPath();
    context.arc(-1, -44, 8.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.hair;
    context.beginPath();
    context.arc(-1, -47, 8.5, Math.PI, 0);
    context.fill();
    for (const side of [-1, 1]) {
      const ex = -1 + side * 3.6;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.ellipse(ex, -44, 2.2, 3, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.textDark;
      context.beginPath();
      context.arc(ex, -43.6, 1.3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(ex - 0.6, -45, 0.6, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = 'rgba(255,158,207,0.85)';
    context.beginPath();
    context.ellipse(-7, -41, 1.8, 1.1, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(5, -41, 1.8, 1.1, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.textDark;
    context.lineWidth = 1.4;
    context.beginPath();
    context.arc(-1, -41.5, 2, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
    // Spray wand in her hands, toward the aim.
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(8, -30);
    context.lineTo(tipX, tipY);
    context.stroke();
    drawSparkle(tipX, tipY, 5, PALETTE.sparkle, 0.95);
    context.restore();
  }

  /** Mischievous sky sprites: plump white birds with big eyes and pink cheeks. */
  function drawSprites(state) {
    for (let index = 0; index < state.sprites.length; index += 1) {
      const p = state.sprites[index];
      if (!p.active) continue;
      const flap = Math.sin(p.phase) * 7;
      const dir = p.vx > 0 ? 1 : -1;
      context.save();
      context.translate(p.x, p.y);
      context.scale(dir, 1);
      // Wing.
      context.fillStyle = PALETTE.spriteDark;
      context.beginPath();
      context.moveTo(-4, -2);
      context.quadraticCurveTo(-18, -14 - flap, -26, -2 - flap);
      context.quadraticCurveTo(-14, 3, -4, 3);
      context.closePath();
      context.fill();
      // Body with a soft outline so it reads against the sky.
      context.fillStyle = PALETTE.sprite;
      context.strokeStyle = 'rgba(91,74,138,0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(12, -5, 7, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      // Big eye, beak, cheek.
      context.fillStyle = PALETTE.textDark;
      context.beginPath();
      context.arc(14, -6, 2.4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(13.2, -6.8, 0.9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.beak;
      context.beginPath();
      context.moveTo(18, -5);
      context.lineTo(24, -3);
      context.lineTo(18, -1);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.cheek;
      context.beginPath();
      context.arc(10, -1, 2.4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  /** Falling star shards: glowing gold crystals with a trail and a clear warning. */
  function drawShards(state) {
    for (let index = 0; index < state.shards.length; index += 1) {
      const t = state.shards[index];
      if (!t.active) continue;
      if (t.warn > 0) {
        // Telegraph: a pulsing pink marker at the roof, a glow on the face, and a "!".
        const on = Math.floor(t.warn * 8) % 2 === 0;
        if (on) {
          context.fillStyle = PALETTE.danger;
          context.beginPath();
          context.moveTo(t.x, FACE.y + 2);
          context.lineTo(t.x - 11, FACE.y + 20);
          context.lineTo(t.x + 11, FACE.y + 20);
          context.closePath();
          context.fill();
          text('!', t.x, FACE.y + 38, 18, '#ffffff', 'center');
        }
        context.fillStyle = 'rgba(255,217,61,0.25)';
        context.beginPath();
        context.ellipse(t.x, t.y + 60, 20, 6, 0, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.save();
      context.translate(t.x, t.y);
      // Trail sparkles.
      drawSparkle(0, -34, 4, PALETTE.gold, 0.6);
      drawSparkle(0, -22, 3, PALETTE.sparkle, 0.7);
      context.rotate(t.angle);
      context.fillStyle = PALETTE.shardDark;
      drawSparkle(0, 0, 16, PALETTE.shardDark, 1);
      context.fillStyle = PALETTE.shard;
      drawSparkle(0, 0, 11, PALETTE.shard, 1);
      context.fillStyle = '#ffffff';
      drawSparkle(0, 0, 5, '#ffffff', 1);
      context.restore();
    }
  }

  function drawParticles(state) {
    for (let index = 0; index < state.particles.length; index += 1) {
      const p = state.particles[index];
      if (!p.active) continue;
      const a = p.life / p.maxLife;
      if (p.kind === 1) {
        // Clean burst: sparkle stars.
        drawSparkle(p.x, p.y, p.size * 2.2, p.color, a);
      } else if (p.kind === 2) {
        // Droplet: a bright short streak along its velocity.
        context.globalAlpha = a;
        context.strokeStyle = '#dff4ff';
        context.lineWidth = p.size + 1;
        context.beginPath();
        context.moveTo(p.x, p.y);
        context.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        context.stroke();
        context.globalAlpha = 1;
      } else {
        context.globalAlpha = a;
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
    }
    for (let index = 0; index < state.floaters.length; index += 1) {
      const f = state.floaters[index];
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life / f.maxLife + 0.3);
      context.font = `bold ${f.size}px ${FONT}`;
      context.textAlign = 'center';
      context.lineWidth = 4;
      context.lineJoin = 'round';
      context.strokeStyle = PALETTE.textDark;
      context.strokeText(f.text, f.x, f.y);
      context.fillStyle = f.color;
      context.fillText(f.text, f.x, f.y);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    outlineText(scoreLabel(state.score), 24, 16, 26, PALETTE.text, 'left');
    if (state.combo >= 2) {
      outlineText(comboLabel(state.combo), 24, 46, 22, PALETTE.combo, 'left');
    }
    const mins = Math.floor(state.timeLeft / 60);
    const secs = Math.floor(state.timeLeft % 60);
    const timeText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    const timeColor = state.timeLeft < 20 ? PALETTE.danger : PALETTE.text;
    outlineText(towerLabel(state.level), FIELD.width / 2, 16, 26, PALETTE.text, 'center');
    outlineText(timeText, FIELD.width / 2, 46, 24, timeColor, 'center');
    text(cleanLabel(`${state.cleaned}/${state.totalWindows} windows`), FIELD.width / 2, 74, 18, PALETTE.muted, 'center');
    // Lives as hearts in the left margin, clear of the gondola's reach.
    plainText('LIVES', 24, 80, 13, PALETTE.muted, 'left');
    for (let life = 0; life < LIVES; life += 1) {
      drawHeart(36 + life * 30, 100, 11, life < state.lives ? PALETTE.scarf : 'rgba(255,255,255,0.18)');
    }
    // Water gauge along the bottom centre, clear of the gondola's reach.
    const gw = 200;
    const gx = FIELD.width / 2 - gw / 2;
    const gy = 694;
    plainText('WATER', gx - 10, gy + 1, 13, PALETTE.text, 'right');
    context.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(gx, gy, gw, 16, 8);
    context.fill();
    context.fillStyle = state.gondola.water < 25 ? PALETTE.danger : PALETTE.water;
    const ww = Math.max(0, (state.gondola.water / 100) * (gw - 4));
    if (ww > 0) {
      roundRect(gx + 2, gy + 2, ww, 12, 6);
      context.fill();
    }
    if (state.gondola.y <= GONDOLA.roofY && state.gondola.water < 100) {
      plainText('REFILLING~', FIELD.width / 2, gy - 22, 14, PALETTE.water, 'center');
    }
    // Wind banner as a solid pill so it reads over the windows.
    if (state.wind.active) {
      const arrow = state.wind.dir > 0 ? 'WIND  >>>' : '<<<  WIND';
      context.font = `bold 20px ${FONT}`;
      const w = context.measureText(arrow).width + 36;
      const px = FIELD.width / 2 - w / 2;
      const py = 100;
      context.fillStyle = 'rgba(42,26,74,0.85)';
      roundRect(px, py, w, 32, 16);
      context.fill();
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      roundRect(px, py, w, 32, 16);
      context.stroke();
      text(arrow, FIELD.width / 2, py + 6, 20, PALETTE.skyBottom, 'center');
    }
  }

  function panelHeight(lines) {
    return PANEL.top + lines.length * PANEL.line + PANEL.bottom;
  }

  function drawPanel(title, lines, prompt) {
    const height = panelHeight(lines);
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(20,10,40,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const grad = context.createLinearGradient(0, y, 0, y + height);
    grad.addColorStop(0, '#3a2560');
    grad.addColorStop(1, PALETTE.panel);
    context.fillStyle = grad;
    roundRect(x, y, PANEL.width, height, 16);
    context.fill();
    context.save();
    context.shadowColor = PALETTE.panelEdge;
    context.shadowBlur = 18;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(x, y, PANEL.width, height, 16);
    context.stroke();
    context.restore();
    // Corner sparkles.
    drawSparkle(x + 22, y + 22, 7, PALETTE.gold, 0.9);
    drawSparkle(x + PANEL.width - 22, y + 22, 7, PALETTE.petal, 0.9);
    drawSparkle(x + 22, y + height - 22, 6, PALETTE.petal, 0.8);
    drawSparkle(x + PANEL.width - 22, y + height - 22, 6, PALETTE.gold, 0.8);
    context.textBaseline = 'alphabetic';
    context.save();
    context.shadowColor = PALETTE.panelEdge;
    context.shadowBlur = 14;
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    context.restore();
    for (let index = 0; index < lines.length; index += 1) {
      plainText(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Sora rides her sparkle gondola down the Sky Tower.',
    'Clean every window before the Sky Festival begins!',
    'Move with WASD or arrows. Aim with the mouse.',
    'Hold Space or click to spray. Water refills only at the roof.',
    'Sky sprites and falling star shards cost a life. Mind the wind.',
    '',
  ];
  const PAUSED_LINES = ['The tower will wait for you.'];
  const OVER_LINES = ['', '', ''];
  const WIN_LINES = ['', '', ''];
  const LEVEL_LINES = ['', '', ''];

  /** Paint one frame: the sky, the tower, the things on it, then the HUD or a panel. */
  function draw(state, screen, best, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.skyTop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const sx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const sy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawSky(state);
    drawFace(state);
    drawShards(state);
    drawSprites(state);
    drawGondola(state);
    drawParticles(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('GONDOLA LANGIT', TITLE_LINES, 'Press Space or click to start');
      drawSoraHead(FIELD.width / 2, (FIELD.height - panelHeight(TITLE_LINES)) / 2 - 8, 30);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_LEVEL) {
      LEVEL_LINES[0] = `Tower ${state.level} sparkles!`;
      LEVEL_LINES[1] = bonusLabel(state.lastBonus);
      LEVEL_LINES[2] = finalLabel(state.score);
      drawPanel('Tower sparkles!', LEVEL_LINES, state.level >= 3 ? 'Press Space for the results' : 'Press Space for the next tower');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = state.lastReason === 'time' ? 'The festival began with dusty windows.' : 'Sora took one tumble too many.';
      OVER_LINES[1] = finalLabel(state.score);
      OVER_LINES[2] = bestLabel(best);
      drawPanel("Time's up!", OVER_LINES, 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = 'Every window on the tower sparkles.';
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
