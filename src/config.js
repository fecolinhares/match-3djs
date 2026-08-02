// ============================================================
// Match-3D.js — Configuração central
// Compartilhado por game/, render/, input/, ui/, audio/
// ============================================================

export const BOARD = {
  COLS: 8,
  ROWS: 12,          // total rows; top 2-3 são off-screen (spawn zone)
  VISIBLE_ROWS: 8,   // rows visíveis no viewport
  VISIBLE_START: 4,  // primeira row visível (ROWS - VISIBLE_ROWS)
  CELL_SIZE: 1.0,
  GAP: 1.12,         // espaçamento entre células (respiro visual)
  LAND_DELAY: 0.12,  // segundos antes de checar match após pousar (era 0.25 — jogador dropava durante o landing e era ignorado)
};

export const COLUMN = {
  GEMS_PER_COLUMN: 3,
  // Altura de spawn da base da coluna. Antes era -3 (totalmente fora da
  // tela) e com BASE_FALL_INTERVAL 0.85s a coluna levava ~6s para aparecer
  // no viewport — o jogador achava que o jogo travou. Agora nasce logo
  // acima da faixa visível (VISIBLE_START - 3 = 1): gems nas rows -1..1,
  // já na borda superior da tela. Game over segue funcionando: se o topo
  // está cheio, canPlace() falha no spawn → over=true imediato.
  SPAWN_Y: 1,                // base da coluna no spawn (VISIBLE_START - 3)
  BASE_FALL_INTERVAL: 0.55,  // segundos por célula no nível 1 (era 0.85 — lento)
  MIN_FALL_INTERVAL: 0.18,   // teto de velocidade
  LEVEL_SPEEDUP: 0.06,       // redução por nível
  SOFT_DROP_MULT: 0.06,      // fração do intervalo por célula no soft drop
                             // (0.06 → ~30 células/s, claramente rápido)
};

export const GEM_COLORS = 6; // 6 cores + wild (índice 6)

// Cada cor: [nome, corBase, corEmissiva, corSpecular]
// Anti-slop (taste): cores com matiz distinto + saturação controlada,
// NÃO o "rainbow puro" de IA. Frost Diamond é a mais clara mas não
// branca pura — evita washout sob bloom.
export const GEM_DEFS = [
  ['Fire Ruby',    '#E0314E', '#FF5C73', '#FFC4CE'],
  ['Solar Topaz',  '#E8890B', '#FFB224', '#FFE3B0'],
  ['Emerald',      '#2FA86B', '#5FD68F', '#C9F2DA'],
  ['Aquamarine',   '#0E9FBB', '#38CBE8', '#C9F4FB'],
  ['Amethyst',     '#8E4EC6', '#B87AE0', '#EBD6F7'],
  ['Frost Diamond','#B8C0CE', '#7A8496', '#FFFFFF'],
  ['Wild Star',    '#E2B400', '#FFD60A', '#FFF3B0'],  // índice 6 — especial
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
  BLOOM_STRENGTH: 0.35,
  BLOOM_RADIUS: 0.45,
  BLOOM_THRESHOLD: 0.95, // alto: só sparkles intensos brilham; evita washout
                         // branco nas gems claras (Frost Diamond)
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
