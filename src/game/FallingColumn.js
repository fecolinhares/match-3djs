// ============================================================
// Match-3D.js — FallingColumn (coluna de 3 gems caindo)
// Lógica pura — sem Three.js, sem DOM
// ============================================================

import { BOARD } from '../config.js';

/**
 * A coluna de 3 gems que o jogador controla enquanto cai.
 * `gems` é a lista de cores de cima para baixo (índice 0 = topo).
 * `y` é a linha da gem INFERIOR da coluna (em unidades de célula, pode
 * ser fracionário para animação suave — o Board usa y inteiro quando pousa).
 */
export class FallingColumn {
  /**
   * @param {number} x coluna horizontal
   * @param {number[]} gems 3 cores, índice 0 = topo
   * @param {number} y posição da gem inferior (flutuante)
   * @param {number|null} id opcional
   */
  constructor(x, gems, y, id = null) {
    this.x = x;
    this.gems = gems.length === 3 ? gems.slice() : this._normalize(gems);
    this.y = y;
    this.id = id;
  }

  _normalize(gems) {
    const g = gems.slice();
    while (g.length < 3) g.unshift(0);
    return g.slice(0, 3);
  }

  /** Cor da gem no índice (0 = topo, 2 = base). */
  colorAt(index) {
    return this.gems[index] ?? 0;
  }

  /** Rotaciona: topo → base, base → meio, meio → topo. */
  rotate() {
    const [a, b, c] = this.gems;
    this.gems = [c, a, b];
    return this;
  }

  /** Move horizontalmente, respeitando bordas. */
  moveLeft() {
    if (this.x > 0) this.x -= 1;
    return this;
  }

  /** Move horizontalmente, respeitando bordas. */
  moveRight() {
    if (this.x < BOARD.COLS - 1) this.x += 1;
    return this;
  }

  /**
   * Desce a coluna em direção ao fundo do grid.
   * y=0 é o topo; cair significa y AUMENTAR.
   */
  stepDown(amount = 1) {
    this.y += amount;
    return this;
  }

  /**
   * Posições absolutas de cada gem no grid.
   * `y` é a linha da gem BASE (a mais baixa da coluna, gem de índice 2).
   * gems[0]=topo fica em y-2, gems[1]=meio em y-1, gems[2]=base em y.
   */
  absolutePositions() {
    return [
      { x: this.x, y: Math.floor(this.y) - 2 },  // topo (índice 0)
      { x: this.x, y: Math.floor(this.y) - 1 },  // meio (índice 1)
      { x: this.x, y: Math.floor(this.y) },      // base (índice 2)
    ];
  }

  /** Cópia. */
  clone() {
    return new FallingColumn(this.x, this.gems.slice(), this.y, this.id);
  }
}
