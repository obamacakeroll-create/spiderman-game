import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function vc(g, c) { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }

// Instanced pedestrians walking block perimeters; they flee from fights and cheer for heroes.
export class Crowd {
  constructor(scene, blocks) {
    const skin = [0x8d5a3c, 0xc79a78, 0x5a3a28, 0xe0b898];
    const geos = skin.map(sk => mergeGeometries([
      vc(new THREE.CapsuleGeometry(0.22, 0.75, 4, 10).translate(0, 1.05, 0), 0xffffff),
      vc(new THREE.CapsuleGeometry(0.1, 0.7, 4, 6).translate(0.1, 0.45, 0), 0x333a44),
      vc(new THREE.CapsuleGeometry(0.1, 0.7, 4, 6).translate(-0.1, 0.45, 0), 0x333a44),
      vc(new THREE.SphereGeometry(0.13, 12, 10).translate(0, 1.72, 0), sk)]));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const city = blocks.filter(b => b.type !== 'park');
    const per = 150;
    this.meshes = geos.map(g => { const m = new THREE.InstancedMesh(g, mat, per); m.castShadow = true; scene.add(m); return m; });
    this.peds = [];
    const c = new THREE.Color();
    for (let k = 0; k < geos.length; k++) for (let i = 0; i < per; i++) {
      const b = city[(Math.random() * city.length) | 0];
      this.peds.push({ mesh: k, idx: i, b, t: Math.random(), sp: (0.9 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1), phase: Math.random() * 10, x: 0, z: 0, flee: 0, cheer: 0, fx: 0, fz: 0 });
      this.meshes[k].setColorAt(i, c.setHSL(Math.random(), 0.3 + Math.random() * 0.4, 0.2 + Math.random() * 0.4));
    }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
  }
  perim(b, t, out) {
    const w = b.maxX - b.minX - 2, d = b.maxZ - b.minZ - 2, L = 2 * (w + d);
    let u = ((t % 1) + 1) % 1 * L;
    const x0 = b.minX + 1, z0 = b.minZ + 1;
    if (u < w) return out.set(x0 + u, z0); u -= w;
    if (u < d) return out.set(x0 + w, z0 + u); u -= d;
    if (u < w) return out.set(x0 + w - u, z0 + d); u -= w;
    return out.set(x0, z0 + d - u);
  }
  update(dt, heroPos, dangerPts, heroGrounded) {
    const v2 = new THREE.Vector2(), { m, q, p, s } = this;
    let cheerCount = 0;
    for (const ped of this.peds) {
      const dxh = ped.x - heroPos.x, dzh = ped.z - heroPos.z; const dh2 = dxh * dxh + dzh * dzh;
      if (dh2 > 250 * 250 && ped.init) continue;
      ped.init = true;
      let danger = null;
      for (const d of dangerPts) { const dx = ped.x - d.x, dz = ped.z - d.z; if (dx * dx + dz * dz < 600) { danger = d; break; } }
      if (danger) { ped.flee = 4; ped.fx = ped.x - danger.x; ped.fz = ped.z - danger.z; const l = Math.hypot(ped.fx, ped.fz) || 1; ped.fx /= l; ped.fz /= l; }
      let yaw, moving = true, speedMul = 1;
      if (ped.flee > 0) {
        ped.flee -= dt; ped.x += ped.fx * 6 * dt; ped.z += ped.fz * 6 * dt; yaw = Math.atan2(ped.fx, ped.fz); speedMul = 3;
        if (ped.flee <= 0) { const b = ped.b; ped.x = Math.min(Math.max(ped.x, b.minX + 1), b.maxX - 1); ped.z = Math.min(Math.max(ped.z, b.minZ + 1), b.maxZ - 1); }
      } else if (heroGrounded && dh2 < 150 && dangerPts.length === 0) {
        yaw = Math.atan2(-dxh, -dzh); moving = false; ped.cheer = 1; cheerCount++;
      } else {
        const b = ped.b; const L = 2 * (b.maxX - b.minX + b.maxZ - b.minZ);
        ped.t += ped.sp * 1.3 * dt / L;
        this.perim(b, ped.t, v2);
        const nx = v2.x, nz = v2.y;
        yaw = Math.atan2(nx - ped.x, nz - ped.z);
        if (Math.hypot(nx - ped.x, nz - ped.z) > 5) { ped.x = nx; ped.z = nz; } else { ped.x = nx; ped.z = nz; }
      }
      ped.phase += dt * 8 * speedMul;
      const bob = moving ? Math.abs(Math.sin(ped.phase)) * 0.06 : ped.cheer ? Math.abs(Math.sin(ped.phase * 1.5)) * 0.25 : 0;
      p.set(ped.x, 0.25 + bob, ped.z); q.setFromAxisAngle(UP, yaw || 0);
      m.compose(p, q, s); this.meshes[ped.mesh].setMatrixAt(ped.idx, m);
    }
    for (const mm of this.meshes) mm.instanceMatrix.needsUpdate = true;
    return cheerCount;
  }
}
const UP = new THREE.Vector3(0, 1, 0);
