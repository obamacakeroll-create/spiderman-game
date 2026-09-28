import * as THREE from 'three';

// Axis-aligned box world with a spatial hash. Used for movement collision,
// wall running, and swing anchor searches.
const CELL = 40;
export class CollisionWorld {
  constructor() { this.boxes = []; this.grid = new Map(); this.stamp = 0; }
  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  add(minX, minY, minZ, maxX, maxY, maxZ, tag = 'building') {
    const b = { minX, minY, minZ, maxX, maxY, maxZ, tag, s: 0, id: this.boxes.length };
    this.boxes.push(b);
    for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++)
      for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
        const k = this.key(ix, iz);
        let c = this.grid.get(k); if (!c) this.grid.set(k, c = []);
        c.push(b);
      }
    return b;
  }
  query(x, z, r, out = []) {
    out.length = 0; const s = ++this.stamp;
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++)
      for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
        const c = this.grid.get(this.key(ix, iz)); if (!c) continue;
        for (const b of c) if (b.s !== s) { b.s = s; out.push(b); }
      }
    return out;
  }
  // Highest walkable surface under (x,z) at or below y.
  groundAt(x, z, y, r = 0.3) {
    let g = 0;
    for (const b of this.query(x, z, 2, this._q || (this._q = []))) {
      if (x >= b.minX - r && x <= b.maxX + r && z >= b.minZ - r && z <= b.maxZ + r && b.maxY <= y + 0.6 && b.maxY > g) g = b.maxY;
    }
    return g;
  }
  // Push a vertical capsule approximated as sphere stack out of boxes. Returns wall normal if touching a wall.
  resolve(pos, radius, height, outNormal) {
    let hitWall = false;
    const list = this.query(pos.x, pos.z, radius + 2, this._r || (this._r = []));
    for (const b of list) {
      if (pos.y + height < b.minY || pos.y > b.maxY - 0.05) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2); const push = radius - d;
          pos.x += dx / d * push; pos.z += dz / d * push;
          if (outNormal) outNormal.set(dx / d, 0, dz / d);
        } else {
          // inside: push out along the smallest axis
          const pens = [pos.x - b.minX, b.maxX - pos.x, pos.z - b.minZ, b.maxZ - pos.z];
          let m = 0; for (let i = 1; i < 4; i++) if (pens[i] < pens[m]) m = i;
          const n = [[-1, 0], [1, 0], [0, -1], [0, 1]][m];
          // If we're barely below the roof, pop on top instead
          if (b.maxY - pos.y < 1.2) { pos.y = b.maxY; continue; }
          pos.x += n[0] * (pens[m] + radius); pos.z += n[1] * (pens[m] + radius);
          if (outNormal) outNormal.set(n[0], 0, n[1]);
        }
        hitWall = true;
      }
    }
    return hitWall;
  }
  raycast(origin, dir, maxDist) {
    let best = null, bestT = maxDist;
    const steps = Math.ceil(maxDist / (CELL * 0.5));
    const seen = ++this.stamp; const tmp = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * maxDist;
      const x = origin.x + dir.x * t, z = origin.z + dir.z * t;
      const c = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (c) for (const b of c) if (b.s !== seen) { b.s = seen; tmp.push(b); }
    }
    for (const b of tmp) {
      let tmin = 0, tmax = bestT, nAxis = -1, nSign = 0;
      const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
      const mn = [b.minX, b.minY, b.minZ], mx = [b.maxX, b.maxY, b.maxZ];
      let ok = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-8) { if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; } continue; }
        let t1 = (mn[a] - o[a]) / d[a], t2 = (mx[a] - o[a]) / d[a], s = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; nAxis = a; nSign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
      if (ok && tmin < bestT && tmin > 0) {
        bestT = tmin;
        const n = new THREE.Vector3(); if (nAxis >= 0) n.setComponent(nAxis, nSign);
        best = { dist: tmin, box: b, normal: n };
      }
    }
    if (best) best.point = origin.clone().addScaledVector(dir, best.dist);
    return best;
  }
  // Find a swing anchor near a desired point: closest point on nearby box surfaces.
  findAnchor(from, desired, maxDist, minHeightAbove = 4) {
    let best = null, bestScore = Infinity;
    const p = new THREE.Vector3();
    for (const b of this.query(desired.x, desired.z, 45, this._a || (this._a = []))) {
      if (b.maxY < from.y + minHeightAbove) continue;
      p.set(Math.max(b.minX, Math.min(desired.x, b.maxX)), Math.max(b.minY, Math.min(desired.y, b.maxY)), Math.max(b.minZ, Math.min(desired.z, b.maxZ)));
      if (p.y < from.y + minHeightAbove) continue;
      const d = p.distanceTo(from); if (d > maxDist || d < 6) continue;
      const score = p.distanceTo(desired);
      if (score < bestScore) { bestScore = score; best = p.clone(); }
    }
    return best;
  }
}
