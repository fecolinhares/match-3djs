// ============================================================
// Match-3D.js — Board (grid + gravidade + matches)
// Lógica pura — sem Three.js, sem DOM
// ============================================================

import { BOARD, COLUMN, GEM_COLORS } from '../config.js';
import { MatchDetector } from './MatchDetector.js';
import { FallingColumn } from './FallingColumn.js';

/**
 * O tabuleiro: grid[linha][coluna] = índice de cor ou null.
 * y = 0 é o topo (spawn). Linhas altas (acima do visível) existem
 * para a coluna cair de fora da tela.
 */
export class Board {
  /**
   * @param {object} opts
   * @param {number} opts.cols
   * @param {number} opts.rows
   * @param {object} opts.callbacks { onScore, onCombo, onLevelUp, onGameOver }
   */
  constructor(opts = {}) {
    this.cols = opts.cols ?? BOARD.COLS;
    this.rows = opts.rows ?? BOARD.ROWS;
    this.callbacks = opts.callbacks ?? {};

    // grid[y][x] = colorIndex | null
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));

    this.detector = new MatchDetector(this.cols, this.rows);
    this.falling = null;          // FallingColumn ativa
    this.landing = false;         // pausa curta após pousar antes do match check
    this.landTimer = 0;
    this.pendingMatches = [];     // matches detectados aguardando clear
    this.resolving = false;       // true durante cascade/clear/gravity
    this.combo = 0;               // cascatas consecutivas
    this.score = 0;
    this.level = 1;
    this.lines = 0;               // gems limpas
    this.over = false;
    this._nextColumn = null;      // pré-gerado para preview
    this._random = opts.random ?? Math.random;
  }

  // ---------- Setup ----------

  _randomColor(excludeWild = false) {
    const max = excludeWild ? GEM_COLORS : GEM_COLORS + 1;
    return Math.floor(this._random() * max);
  }

  _randomColumn() {
    // Evita colunas que criariam match IMEDIATO no spawn (ex: 3 iguais
    // ou que completam uma linha com gems vizinhas já no grid).
    for (let attempt = 0; attempt < 50; attempt++) {
      const gems = [
        this._randomColor(true),
        this._randomColor(true),
        this._randomColor(true),
      ];
      if (!this._wouldMatchOnSpawn(gems)) return gems;
    }
    // Fallback defensivo: aceita a última (evita loop infinito).
    return [
      this._randomColor(true),
      this._randomColor(true),
      this._randomColor(true),
    ];
  }

  /**
   * True se a coluna, ao nascer na posição de spawn, já forma um match
   * (vertical com gems abaixo, ou horizontal/diagonal com vizinhas).
   * Simula a colocação num clone do grid e roda o detector.
   */
  _wouldMatchOnSpawn(gems) {
    const startX = Math.floor(this.cols / 2) - 1;
    const startY = COLUMN.SPAWN_Y;
    const clone = this.grid.map((row) => row.slice());
    // gems[0]=topo fica em startY-2 (fora do grid, não forma match);
    // gems[1]=meio em startY-1 e gems[2]=base em startY entram no grid.
    const rows = [startY - 1, startY];
    for (let i = 0; i < 2; i++) {
      const y = rows[i];
      if (y >= 0 && y < this.rows) clone[y][startX] = gems[i + 1];
    }
    return this.detector.findMatches(clone).length > 0;
  }

  /** Pré-gera a próxima coluna (para preview no HUD). */
  generateNext() {
    this._nextColumn = this._randomColumn();
    return this._nextColumn.slice();
  }

  /** Pré-gera a primeira coluna se necessário. */
  ensureNext() {
    if (!this._nextColumn) this.generateNext();
    return this._nextColumn.slice();
  }

  // ---------- Falling column ----------

  /**
   * Cria uma nova coluna caindo no topo.
   * Se não houver espaço, game over.
   * @returns {FallingColumn|null}
   */
  spawnColumn() {
    if (this.falling) return null;

    this.ensureNext();
    const gems = this._nextColumn.slice();
    this.generateNext(); // prepara a próxima

    const startX = Math.floor(this.cols / 2) - 1;
    // A coluna nasce logo acima/na borda superior da faixa visível
    // (base em COLUMN.SPAWN_Y — antes y=-3, totalmente fora da tela,
    // o que atrasava ~6s a aparição). Cair significa y AUMENTAR até
    // pousar no fundo.
    const startY = COLUMN.SPAWN_Y;
    const column = new FallingColumn(startX, gems, startY);

    // Se não dá pra colocar (topo cheio / já ocupado), game over
    if (!this.detector.canPlace(this.grid, column)) {
      this.over = true;
      this._emit('onGameOver', { score: this.score, level: this.level });
      return null;
    }

    this.falling = column;
    this.landing = false;
    this.resolving = false;
    this.combo = 0;
    this._fallAccum = 0;   // zera acumuladores de queda da coluna anterior
    this._softAccum = 0;
    return column;
  }

  moveFallingLeft() {
    if (!this.falling || this.landing || this.resolving) return false;
    const candidate = this.falling.clone().moveLeft();
    if (this.detector.canPlace(this.grid, candidate)) {
      this.falling.moveLeft();
      return true;
    }
    return false;
  }

  moveFallingRight() {
    if (!this.falling || this.landing || this.resolving) return false;
    const candidate = this.falling.clone().moveRight();
    if (this.detector.canPlace(this.grid, candidate)) {
      this.falling.moveRight();
      return true;
    }
    return false;
  }

  rotateFalling() {
    if (!this.falling || this.landing || this.resolving) return false;
    this.falling.rotate();
    return true;
  }

  /** Move a coluna caindo para uma coluna x específica (mouse). */
  moveFallingTo(x) {
    if (!this.falling || this.landing || this.resolving) return false;
    const target = Math.max(0, Math.min(this.cols - 1, x));
    const candidate = this.falling.clone();
    candidate.x = target;
    if (this.detector.canPlace(this.grid, candidate)) {
      this.falling.x = target;
      return true;
    }
    return false;
  }

  /**
   * Avança o estado por `dt` segundos. Retorna array de eventos
   * para a camada de render consumir (explosões, quedas, etc).
   */
  update(dt) {
    const events = [];
    if (this.over || !this.falling) return events;

    // Pausa de landing antes de resolver matches
    if (this.landing) {
      this.landTimer -= dt;
      if (this.landTimer <= 0) {
        this.landing = false;
        this._resolveLanding(events);
      }
      return events;
    }

    // Auto-queda
    const interval = this._fallInterval();
    this._fallAccum = (this._fallAccum ?? 0) + dt;
    while (this._fallAccum >= interval && !this.landing) {
      this._fallAccum -= interval;
      this._stepFalling(events);
    }

    return events;
  }

  _fallInterval() {
    const speed = COLUMN.BASE_FALL_INTERVAL - (this.level - 1) * COLUMN.LEVEL_SPEEDUP;
    return Math.max(COLUMN.MIN_FALL_INTERVAL, speed);
  }

  /** Soft drop: desce rápido enquanto segura ↓ (passo a cada intervalo×MULT). */
  softDrop(dt) {
    if (!this.falling || this.landing || this.resolving) return [];
    const events = [];
    // Acumula o tempo real e desce 1 célula a cada SOFT_DROP_MULT do
    // intervalo de queda — velocidade bem definida (~30 células/s no
    // nível 1 com MULT 0.06), independente da taxa de repeat do teclado.
    const stepEvery = Math.max(0.02, this._fallInterval() * COLUMN.SOFT_DROP_MULT);
    this._softAccum = (this._softAccum ?? 0) + dt;
    let guard = 0;
    while (this._softAccum >= stepEvery && guard++ < 12) {
      this._softAccum -= stepEvery;
      if (this.landing) break;
      this._stepFalling(events);
    }
    return events;
  }

  /** Hard drop: coluna cai direto pro chão. */
  hardDrop() {
    if (!this.falling || this.landing || this.resolving) return [];
    const events = [];
    // Guard generoso: do spawn (COLUMN.SPAWN_Y) até o fundo (rows-1)
    let guard = 0;
    const maxSteps = this.rows + 4;
    while (!this.landing && guard++ < maxSteps) {
      this._stepFalling(events);
    }
    return events;
  }

  /** Um passo de queda da coluna. */
  _stepFalling(events) {
    if (!this.falling || this.landing) return;
    const column = this.falling.clone();
    column.stepDown(1);
    if (this.detector.canPlace(this.grid, column)) {
      this.falling.stepDown(1);
      events.push({ type: 'fall', x: this.falling.x, y: this.falling.y });
    } else {
      // Não consegue descer. Se a coluna ainda está na zona de spawn
      // (base y < 0 — nenhuma gem chegou a entrar no grid), é GAME OVER:
      // o tabuleiro está cheio no topo.
      if (this.falling.y < 0) {
        this.over = true;
        this.falling = null;
        this._emit('onGameOver', { score: this.score, level: this.level });
        return;
      }
      // Pousou — fixa no grid e aguarda match check
      this._lockColumn(events);
      this.landing = true;
      this.landTimer = BOARD.LAND_DELAY;
    }
  }

  /** Grava as 3 gems da coluna no grid (gems[0]=topo em y-2 ... gems[2]=base em y). */
  _lockColumn(events) {
    const column = this.falling;
    const positions = column.absolutePositions();
    for (let i = 0; i < 3; i++) {
      const p = positions[i];
      if (p.y >= 0 && p.y < this.rows && p.x >= 0 && p.x < this.cols) {
        this.grid[p.y][p.x] = column.gems[i];
        events.push({ type: 'land', x: p.x, y: p.y, color: column.gems[i] });
      }
    }
    this.falling = null;
  }

  /** Após pousar: detecta matches, limpa, aplica gravidade, cascata. */
  _resolveLanding(events) {
    this.resolving = true;
    this._resolveCascade(events, 1);
    this.resolving = false;
    // NOTA: combo NÃO é zerado aqui — é resetado em spawnColumn()
    // (chamado logo abaixo). Mantê-lo até lá permite que a UI leia
    // o combo final da cascata via snapshot/eventos.

    // Nova coluna
    this.spawnColumn();
    if (!this.falling && !this.over) {
      this.over = true;
      this._emit('onGameOver', { score: this.score, level: this.level });
    }
  }

  _resolveCascade(events, cascadeDepth) {
    const matches = this.detector.findMatches(this.grid);
    if (matches.length === 0) return;

    const allCells = new Set();
    let wildInMatch = false;
    for (const m of matches) {
      if (m.color === 6) wildInMatch = true;
      for (const c of m.cells) allCells.add(`${c.x},${c.y}`);
    }

    // Pontuação
    const gemCount = allCells.size;
    const comboMult = this.combo > 0 ? this.combo : 1;
    let points = Math.round(
      gemCount * comboMult *
      Math.pow(2, cascadeDepth - 1)  // cascade bonus
    );
    if (wildInMatch) points += 150;
    this.score += points;
    this.lines += gemCount;

    // Level up
    const newLevel = Math.floor(this.score / 800) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      this._emit('onLevelUp', newLevel);
    }

    this._emit('onScore', points, gemCount, this.combo);
    events.push({
      type: 'match',
      cells: matches,
      points,
      combo: this.combo,
      cascade: cascadeDepth,
    });

    // Limpa as gems
    for (const key of allCells) {
      const [x, y] = key.split(',').map(Number);
      if (this.grid[y] && this.grid[y][x] !== null) {
        this.grid[y][x] = null;
        events.push({ type: 'clear', x, y });
      }
    }

    // Gravidade
    this._applyGravity(events);

    // Combo para a próxima cascata
    this.combo += 1;

    // Re-check (cascata)
    this._resolveCascade(events, cascadeDepth + 1);
  }

  _applyGravity(events) {
    for (let x = 0; x < this.cols; x++) {
      let writeY = this.rows - 1;
      for (let readY = this.rows - 1; readY >= 0; readY--) {
        if (this.grid[readY][x] !== null) {
          if (writeY !== readY) {
            this.grid[writeY][x] = this.grid[readY][x];
            this.grid[readY][x] = null;
            events.push({ type: 'gravity', x, fromY: readY, toY: writeY, color: this.grid[writeY][x] });
          }
          writeY--;
        }
      }
    }
  }

  /** Estado serializável para a camada render consumir. */
  getStateSnapshot() {
    return {
      cols: this.cols,
      rows: this.rows,
      grid: this.grid.map((row) => row.slice()),
      falling: this.falling ? {
        x: this.falling.x,
        y: this.falling.y,
        // Render contrata gems: [bottom, mid, top] — engine usa [top, mid, bottom]
        gems: this.falling.gems.slice().reverse(),
      } : null,
      next: this._nextColumn ? this._nextColumn.slice() : [],
      score: this.score,
      level: this.level,
      lines: this.lines,
      combo: this.combo,
      over: this.over,
    };
  }

  isGameOver() {
    return this.over;
  }

  _emit(name, ...args) {
    if (typeof this.callbacks[name] === 'function') {
      this.callbacks[name](...args);
    }
  }
}
