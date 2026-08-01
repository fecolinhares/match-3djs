// ============================================================
// Match-3D.js — MatchDetector (detecção de matches 3+)
// Lógica pura — sem Three.js, sem DOM
// ============================================================

import { BOARD } from '../config.js';

const DX = [1, 0, 1, 1];   // horizontal, vertical, diagonal \, diagonal /
const DY = [0, 1, 1, -1];

/**
 * Detecta grupos de 3+ gems da mesma cor em linha reta:
 * horizontal, vertical e as DUAS diagonais.
 *
 * `grid` é uma matriz [y][x] de índices de cor (inteiro) ou null.
 */
export class MatchDetector {
  /**
   * @param {number} cols
   * @param {number} rows
   */
  constructor(cols = BOARD.COLS, rows = BOARD.ROWS) {
    this.cols = cols;
    this.rows = rows;
  }

  /**
   * Encontra todas as sequências de 3+ na mesma linha reta.
   * Retorna array de objetos: { cells: [{x,y}], color }
   */
  findMatches(grid) {
    const matches = [];
    const visited = new Set();

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const color = grid[y]?.[x];
        if (color === null || color === undefined) continue;

        for (let d = 0; d < 4; d++) {
          const dx = DX[d];
          const dy = DY[d];

          // Conta quantas gems iguais nesta direção
          const chain = [{ x, y }];
          let cx = x + dx;
          let cy = y + dy;
          while (
            cx >= 0 && cx < this.cols &&
            cy >= 0 && cy < this.rows &&
            grid[cy]?.[cx] === color
          ) {
            chain.push({ x: cx, y: cy });
            cx += dx;
            cy += dy;
          }

          if (chain.length >= 3) {
            // Normaliza a chave da sequência (ordena por x,y) p/ dedupe
            const key = chain
              .slice()
              .sort((a, b) => (a.x - b.x) || (a.y - b.y))
              .map((c) => `${c.x},${c.y}`)
              .join('|');

            if (!visited.has(key)) {
              visited.add(key);
              matches.push({ cells: chain, color });
            }
          }
        }
      }
    }

    return matches;
  }

  /**
   * True se a coluna puder ficar nesta posição.
   * Posições acima do topo (y<0) são zona de spawn livre; o bloqueio
   * é por overlap com gems dentro do grid ou sair abaixo do fundo.
   */
  canPlace(grid, column) {
    const positions = column.absolutePositions();
    for (const p of positions) {
      if (p.x < 0 || p.x >= this.cols) return false;
      if (p.y >= this.rows) return false;          // abaixo do fundo
      if (p.y >= 0 && grid[p.y]?.[p.x] !== null && grid[p.y]?.[p.x] !== undefined) return false; // overlap
    }
    return true;
  }

  /**
   * True se alguma gem da coluna cruza o topo (y < 0) = game over
   * quando uma nova coluna não pode ser colocada.
   */
  isOutOfBounds(grid, column) {
    const positions = column.absolutePositions();
    for (const p of positions) {
      if (p.y < 0 || p.y >= this.rows) return true;
    }
    return false;
  }
}
