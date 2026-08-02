// ============================================================
// Match-3D.js — BoardMesh.js
// Contract: syncs with Board.getStateSnapshot(); provides
//   setGem(x, y, colorIndex) / clearGem(x, y)
//   highlightCell(x, y, on)
//   showFallingColumnPreview(x, colors) / setFallingPosition(x, y)
// Design: gems at (x * GAP, y * GAP) with the visible band centered
//   on the camera look-at; CARTOON ARCADE board (Columns classic) —
//   interior quase-preto navy com grid gray-blue fina, células com
//   checkerboard escuro, frame em camadas (dark outline externo →
//   pale gold/cream inner rim → brown/gold structural border com
//   stone speckle), backdrop quente âmbar, column highlight beam,
//   strong ghost landing preview, bold falling gems (scale boost +
//   glow boost + trail). Elastic fall motion.
//
// Snapshot shape assumed (game layer): { grid: [y][x] → colorIndex|null,
//   falling: { x, y, gems: [bottom, mid, top] } }.
// ============================================================

import * as THREE from 'three';
import { BOARD, GEM_DEFS, RENDER } from '../config.js';
import * as GemMesh from './GemMesh.js';
import * as Particles from './Particles.js';
import {
  makeGlowTexture,
  makeBeamTexture,
  makeBackdropTexture,
} from './Materials.js';

const { GAP, COLS, ROWS, VISIBLE_ROWS } = BOARD;

// Falling gems são ~22% maiores que as assentadas para leitura à distância.
const FALLING_SCALE = 1.22;

// Grid → world mapping. Logic y=0 is the TOP (spawn zone, off-screen);
// 3D y grows upward, so we flip and offset so the visible band
// (bottom VISIBLE_ROWS rows) centers on the camera look-at height.
// Auto-derived from BOARD: VISIBLE_START = ROWS - VISIBLE_ROWS.
const VISIBLE_START = ROWS - VISIBLE_ROWS; // 4
const VISIBLE_MID = VISIBLE_START + (VISIBLE_ROWS - 1) / 2; // 9.5
const Y_OFFSET = VISIBLE_MID * GAP + RENDER.CAMERA_LOOKAT[1]; // 9.14
const X_OFFSET = -((COLS - 1) / 2) * GAP;

function cellToWorld(x, y) {
  return new THREE.Vector3(X_OFFSET + x * GAP, -(y * GAP) + Y_OFFSET, 0);
}

/** Canvas 2D rounded-rect path helper. */
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/**
 * Cartoon-arcade board surface texture (Columns classic):
 *  - interior quase-preto navy (#0A0E1A), fills FLAT cartoon (não neon)
 *  - checkerboard sutil e MAIS ESCURO (duas tonalidades de navy)
 *  - bevel hard: highlight 1-2px no topo + sombra na base (cartoon)
 *  - grid lines gray-blue FINAS entre as células
 *  - sem borda neon — a moldura em camadas (makeCartoonFrameTexture)
 *    cuida do contorno externo
 */
