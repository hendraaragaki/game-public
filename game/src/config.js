// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
//
// The game: "Gondola Langit". You ride a gondola platform down the face of a tower and spray
// dirty windows clean before the festival timer runs out. Water refills only at the roof, so every
// trip down is a tradeoff. Ten towers, taller, dirtier and windier each time.

export const FIELD = { width: 1280, height: 720 };

/** The tower face the gondola rides on (the sky is the margin around it). */
export const FACE = { x: 140, y: 40, width: 1000, height: 640 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The gondola: a platform with a worker, a water tank and a spray nozzle. */
export const GONDOLA = {
  width: 88,
  height: 26,
  accel: 2600,
  maxSpeed: 310,
  /** Seconds of no control after a hit (the knockback shove). */
  stun: 0.35,
  /** Seconds the gondola cannot be hit again after a hit. */
  invulnerable: 1.5,
  /** How far the spray jet reaches, in pixels. */
  sprayRange: 290,
  /** Half-angle of the spray cone, in radians. */
  sprayHalfAngle: 0.32,
  /** Dirt removed per second from a window inside the spray cone. */
  sprayRate: 46,
  /** Water spent per second while spraying. */
  waterUse: 30,
  /** Water regained per second while parked at the roof. */
  refillRate: 45,
  /** Tank capacity. */
  tank: 120,
  /** Gondola y (its centre) at or above this counts as "at the roof". */
  roofY: 96,
};

/** A window's dirt: 0 is spotless, 100 is filthy. A window left half-clean slowly gets dirty
 * again; a fully clean window stays clean. */
export const WINDOW = {
  /** Dirt creeps back onto a half-clean window ignored this long (seconds). */
  resoilDelay: 8,
  /** Dirt per second regained by an ignored window. */
  resoilRate: 1.5,
};

/** The ten towers: taller (more windows), dirtier, windier, longer festivals. */
export const LEVELS = [
  { cols: 5, rows: 6, dirtMin: 40, dirtMax: 60, timeSeconds: 120, spriteEvery: [6.5, 10], shardEvery: [6, 9], windEvery: [12, 17], windStrength: 150 },
  { cols: 5, rows: 7, dirtMin: 50, dirtMax: 70, timeSeconds: 130, spriteEvery: [5.5, 9], shardEvery: [5, 8], windEvery: [10, 15], windStrength: 180 },
  { cols: 6, rows: 6, dirtMin: 55, dirtMax: 75, timeSeconds: 140, spriteEvery: [5, 8], shardEvery: [4.5, 7], windEvery: [9, 14], windStrength: 230 },
  { cols: 6, rows: 7, dirtMin: 60, dirtMax: 80, timeSeconds: 150, spriteEvery: [4.5, 7.5], shardEvery: [4, 6.5], windEvery: [8, 13], windStrength: 260 },
  { cols: 6, rows: 8, dirtMin: 65, dirtMax: 85, timeSeconds: 160, spriteEvery: [4, 6.5], shardEvery: [3.5, 6], windEvery: [7, 11], windStrength: 320 },
  { cols: 7, rows: 7, dirtMin: 70, dirtMax: 90, timeSeconds: 170, spriteEvery: [3.5, 6], shardEvery: [3, 5.5], windEvery: [6.5, 10], windStrength: 360 },
  { cols: 7, rows: 8, dirtMin: 75, dirtMax: 95, timeSeconds: 180, spriteEvery: [3, 5.5], shardEvery: [2.8, 5], windEvery: [6, 9.5], windStrength: 400 },
  { cols: 7, rows: 9, dirtMin: 80, dirtMax: 95, timeSeconds: 190, spriteEvery: [2.8, 5], shardEvery: [2.5, 4.5], windEvery: [5.5, 9], windStrength: 440 },
  { cols: 8, rows: 9, dirtMin: 85, dirtMax: 100, timeSeconds: 200, spriteEvery: [2.5, 4.5], shardEvery: [2.2, 4], windEvery: [5, 8], windStrength: 480 },
  { cols: 8, rows: 10, dirtMin: 90, dirtMax: 100, timeSeconds: 210, spriteEvery: [2.2, 4], shardEvery: [2, 3.5], windEvery: [4.5, 7.5], windStrength: 520 },
];

export const LIVES = 3;

/** Combo: each window cleaned in a row raises the multiplier; a hit or a 4 s gap resets it. */
export const COMBO = { windowSeconds: 4, step: 0.25, maxCombo: 12 };

/** Scoring. */
export const SCORE = { windowBase: 100, timeBonus: 10, lifeBonus: 150, winBonus: 1000 };

/** Hazards. */
export const SPRITE = { speedMin: 140, speedMax: 210, radius: 14, dropChance: 0.25, dropDirt: 12 };
export const SHARD = { fallSpeed: 430, warnSeconds: 0.7, radius: 12 };
export const WIND = { gustSeconds: [2.5, 3.5] };

/** How many of each thing can exist at once; pools are allocated once, at boot. */
export const POOL = { sprites: 8, shards: 6, particles: 320, floaters: 32, droplets: 160 };

export const PALETTE = {
  skyTop: '#5a4fcf',
  skyMid: '#ff7eb9',
  skyBottom: '#ffc46b',
  sun: '#fff3a0',
  face: '#c9a7ff',
  faceDark: '#9d7fe0',
  floorLine: '#8a6fd6',
  frame: '#5b4a8a',
  glassClean: '#a8ecff',
  glassCleanDeep: '#6fc3f2',
  glassDirty: '#8a6a9e',
  grime: '#3d2a5a',
  gondola: '#ff5fa2',
  gondolaDark: '#d6336c',
  cable: '#4a2a5a',
  hair: '#ff5fa2',
  hairDark: '#d6336c',
  skin: '#ffe0c2',
  outfit: '#ffffff',
  collar: '#ff5fa2',
  scarf: '#ff4757',
  skirt: '#7b5cff',
  water: '#4fc3f7',
  waterEmpty: '#5a6b7a',
  sprite: '#ffffff',
  spriteDark: '#c9b8e8',
  beak: '#ff9a3d',
  cheek: '#ff9ecf',
  shard: '#ffd93d',
  shardDark: '#ff9a3d',
  text: '#fff7f0',
  textDark: '#2a1a4a',
  muted: '#e8d5ff',
  panel: '#2a1a4a',
  panelEdge: '#ff7eb9',
  danger: '#ff4757',
  gold: '#ffd93d',
  combo: '#ff9a3d',
  spray: '#bfe9ff',
  sparkle: '#ffffff',
  petal: '#ffb3d9',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gondola-langit.best';
