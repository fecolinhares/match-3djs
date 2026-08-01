// ============================================================
// Match-3D.js — Gem (estado puro de uma peça)
// Lógica pura — sem Three.js, sem DOM
// ============================================================

/**
 * Uma gem no tabuleiro. Armazena apenas estado: cor + posição.
 * O rendering (GemMesh) é responsabilidade da camada render/.
 */
export class Gem {
  /**
   * @param {number} colorIndex 0-5 cores normais, 6 = wild
   * @param {number} x coluna (0 = esquerda)
   * @param {number} y linha (0 = topo)
   * @param {number|null} id id estável opcional
   */
  constructor(colorIndex, x, y, id = null) {
    this.color = colorIndex;
    this.x = x;
    this.y = y;
    this.id = id;
    this.wild = colorIndex === 6;
  }

  /**
   * Cópia profunda com posição alterada.
   */
  withPosition(x, y) {
    return new Gem(this.color, x, y, this.id);
  }
}