function makeGridTexture() {
  const size = 1024;
  const stepX = size / COLS;
  const stepY = size / VISIBLE_ROWS;
  const cellInset = 4; // px — separa as células (inset look)
  const radius = 10;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // --- cell fills: navy escuro, checker sutil, flat cartoon ----------
  for (let row = 0; row < VISIBLE_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * stepX + cellInset;
      const y = row * stepY + cellInset;
      const w = stepX - cellInset * 2;
      const h = stepY - cellInset * 2;

      // Cartoon arcade: quase-preto navy, só duas tonalidades (checker).
      // Luz de cima: topo levemente mais claro, base mais escura (sutil).
      const checker = (row + col) % 2 === 0;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      if (checker) {
        g.addColorStop(0.0, '#121830');
        g.addColorStop(1.0, '#0E1426');
      } else {
        g.addColorStop(0.0, '#0A0E1A');
        g.addColorStop(1.0, '#080B15');
      }
      roundRectPath(ctx, x, y, w, h, radius);
      ctx.fillStyle = g;
      ctx.fill();

      // bevel cartoon hard: highlight no topo + sombra na base
      ctx.save();
      roundRectPath(ctx, x, y, w, h, radius);
      ctx.clip();
      ctx.fillStyle = 'rgba(150,175,230,0.10)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.40)';
      ctx.fillRect(x, y + h - 2.5, w, 2.5);
      ctx.restore();
    }
  }

  // --- grid lines gray-blue FINAS (visíveis mas discretas) -----------
  ctx.strokeStyle = 'rgba(148,170,210,0.20)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= COLS; i++) {
    const x = i * stepX + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
  }
  for (let i = 0; i <= VISIBLE_ROWS; i++) {
    const y = i * stepY + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Rounded-rect THREE.Shape centered at origin (for the dark outline plate).
 */
function roundedRectShape(width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * Cartoon frame EM CAMADAS (Columns classic): dark outline externo →
 * pale gold/cream inner rim → thicker brown/gold structural border com
 * stone speckle + bevel chunky (highlight topo / sombra base).
 * Center hole transparent — o grid aparece por dentro. O canvas é
 * aspect-matched ao plano da moldura para a banda ter espessura
 * uniforme em unidades de mundo (banda ~0.62 world de cada lado).
 */
function makeCartoonFrameTexture() {
  const BAND = 0.62; // world units per side
  const boardW = COLS * GAP;
  const boardH = VISIBLE_ROWS * GAP;
  const cw = 1024;
  const ch = Math.max(2, Math.round(cw * (boardH + BAND * 2) / (boardW + BAND * 2)));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // px por unidade de mundo é uniforme nos dois eixos (canvas aspect-matched)
  const bandPx = BAND / (boardW + BAND * 2) * cw; // ≈62
  const rOut = bandPx * 1.1;
  const rIn = Math.max(4, rOut - bandPx * 0.72);

  const outerPath = () => roundRectPath(ctx, 0, 0, cw, ch, rOut);
  const holePath = () => roundRectPath(ctx, bandPx, bandPx, cw - bandPx * 2, ch - bandPx * 2, rIn);

  // 1) banda base: stone gradient (brown → gold), cartoon flat
  const stone = ctx.createLinearGradient(0, 0, 0, ch);
  stone.addColorStop(0.0, '#8A6234');
  stone.addColorStop(0.5, '#6E4A28');
  stone.addColorStop(1.0, '#543619');
  outerPath();
  ctx.fillStyle = stone;
  ctx.fill();

  // 2) speckle "stone look" (tan/gold/ochre/brown dots, deterministic)
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const speckle = ['#C9A05A', '#D9B36C', '#8A5A28', '#4A3018', '#B98F4E', '#7A5530'];
  for (let i = 0; i < 900; i++) {
    const px = rnd() * cw;
    const py = rnd() * ch;
    // pula o centro (o hole será perfurado depois, mas economiza desenho)
    if (px > bandPx && px < cw - bandPx && py > bandPx && py < ch - bandPx) continue;
    ctx.globalAlpha = 0.14 + rnd() * 0.22;
    ctx.fillStyle = speckle[Math.floor(rnd() * speckle.length)];
    const rad = 0.8 + rnd() * 2.4;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 3) perfura o hole central (o grid aparece por dentro)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  holePath();
  ctx.fill();
  ctx.restore();

  // 4) bevel chunky: highlight gold no topo, sombra escura na base
  ctx.save();
  outerPath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(233,196,120,0.55)';
  ctx.lineWidth = bandPx * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, bandPx * 0.25);
  ctx.lineTo(cw, bandPx * 0.25);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(26,15,6,0.55)';
  ctx.lineWidth = bandPx * 0.55;
  ctx.beginPath();
  ctx.moveTo(0, ch - bandPx * 0.28);
  ctx.lineTo(cw, ch - bandPx * 0.28);
  ctx.stroke();
  ctx.restore();

  // 5) dark outline externo (quase-preto marrom)
  ctx.strokeStyle = '#1B1108';
  ctx.lineWidth = bandPx * 0.28;
  outerPath();
  ctx.stroke();

  // 6) pale gold/cream inner rim (contorno creme junto ao poço)
  ctx.strokeStyle = '#F0E6C8';
  ctx.lineWidth = bandPx * 0.20;
  holePath();
  ctx.stroke();

  // 7) rivets dourados nos cantos (arcade charm)
  const rivet = (cx, cy) => {
    ctx.fillStyle = '#E8C878';
    ctx.beginPath();
    ctx.arc(cx, cy, bandPx * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,38,12,0.85)';
    ctx.beginPath();
    ctx.arc(cx + bandPx * 0.03, cy + bandPx * 0.03, bandPx * 0.05, 0, Math.PI * 2);
    ctx.fill();
  };
  const mid = bandPx * 0.62;
  rivet(mid, mid);
  rivet(cw - mid, mid);
  rivet(mid, ch - mid);
  rivet(cw - mid, ch - mid);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class BoardMesh {
  constructor(scene) {
    this.scene = scene;
    this._gems = new Map(); // "x,y" → gem group
    this._vanishing = []; // groups shrinking out
    this._gemGroup = new THREE.Group();
    scene.add(this._gemGroup);

    // --- board surface -------------------------------------------------
    const boardW = COLS * GAP;
    const boardH = VISIBLE_ROWS * GAP;
    this._boardGroup = new THREE.Group();
    this._boardGroup.position.set(0, RENDER.CAMERA_LOOKAT[1], 0); // visible band center

    // halo quente atrás do tabuleiro (backdrop glow âmbar/gold — arcade,
    // não neon violeta). Com a placa escura opaca na frente, vira um anel
    // de luz quente contornando o board — Columns vibe.
    const backdropMat = new THREE.MeshBasicMaterial({
      map: makeBackdropTexture(),
      color: 0xb9893f, // âmbar dourado quente, cartoon arcade
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(boardW * 1.5, boardH * 1.5), backdropMat);
    backdrop.position.z = -0.95;
    this._boardGroup.add(backdrop);

    // dark backing well (dá às gems transmissivas algo para refratar) —
    // navy quase-preto, consistente com o interior
    const backMat = new THREE.MeshBasicMaterial({
      color: 0x0a0e1a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(boardW + 0.9, boardH + 0.9), backMat);
    backing.position.z = -0.75;
    this._boardGroup.add(backing);

    // camada 1 do frame cartoon: dark outline EXTERNO — placa escura
    // arredondada maior que tudo, aparece como contorno quase-preto
    // ao redor da moldura (stone look)
    const plateMat = new THREE.MeshBasicMaterial({ color: 0x1a120b });
    const plate = new THREE.Mesh(
      new THREE.ShapeGeometry(roundedRectShape(boardW + 1.5, boardH + 1.5, 0.5)),
      plateMat
    );
    plate.position.z = -0.63;
    this._boardGroup.add(plate);

    // grid cartoon (cell fills navy escuro + checker + grid lines gray-blue)
    const gridMat = new THREE.MeshBasicMaterial({
      map: makeGridTexture(),
      transparent: true,
      depthWrite: false,
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), gridMat);
    grid.position.z = -0.6;
    this._boardGroup.add(grid);

    // moldura cartoon EM CAMADAS (camadas 2+3: pale gold/cream inner rim
    // + thicker brown/gold structural border com stone speckle)
    const frameMat = new THREE.MeshBasicMaterial({
      map: makeCartoonFrameTexture(),
      transparent: true,
      depthWrite: false,
    });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(boardW + 1.24, boardH + 1.24), frameMat);
    frame.position.z = -0.55;
    this._boardGroup.add(frame);

    scene.add(this._boardGroup);

    // --- cell highlight (hover) — branco azulado suave, não cyan neon ---
    this._highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(GAP * 0.98, GAP * 0.98),
      new THREE.MeshBasicMaterial({
        color: 0x9fb8e8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this._highlight.position.z = -0.05;
    this._highlight.visible = false;
    scene.add(this._highlight);

    // --- column highlight beam (coluna ativa) — violeta suave, não cyan ---
    const beamMat = new THREE.MeshBasicMaterial({
      map: makeBeamTexture(),
      color: 0x8a7cff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this._beam = new THREE.Mesh(new THREE.PlaneGeometry(GAP * 0.95, boardH * 1.12), beamMat);
    this._beam.position.z = -0.45;
    this._beam.visible = false;
    scene.add(this._beam);

    // --- ghost landing preview ------------------------------------------
    this._ghostGroup = new THREE.Group();
    this._ghostGroup.visible = false;
    this._ghostGems = [];
    const ghostGeo = new THREE.OctahedronGeometry(0.42, 0);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(ghostGeo, null);
      this._ghostGems.push(m);
      this._ghostGroup.add(m);
    }
    scene.add(this._ghostGroup);
    // linha de pouso — marca a linha onde a coluna vai assentar
    this._ghostLine = new THREE.Mesh(
      new THREE.PlaneGeometry(GAP * 1.08, 0.05),
      new THREE.MeshBasicMaterial({
        color: 0x9fb8e8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this._ghostLine.position.z = 0.0;
    this._ghostLine.visible = false;
    scene.add(this._ghostLine);
    this._previewColors = null;

    // --- falling column --------------------------------------------------
    this._fallingGroup = new THREE.Group();
    this._fallingGroup.visible = false;
    this._fallingGems = [];
    scene.add(this._fallingGroup);

    // glow grande atrás da coluna (leitura à distância, fora do viewport)
    this._fallingGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0x9fe8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this._fallingGlow.scale.setScalar(6.2);
    this._fallingGlow.position.set(0, GAP, -0.7);
    this._fallingGroup.add(this._fallingGlow);

    // trail vertical (streak de luz) atrás da coluna
    this._fallingTrail = new THREE.Mesh(
      new THREE.PlaneGeometry(GAP * 0.7, GAP * 5.2),
      new THREE.MeshBasicMaterial({
        map: makeBeamTexture(),
        color: 0x8a7cff, // violeta suave, consistente com o beam
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this._fallingTrail.position.set(0, GAP * 1.6, -0.85);
    this._fallingGroup.add(this._fallingTrail);

    this._fallingColors = null;
    this._fallingX = 0;
    this._fallingRot = 0;
    this._fallingRotTarget = 0;
  }

  // ------------------------------------------------------------
  // sync(snapshot) — reconcile against Board.getStateSnapshot()
  // ------------------------------------------------------------
  sync(snapshot) {
    if (!snapshot || !snapshot.grid) return;
    const grid = snapshot.grid;

    // Build the desired cell → color map.
    const desired = new Map();
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = 0; x < Math.min(row.length, COLS); x++) {
        const c = row[x];
        if (c === null || c === undefined) continue;
        desired.set(`${x},${y}`, c);
      }
    }

    // Split existing gems into "kept" and "orphans" (reusable movers).
    // Orphans are unregistered immediately so no stale keys survive.
    const orphans = []; // [oldKey, gem]
    for (const [key, gem] of this._gems) {
      const want = desired.get(key);
      if (want !== undefined && want === gem.userData.colorIndex) {
        desired.delete(key); // stays put
      } else {
        orphans.push([key, gem]);
        this._gems.delete(key);
      }
    }

    // Assign remaining desired cells: reuse orphans (fall), else create.
    for (const [key, colorIndex] of desired) {
      const [x, y] = key.split(',').map(Number);
      const pos = cellToWorld(x, y);
      const idx = orphans.findIndex(([, g]) => g.userData.colorIndex === colorIndex);
      if (idx !== -1) {
        const [, gem] = orphans.splice(idx, 1)[0];
        GemMesh.setTarget(gem, pos, 'fall');
        this._gems.set(key, gem);
      } else {
        const gem = GemMesh.create(colorIndex, pos);
        GemMesh.snapTo(gem, pos);
        GemMesh.popIn(gem);
        this._gemGroup.add(gem);
        this._gems.set(key, gem);
      }
    }

    // Leftover orphans: nothing wants them — shrink out.
    for (const [, gem] of orphans) this._removeGem(gem);

    // Falling column from snapshot (defensive; game may drive it directly).
    if (snapshot.falling && snapshot.falling.gems && snapshot.falling.gems.length === 3) {
      const f = snapshot.falling;
      this.showFallingColumnPreview(f.x, f.gems);
      this.setFallingColumn(f.gems);
      this.setFallingPosition(f.x, f.y);
    }
  }

  // ------------------------------------------------------------
  // setGem / clearGem
  // ------------------------------------------------------------
  setGem(x, y, colorIndex) {
    const key = `${x},${y}`;
    const pos = cellToWorld(x, y);
    const existing = this._gems.get(key);
    if (existing) {
      if (existing.userData.colorIndex === colorIndex) {
        GemMesh.popIn(existing); // refresh pop (e.g. re-land)
        return existing;
      }
      this._removeGem(existing);
    }
    const gem = GemMesh.create(colorIndex, pos);
    GemMesh.snapTo(gem, pos);
    GemMesh.popIn(gem);
    this._gemGroup.add(gem);
    this._gems.set(key, gem);
    return gem;
  }

  clearGem(x, y) {
    const gem = this._gems.get(`${x},${y}`);
    if (gem) this._removeGem(gem);
  }

  _removeGem(gem) {
    // drop from the map (any key), then shrink-out animation
    for (const [key, g] of this._gems) {
      if (g === gem) this._gems.delete(key);
    }
    const u = gem.userData;
    u.vanishing = true;
    u.vanishT = 0;
    this._vanishing.push(gem);
  }

  // ------------------------------------------------------------
  // highlightCell(x, y, on)
  // ------------------------------------------------------------
  highlightCell(x, y, on) {
    this._highlight.visible = Boolean(on);
    if (on) {
      const p = cellToWorld(x, y);
      this._highlight.position.set(p.x, p.y, -0.05);
    }
  }

  // ------------------------------------------------------------
  // Falling column — ghost preview + real gems
  // ------------------------------------------------------------
  showFallingColumnPreview(x, colors) {
    this._previewColors = colors ? [...colors] : null;
    this._previewX = x;
    this._updateGhosts();
    // beam acompanha a coluna mesmo na fase de preview
    this._beam.visible = Boolean(this._previewColors);
    if (this._beam.visible) {
      const p = cellToWorld(x, VISIBLE_MID);
      this._beam.position.set(p.x, RENDER.CAMERA_LOOKAT[1], -0.45);
    }
  }

  /** Provide the falling column's gem colors (creates real gems). */
  setFallingColumn(colors) {
    if (!colors || colors.length !== 3) return;
    const same =
      this._fallingColors &&
      colors.every((c, i) => c === this._fallingColors[i]);
    if (same) return;
    this._fallingColors = [...colors];
    // rebuild gems
    for (const g of this._fallingGems) {
      this._fallingGroup.remove(g);
      GemMesh.dispose(g);
    }
    this._fallingGems = [];
    for (let i = 0; i < 3; i++) {
      const rel = new THREE.Vector3(0, i * GAP, 0);
      const gem = GemMesh.create(colors[i], rel, { scale: FALLING_SCALE, glowBoost: true });
      GemMesh.snapTo(gem, rel);
      this._fallingGems.push(gem);
      this._fallingGroup.add(gem);
    }
    this._fallingGroup.visible = true;
  }

  /** Move the falling column so its bottom gem is at grid row y. */
  setFallingPosition(x, y) {
    this._fallingX = x;
    if (!this._fallingColors) return;
    if (this._fallingGems.length === 0) this.setFallingColumn(this._fallingColors);
    const p = cellToWorld(x, y);
    this._fallingGroup.position.set(p.x, p.y, p.z);
    this._fallingGroup.visible = true;
    // beam centralizado na coluna ativa
    this._beam.visible = true;
    this._beam.position.set(p.x, RENDER.CAMERA_LOOKAT[1], -0.45);
  }

  /** Rotate the falling column (radians) — eased in update(). */
  setFallingRotation(angleY) {
    this._fallingRotTarget = angleY;
  }

  /** Hide + clear the falling column (called after it lands). */
  clearFalling() {
    this._fallingGroup.visible = false;
    this._fallingColors = null;
    this._fallingRot = 0;
    this._fallingRotTarget = 0;
    this._beam.visible = false;
    this._beam.material.opacity = 0;
    this._fallingGlow.material.opacity = 0;
    this._fallingTrail.material.opacity = 0;
    // ghost preview morre junto (coluna pousou — não faz sentido manter)
    this._previewColors = null;
    this._ghostGroup.visible = false;
    this._ghostLine.visible = false;
    for (const g of this._fallingGems) {
      g.rotation.y = 0;
      g.position.x = 0;
    }
  }

  // ------------------------------------------------------------
  // Match flash + explode
  // ------------------------------------------------------------
  flashMatch(cells, onComplete) {
    const gems = cells
      .map(({ x, y }) => this._gems.get(`${x},${y}`))
      .filter(Boolean);
    if (gems.length === 0) {
      if (onComplete) onComplete();
      return;
    }
    let remaining = gems.length;
    for (const gem of gems) {
      GemMesh.setFlash(gem, () => {
        const u = gem.userData;
        Particles.explode(new THREE.Vector3(u.base.x, u.base.y, 0), u.colorIndex);
        this._removeGem(gem);
        remaining -= 1;
        if (remaining <= 0 && onComplete) onComplete();
      });
    }
  }

  // ------------------------------------------------------------
  // update(dt, time) — drive all gem animations
  // ------------------------------------------------------------
  update(dt, time) {
    const reduced = GemMesh.isReducedMotion();

    for (const gem of this._gems.values()) {
      gem.userData.tick(dt, time);
    }

    // shrinking-out gems
    for (let i = this._vanishing.length - 1; i >= 0; i--) {
      const gem = this._vanishing[i];
      const u = gem.userData;
      u.vanishT += dt / 0.16;
      const p = Math.min(1, u.vanishT);
      gem.scale.setScalar(Math.max(0.001, (1 - GemMesh.easeOutCubic(p)) * u.scaleBoost));
      if (p >= 1) {
        this._gemGroup.remove(gem);
        GemMesh.dispose(gem);
        this._vanishing.splice(i, 1);
      }
    }

    // falling column: roll — spin each stone + barrel sway (0.12s ease-out)
    if (this._fallingGroup.visible) {
      const diff = this._fallingRotTarget - this._fallingRot;
      this._fallingRot += diff * Math.min(1, dt * 10);
      const sway = Math.sin(this._fallingRot) * 0.12;
      for (let i = 0; i < this._fallingGems.length; i++) {
        const g = this._fallingGems[i];
        g.position.x = sway * (i === 1 ? 0.4 : 1);
        g.rotation.y = this._fallingRot * (i % 2 === 0 ? 1 : -0.7);
      }
      // glow + trail pulsando — a coluna caindo NUNCA some no fundo
      const pulse = 0.5 + 0.5 * Math.sin(time * 7);
      const amp = reduced ? 0 : pulse;
      this._fallingGlow.material.opacity = 0.5 + 0.28 * amp;
      this._fallingTrail.material.opacity = 0.4 + 0.22 * amp;
      this._fallingGlow.scale.setScalar(6.2 + 0.6 * amp);
    }

    // column highlight beam pulse
    if (this._beam.visible) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      this._beam.material.opacity = (reduced ? 0.3 : 0.22 + 0.18 * pulse);
    }

    // cell highlight pulse
    if (this._highlight.visible) {
      this._highlight.material.opacity = (reduced ? 0.3 : 0.3 + 0.15 * (0.5 + 0.5 * Math.sin(time * 5)));
    }

    // ghost preview pulse (strong hologram)
    if (this._ghostGroup.visible) {
      const p = 0.5 + 0.5 * Math.sin(time * 3.2);
      const s = 0.96 + (reduced ? 0 : 0.1 * p);
      for (const m of this._ghostGems) {
        m.scale.setScalar(s);
        m.material.opacity = (reduced ? 0.45 : 0.4 + 0.25 * p);
      }
      this._ghostLine.material.opacity = (reduced ? 0.4 : 0.4 + 0.3 * p);
      this._ghostLine.scale.setScalar(1 + (reduced ? 0 : 0.12 * p));
    }
  }

  // ------------------------------------------------------------
  // internals
  // ------------------------------------------------------------
  _updateGhosts() {
    if (!this._previewColors) {
      this._ghostGroup.visible = false;
      this._ghostLine.visible = false;
      return;
    }
    const x = this._previewX;
    const row0 = this._landingRow(x);
    // row0 é a BASE da coluna; gems em row0-2..row0. Inválido se a base
    // sobe além do topo (row0-2 < 0) ou está fora do board (row0 >= ROWS).
    if (row0 < 0 || row0 - 2 < 0 || row0 >= ROWS) {
      this._ghostGroup.visible = false;
      this._ghostLine.visible = false;
      return;
    }
    this._ghostGroup.visible = true;
    for (let i = 0; i < 3; i++) {
      const m = this._ghostGems[i];
      if (!m.material || m.material.userData.colorIndex !== this._previewColors[i]) {
        const def = GEM_DEFS[this._previewColors[i]] ?? GEM_DEFS[GEM_DEFS.length - 1];
        // Ghost com NormalBlending (fantasma translúcido SÓLIDO), não additive:
        // additive (como o beam) faz o ghost sumir na luz. NormalBlending +
        // opacidade média = silhueta visível que não compete com o beam.
        const ghostMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(def[1]), // cor base
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.NormalBlending,
        });
        ghostMat.userData.colorIndex = this._previewColors[i];
        m.material = ghostMat;
      }
      const p = cellToWorld(x, row0 - i); // base row0, gems sobem (i=0 base)
      m.position.set(p.x, p.y, p.z + 0.02);
    }
    // linha de pouso na linha do ghost (base da coluna)
    const land = cellToWorld(x, row0);
    this._ghostLine.position.set(land.x, land.y - GAP / 2 + 0.02, 0.0);
    this._ghostLine.visible = true;
  }

  _landingRow(x) {
    let topFilled = -1;
    for (let y = 0; y < ROWS; y++) {
      if (this._gems.has(`${x},${y}`)) {
        topFilled = y;
        break;
      }
    }
    if (topFilled === -1) return ROWS - 1; // empty column → floor
    return topFilled - 1;
  }
}
