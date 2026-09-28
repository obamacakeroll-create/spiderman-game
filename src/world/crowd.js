import * as THREE from 'three';
import { Rig, Poses } from '../actors/rig.js';

const FR = 8; // 6 walk frames + idle + cheer
const OUTFITS = [
  { j: 0x2b3a55, p: 0x1c1f26, s: 0x8d5a3c }, { j: 0x7a2a2a, p: 0x2a2a30, s: 0xc79a78 }, { j: 0xd8d2c4, p: 0x3a4a6a, s: 0x5a3a28 },
  { j: 0x3d5a3a, p: 0x2b2620, s: 0xe0b898 }, { j: 0x151515, p: 0x151515, s: 0xa87858 }, { j: 0xb58a3a, p: 0x2c3440, s: 0x6a4630 },
  { j: 0x6a4a8a, p: 0x202028, s: 0xd8a888 }, { j: 0x8a8f96, p: 0x3a2a20, s: 0x4a3020 },
];

function bake(rig, pose) {
  rig.pose(pose, 1, 1e4);
  rig.root.updateMatrixWorld(true);
  const src = rig.mesh.geometry, n = src.attributes.position.count;
  const pos = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { rig.mesh.getVertexPosition(i, v); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', src.attributes.color);
  g.setIndex(src.index); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

// Instanced pedestrians walking block perimeters; they flee from fights and cheer for heroes.
export class Crowd {
  constructor(scene, blocks) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
    const city = blocks.filter(b => b.type !== 'park');
    const per = 90;
    this.variants = OUTFITS.map((o, vi) => {
      const female = vi % 2 === 1;
      const rig = new Rig({ bulk: female ? 0.86 : 1.0, muscle: 0.82, waist: female ? 0.95 : 1.08, step: 0.026, key: female ? 'civF-lo' : 'civM-lo' });
      rig.dress(null, { colors: { jacket: o.j, pants: o.p, skin: o.s, accent: o.j } });
      const frames = [];
      for (let f = 0; f < 6; f++) frames.push(bake(rig, Poses.run(f / 6 * Math.PI * 2, 0.3)));
      frames.push(bake(rig, Poses.idle(0)));
      frames.push(bake(rig, Poses.cheer(0.2)));
      const meshes = frames.map(g => { const m = new THREE.InstancedMesh(g, mat, per); m.count = 0; m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; });
      rig.mesh.geometry.dispose?.();
      return { meshes };
    });
    this.peds = [];
    for (let v = 0; v < OUTFITS.length; v++) for (let i = 0; i < per; i++) {
      const b = city[(Math.random() * city.length) | 0];
      this.peds.push({ v, b, t: Math.random(), sp: (0.9 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1), phase: Math.random() * 10, x: 0, z: 0, flee: 0, cheer: 0, fx: 0, fz: 0, s: 0.92 + Math.random() * 0.16, on: Math.random() });
    }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.density = 1;
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
    for (const V of this.variants) for (const mm of V.meshes) mm.count = 0;
    let cheerCount = 0;
    for (const ped of this.peds) {
      if (ped.on > this.density) continue;
      let dxh = ped.x - heroPos.x, dzh = ped.z - heroPos.z; let dh2 = dxh * dxh + dzh * dzh;
      if (dh2 > 230 * 230 && ped.init) continue;
      ped.init = true;
      let danger = null;
      for (const d of dangerPts) { const dx = ped.x - d.x, dz = ped.z - d.z; if (dx * dx + dz * dz < 600) { danger = d; break; } }
      if (danger) { ped.flee = 4; ped.fx = ped.x - danger.x; ped.fz = ped.z - danger.z; const l = Math.hypot(ped.fx, ped.fz) || 1; ped.fx /= l; ped.fz /= l; }
      let yaw, frame, bob = 0;
      if (ped.flee > 0) {
        ped.flee -= dt; ped.x += ped.fx * 6 * dt; ped.z += ped.fz * 6 * dt; yaw = Math.atan2(ped.fx, ped.fz);
        ped.phase += dt * 11; frame = Math.floor(ped.phase / (Math.PI * 2) * 6) % 6;
        if (ped.flee <= 0) { const b = ped.b; ped.x = Math.min(Math.max(ped.x, b.minX + 1), b.maxX - 1); ped.z = Math.min(Math.max(ped.z, b.minZ + 1), b.maxZ - 1); }
      } else if (heroGrounded && dh2 < 150 && dangerPts.length === 0) {
        yaw = Math.atan2(-dxh, -dzh); ped.phase += dt * 8; frame = Math.sin(ped.phase) > 0 ? 7 : 6; bob = Math.max(0, Math.sin(ped.phase)) * 0.12; cheerCount++;
      } else {
        const b = ped.b; const L = 2 * (b.maxX - b.minX + b.maxZ - b.minZ);
        ped.t += ped.sp * 1.3 * dt / L;
        this.perim(b, ped.t, v2);
        yaw = Math.atan2(v2.x - ped.x, v2.y - ped.z);
        ped.x = v2.x; ped.z = v2.y;
        ped.phase += dt * 6.5; frame = Math.floor(ped.phase / (Math.PI * 2) * 6) % 6;
      }
      const mesh = this.variants[ped.v].meshes[frame];
      p.set(ped.x, 0.25 + bob, ped.z); q.setFromAxisAngle(UP, yaw || 0); s.setScalar(ped.s);
      m.compose(p, q, s); mesh.setMatrixAt(mesh.count++, m);
    }
    for (const V of this.variants) for (const mm of V.meshes) mm.instanceMatrix.needsUpdate = true;
    return cheerCount;
  }
}
const UP = new THREE.Vector3(0, 1, 0);
