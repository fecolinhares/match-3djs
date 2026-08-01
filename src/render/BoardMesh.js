// ============================================================
// Match-3D.js — BoardMesh.js
// Contract: syncs with Board.getStateSnapshot(); provides
//   setGem(x, y, colorIndex) / clearGem(x, y)
//   highlightCell(x, y, on)
//   showFallingColumnPreview(x, colors) / setFallingPosition(x, y)
// Design: gems at (x * GAP, y * GAP) with the visible band centered
//   on the camera look-at; subtle grid surface (opacity 0.08);
//   ghost landing preview; elastic fall motion.
//
// Snapshot shape assumed (game layer): { grid: [y][x] → colorIndex|null,
//   falling: { x, y, gems: [bottom, mid, top] } }.
// ============================================================

import * as THREE from 'three';
import { BOARD, GEM_DEFS, RENDER } from '../config.js';
import * as GemMesh from './GemMesh.js';
import * as Particles from './Particles.js';

const { GAP, COLS, ROWS, VISIBLE_ROWS } = BOARD;

// Grid → world mapping. Logic y=0 is the TOP (spawn zone, off-screen);
// 3D y grows upward, so we flip and offset so the visible band
// (bottom VISIBLE_ROWS rows) centers on the camera look-at height.
const VISIBLE_START = ROWS - VISIBLE_ROWS; // 4
const VISIBLE_MID = VISIBLE_START + (VISIBLE_ROWS - 1) / 2; // 7.5
const Y_OFFSET = VISIBLE_MID * GAP + RENDER.CAMERA_LOOKAT[1]; // 6.9
const X_OFFSET = -((COLS - 1) / 2) * GAP;

function cellToWorld(x, y) {
  return new THREE.Vector3(X_OFFSET + x * GAP, -(y * GAP) + Y_OFFSET, 0);
}

/** Subtle grid-line surface: 1px-ish lines at 0.08 opacity. */
function makeGridTexture() {
  const size = 512;
  const step = size / COLS;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= COLS; i++) {
    ctx.moveTo(i * step + 0.5, 0);
    ctx.lineTo(i * step + 0.5, size);
    ctx.moveTo(0, i * step + 0.5);
    ctx.lineTo(size, i * step + 0.5);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);

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

    // dark backing well (gives transmissive gems something to refract)
    const backMat = new THREE.MeshBasicMaterial({
      color: 0x06060b,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(boardW + 0.9, boardH + 0.9), backMat);
    backing.position.z = -0.75;
    this._boardGroup.add(backing);

    // subtle grid lines
    const gridMat = new THREE.MeshBasicMaterial({
      map: makeGridTexture(),
      transparent: true,
      depthWrite: false,
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), gridMat);
    grid.position.z = -0.6;
    this._boardGroup.add(grid);

    scene.add(this._boardGroup);

    // --- column highlight ----------------------------------------------
    this._highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(GAP * 0.96, GAP * 0.96),
      new THREE.MeshBasicMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this._highlight.position.z = -0.05;
    this._highlight.visible = false;
    scene.add(this._highlight);

    // --- ghost landing preview ------------------------------------------
    this._ghostGroup = new THREE.Group();
    this._ghostGroup.visible = false;
    this._ghostGems = [];
    const ghostGeo = new THREE.OctahedronGeometry(0.4, 0);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(ghostGeo, null);
      this._ghostGems.push(m);
      this._ghostGroup.add(m);
    }
    scene.add(this._ghostGroup);
    this._previewColors = null;

    // --- falling column --------------------------------------------------
    this._fallingGroup = new THREE.Group();
    this._fallingGroup.visible = false;
    this._fallingGems = [];
    scene.add(this._fallingGroup);
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
      const gem = GemMesh.create(colors[i], rel);
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
    for (const gem of this._gems.values()) {
      gem.userData.tick(dt, time);
    }

    // shrinking-out gems
    for (let i = this._vanishing.length - 1; i >= 0; i--) {
      const gem = this._vanishing[i];
      const u = gem.userData;
      u.vanishT += dt / 0.16;
      const p = Math.min(1, u.vanishT);
      gem.scale.setScalar(Math.max(0.001, 1 - GemMesh.easeOutCubic(p)));
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
    }

    // highlight pulse
    if (this._highlight.visible) {
      this._highlight.material.opacity = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin(time * 5));
    }

    // ghost preview pulse
    if (this._ghostGroup.visible) {
      const p = 0.5 + 0.5 * Math.sin(time * 3.2);
      const s = 0.92 + 0.06 * p;
      for (const m of this._ghostGems) {
        m.scale.setScalar(s);
        m.material.opacity = 0.16 + 0.1 * p;
      }
    }
  }

  // ------------------------------------------------------------
  // internals
  // ------------------------------------------------------------
  _updateGhosts() {
    if (!this._previewColors) {
      this._ghostGroup.visible = false;
      return;
    }
    const x = this._previewX;
    const row0 = this._landingRow(x);
    if (row0 < 0 || row0 + 2 >= ROWS) {
      this._ghostGroup.visible = false;
      return;
    }
    this._ghostGroup.visible = true;
    for (let i = 0; i < 3; i++) {
      const m = this._ghostGems[i];
      if (!m.material || m.material.userData.colorIndex !== this._previewColors[i]) {
        const def = GEM_DEFS[this._previewColors[i]] ?? GEM_DEFS[GEM_DEFS.length - 1];
        const ghostMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(def[1]),
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        ghostMat.userData.colorIndex = this._previewColors[i];
        m.material = ghostMat;
      }
      const p = cellToWorld(x, row0 + i);
      m.position.set(p.x, p.y, p.z + 0.02);
    }
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
