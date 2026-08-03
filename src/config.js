// ============================================================
// Match-3D.js — Configuração central
// Compartilhado por game/, render/, input/, ui/, audio/
// ============================================================

export const BOARD = {
  COLS: 8,
  ROWS: 14,          // total rows; top rows são off-screen (spawn zone)
  VISIBLE_ROWS: 10,  // rows visíveis (era 8; 12 deixava o board alto demais
                     // p/ o HUD DOM ter espaço próprio — 10 é Columns-esque)
  VISIBLE_START: 4,  // primeira row visível (ROWS - VISIBLE_ROWS)
  CELL_SIZE: 1.0,
  GAP: 1.0,          // era 1.12 — board 12 rows alto demais p/ HUD + fundo caberem
  LAND_DELAY: 0.12,  // segundos antes de checar match após pousar (era 0.25 — jogador dropava durante o landing e era ignorado)
};

export const COLUMN = {
  GEMS_PER_COLUMN: 3,
  // Altura de spawn da base da coluna = primeira row VISÍVEL do board.
  // ANTES: SPAWN_Y=1 (VISIBLE_START-3) fazia a coluna nascer 3 rows ACIMA
  // do topo visível — o jogador só via a peça depois de ~1.65s de queda
  // ('mal dá pra ver caindo'). Agora nasce no topo do viewport e aparece
  // imediatamente. Game over: se o topo está cheio, canPlace() falha no
  // spawn → over=true imediato.
  SPAWN_Y: 6,                  // VISIBLE_START+2 — margem p/ gem superior caber
  BASE_FALL_INTERVAL: 0.55,  // segundos por célula no nível 1 (era 0.85 — lento)
  MIN_FALL_INTERVAL: 0.18,   // teto de velocidade
  LEVEL_SPEEDUP: 0.06,       // redução por nível
  SOFT_DROP_MULT: 0.06,      // fração do intervalo por célula no soft drop
                             // (0.06 → ~30 células/s, claramente rápido)
};

export const GEM_COLORS = 6; // 6 cores + wild (índice 6)

// Cada cor: [nome, corBase, corEmissiva, corSpecular, forma, rim]
// Forma fixa por cor — reproduções EXATAS das 6 jóias da referência
// (docs/reference/gems-reference.jpg): hexagonal (rubi), square-cut
// (safira), emerald step-cut (esmeralda), pear apex-top (topázio),
// brilliant ponta-embaixo (amatista), sphere (âmbar).
// Campo 6 = RIM colorido (outline BackSide), cor do contorno de cada
// jóia na referência — substitui o outline preto cartoony (v2) pelo
// anel colorido brilhante da imagem oficial do usuário.
// Silhouette distinta ajuda a reconhecer a cor (acessibilidade!).
export const GEM_DEFS = [
  ['Fire Ruby',    '#F02E4E', '#FF6A80', '#FFD6DC', 'hexagon',   '#FF4D6D'], // rubi hexagonal (top-left)
  ['Solar Topaz',  '#FF9F1C', '#FFC24D', '#FFE9BC', 'pear',      '#FFC24D'], // pêra apex-top (middle-right)
  ['Emerald',      '#1FCB6E', '#5BEA9D', '#CFF7E0', 'emerald',   '#3EE88A'], // esmeralda step-cut (middle-left)
  ['Aquamarine',   '#00B7E6', '#4AD9F7', '#D6F8FF', 'square',    '#59CDFF'], // square-cut safira (top-right)
  ['Amethyst',     '#9B4DE8', '#C487FF', '#F2E3FF', 'brilliant', '#CE93F0'], // brilliant ponta-embaixo (bottom-left)
  ['Amber',        '#FF8A1E', '#FFB64D', '#FFE9C9', 'sphere',    '#FFB64D'], // âmbar esfera facetada (bottom-right)
  ['Wild Star',    '#FFC700', '#FFE14D', '#FFF7CC', 'brilliant', '#FFD60A'], // índice 6 — especial
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
  CAMERA_POS: [0, 0, 18],  // z=18: células grandes, facetas legíveis
  CAMERA_LOOKAT: [0, 0, 0],  // câmera reta; board desce via BOARD_Y_OFFSET
  // Board desce na tela (topo livre para o HUD DOM). Usado pelo boardGroup
  // E pelo Y_OFFSET das gems — mover juntos mantém o alinhamento.
  BOARD_Y_OFFSET: -1.9,  // z=18: respiro no fundo (peça do fundo não clippa)
  // MOBILE (portrait): zoom out + board MAIS ALTO para os controles touch
  // (fixed bottom, ~150px) NÃO cobrirem o tabuleiro. Aplicados no main.js
  // (mutação de RENDER) antes de SceneManager.init/BoardMesh — ambos leem
  // estes valores na criação. z=24 → board ~60% da altura; offset +0.6 →
  // gap do HUD no topo E faixa inferior livre para os botões (vision:
  // +1.2 colidiu com o HUD; 0.6 dá ~17% gap topo + ~24% inferior).
  MOBILE_CAMERA_Z: 24,
  MOBILE_BOARD_Y_OFFSET: 0.6,
  BLOOM_STRENGTH: 0.22,  // 0.28→0.22 — outlines das gems ficam mais nítidos
  BLOOM_RADIUS: 0.42,
  BLOOM_THRESHOLD: 0.96, // alto: só sparkles intensos brilham; evita washout
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
  // 250 → 550ms: o flash de match precisa ser LONGO o bastante para o
  // jogador VER quais peças brilham antes de sumirem (user: "as peças
  // que fizeram o combo brilhem, e depois sumam" — 250ms era confuso).
  MATCH_FLASH_MS: 550,
  EXPLOSION_PARTICLES: 26,
  EXPLOSION_MS: 400,
  SHAKE_MATCH_PX: 0,     // 4 → 0: shake de match removido (user: "o shake
                         // da tela e só sumir está super confuso")
  SHAKE_BIG_COMBO_PX: 0, // 7 → 0: combos grandes também sem shake —
                         // o brilho→explosão carrega a leitura sozinho
  SHAKE_MS: 300,
  REDUCED_MOTION: false, // preenchido no runtime via matchMedia
};
