// ============================================================
// Match-3D.js — Configuração central
// Compartilhado por game/, render/, input/, ui/, audio/
// ============================================================

export const BOARD = {
  COLS: 8,
  ROWS: 12,          // total rows; top 2-3 são off-screen (spawn zone)
  VISIBLE_ROWS: 8,   // rows visíveis no viewport
  CELL_SIZE: 1.0,
  GAP: 1.12,         // espaçamento entre células (respiro visual)
  LAND_DELAY: 0.25,  // segundos antes de checar match após pousar
};

export const COLUMN = {
  GEMS_PER_COLUMN: 3,
  BASE_FALL_INTERVAL: 0.85,  // segundos por célula no nível 1
  MIN_FALL_INTERVAL: 0.18,   // teto de velocidade
  LEVEL_SPEEDUP: 0.06,       // redução por nível
  SOFT_DROP_MULT: 0.12,      // velocidade do soft drop
};

export const GEM_COLORS = 6; // 6 cores + wild (índice 6)

// Cada cor: [nome, corBase, corEmissiva, corSpecular]
export const GEM_DEFS = [
  ['Fire Ruby',    '#FF2D55', '#FF6B81', '#FFC4CE'],
  ['Solar Topaz',  '#FF9F0A', '#FFC24B', '#FFE3B0'],
  ['Emerald',      '#30D158', '#7BE9A0', '#D2F7DF'],
  ['Aquamarine',   '#0BD1E8', '#6FE7F5', '#D6FBFF'],
  ['Amethyst',     '#AF52DE', '#D9A0F5', '#F2DFFB'],
  ['Frost Diamond','#F2F4F8', '#E8EDF5', '#FFFFFF'],
  ['Wild Star',    '#FFD60A', '#FFF3B0', '#FFF8D6'],  // índice 6 — especial
];

export const SCORING = {
  BASE_MATCH: 60,
  COMBO_MULT: 1.5,     // cada gem extra além de 3
  CASCADE_BONUS: 2,    // multiplicador por cascata
  WILD_BONUS: 150,     // bônus quando wild participa do match
  LEVEL_UP_EVERY: 800, // pontos por level
};

export const RENDER = {
  PIXEL_RATIO: 2,
  FOV: 42,
  CAMERA_POS: [0, 0, 16],
  CAMERA_LOOKAT: [0, -1.5, 0],
  BLOOM_STRENGTH: 0.55,
  BLOOM_RADIUS: 0.5,
  BLOOM_THRESHOLD: 0.92, // alto: só sparkles + emissive intenso brilham,
                         // não o corpo da gem (evita look de "orbe de luz")
  AMBIENT_INTENSITY: 0.35,
  KEY_LIGHT_INTENSITY: 2.2,
  FILL_LIGHT_INTENSITY: 0.6,
  RIM_LIGHT_INTENSITY: 1.4,
};

export const INPUT = {
  KEY_LEFT: ['ArrowLeft', 'KeyA'],
  KEY_RIGHT: ['ArrowRight', 'KeyD'],
  KEY_ROTATE: ['ArrowUp', 'KeyW'],
  KEY_SOFT_DROP: ['ArrowDown', 'KeyS'],
  KEY_HARD_DROP: ['Space'],
  KEY_PAUSE: ['KeyP', 'Escape'],
  KEY_RESTART: ['KeyR'],
};

export const AUDIO = {
  MASTER_VOLUME: 0.8,
  SFX: {
    move:     { type: 'square', freq: 320,  dur: 0.04, vol: 0.15 },
    rotate:   { type: 'square', freq: 420,  dur: 0.06, vol: 0.15 },
    land:     { type: 'triangle', freq: 180, dur: 0.08, vol: 0.25 },
    match:    { type: 'sine',   freq: 520,  dur: 0.12, vol: 0.3 },
    combo:    { type: 'sine',   freq: 660,  dur: 0.18, vol: 0.35 },
    levelup:  { type: 'sine',   freq: 880,  dur: 0.3,  vol: 0.4 },
    gameover: { type: 'sawtooth', freq: 110, dur: 0.8, vol: 0.35 },
    select:   { type: 'triangle', freq: 300, dur: 0.05, vol: 0.2 },
  },
};

export const TUNING = {
  EASE_FALL: [0.34, 1.2, 0.4, 1],        // cubic-bezier overshoot leve
  EASE_POP: [0.2, 1.4, 0.3, 1],
  MATCH_FLASH_MS: 250,
  EXPLOSION_PARTICLES: 18,
  EXPLOSION_MS: 400,
  SHAKE_MATCH_PX: 4,
  SHAKE_BIG_COMBO_PX: 7,
  SHAKE_MS: 300,
  REDUCED_MOTION: false, // preenchido no runtime via matchMedia
};
