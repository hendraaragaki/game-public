// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
//
// The game: "Gondola Langit". You ride a gondola platform down the face of a tower and spray
// dirty windows clean before the shift timer runs out. Water refills only at the roof, so every
// trip down is a tradeoff. Three buildings, taller, dirtier and windier each time.

export const FIELD = { width: 1280, height: 720 };

/** The building face the gondola rides on (the sky is the margin around it). */
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
  sprayRate: 42,
  /** Water spent per second while spraying. */
  waterUse: 30,
  /** Water regained per second while parked at the roof. */
  refillRate: 45,
  /** Tank capacity. */
  tank: 100,
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

/** The three buildings: taller (more windows), dirtier, windier, longer shifts. */
export const LEVELS = [
  { cols: 5, rows: 6, dirtMin: 50, dirtMax: 80, shiftSeconds: 120, pigeonEvery: [6.5, 10], toolEvery: [6, 9], windEvery: [12, 17], windStrength: 150 },
  { cols: 6, rows: 7, dirtMin: 65, dirtMax: 90, shiftSeconds: 140, pigeonEvery: [5, 8], toolEvery: [4.5, 7], windEvery: [9, 14], windStrength: 230 },
  { cols: 6, rows: 8, dirtMin: 70, dirtMax: 100, shiftSeconds: 160, pigeonEvery: [4, 6.5], toolEvery: [3.5, 6], windEvery: [7, 11], windStrength: 320 },
];

export const LIVES = 3;

/** Combo: each window cleaned in a row raises the multiplier; a hit or a 4 s gap resets it. */
export const COMBO = { windowSeconds: 4, step: 0.25, maxCombo: 12 };

/** Scoring. */
export const SCORE = { windowBase: 100, timeBonus: 10, lifeBonus: 150, winBonus: 1000 };

/** Hazards. */
export const PIGEON = { speedMin: 140, speedMax: 210, radius: 14, dropChance: 0.25, dropDirt: 12 };
export const TOOL = { fallSpeed: 430, warnSeconds: 0.7, radius: 12 };
export const WIND = { gustSeconds: [2.5, 3.5] };

/** How many of each thing can exist at once; pools are allocated once, at boot. */
export const POOL = { pigeons: 8, tools: 6, particles: 320, floaters: 32, droplets: 160 };

export const PALETTE = {
  skyTop: '#2b3a67',
  skyMid: '#7d90c2',
  skyBottom: '#f2c98a',
  sun: '#ffd98a',
  face: '#8a7f74',
  faceDark: '#6e645a',
  floorLine: '#5d5348',
  frame: '#3e3a36',
  glassClean: '#a8d8ea',
  glassCleanDeep: '#6fb3d4',
  glassDirty: '#5c4a33',
  grime: '#4a3a26',
  gondola: '#c8552e',
  gondolaDark: '#8f3a1e',
  cable: '#2b2b2b',
  worker: '#f2c94c',
  workerSkin: '#e8b48a',
  hardHat: '#f2c94c',
  water: '#4fc3f7',
  waterEmpty: '#5a6b7a',
  pigeon: '#8b93a3',
  pigeonDark: '#5d6472',
  tool: '#c9ced6',
  toolDark: '#7a828e',
  text: '#f4efe6',
  textDark: '#241f1a',
  muted: '#c9c2b4',
  panel: '#241f1a',
  panelEdge: '#f2c94c',
  danger: '#e5534b',
  gold: '#f2c94c',
  combo: '#ff9a3d',
  spray: '#bfe9ff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gondola-langit.best';
