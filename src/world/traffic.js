import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AVES, STREETS, PARK, ISLAND, AVE_W, ST_W } from './city.js';

function prep(g, c) {
  g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c);
  for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
// Side profile (x = length, y = height), extruded across the width.
function extrudeProfile(pts, width, bevel = 0.08) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2); // length along +z
  g.computeVertexNormals(); return g;
}
const MODELS = {
  sedan: { body: [[-2.3, 0.35], [2.3, 0.35], [2.35, 0.75], [2.1, 0.95], [1.1, 1.0], [0.55, 1.45], [-0.95, 1.47], [-1.7, 1.05], [-2.3, 0.98]], glass: [[0.95, 1.02], [0.5, 1.4], [-0.9, 1.42], [-1.55, 1.05]], w: 1.85, wheel: 0.36, wz: 1.45 },
  suv: { body: [[-2.45, 0.4], [2.45, 0.4], [2.5, 0.9], [2.25, 1.15], [1.35, 1.2], [0.95, 1.85], [-2.2, 1.9], [-2.45, 1.5]], glass: [[1.2, 1.22], [0.85, 1.78], [-2.1, 1.82], [-2.3, 1.3]], w: 2.0, wheel: 0.42, wz: 1.6 },
  cab: { body: [[-2.4, 0.35], [2.4, 0.35], [2.45, 0.78], [2.2, 0.98], [1.15, 1.02], [0.6, 1.5], [-1.0, 1.52], [-1.75, 1.06], [-2.4, 1.0]], glass: [[1.0, 1.05], [0.55, 1.45], [-0.95, 1.47], [-1.6, 1.07]], w: 1.9, wheel: 0.37, wz: 1.5, sign: true },
  van: { body: [[-2.7, 0.4], [2.7, 0.4], [2.75, 1.0], [2.3, 1.35], [1.9, 2.3], [-2.7, 2.35]], glass: [[2.25, 1.4], [1.9, 2.15], [1.2, 2.18], [1.2, 1.4]], w: 2.05, wheel: 0.42, wz: 1.8 },
};
function carGeometry(m) {
  const parts = [prep(extrudeProfile(m.body, m.w), 0xffffff), prep(extrudeProfile(m.glass, m.w + 0.04, 0.02), 0x0c1218)];
  for (const x of [-m.w / 2 + 0.12, m.w / 2 - 0.12]) for (const z of [-m.wz, m.wz]) {
    parts.push(prep(new THREE.CylinderGeometry(m.wheel, m.wheel, 0.28, 16).rotateZ(Math.PI / 2).translate(x, m.wheel, z), 0x0a0a0a));
    parts.push(prep(new THREE.CylinderGeometry(m.wheel * 0.55, m.wheel * 0.55, 0.3, 12).rotateZ(Math.PI / 2).translate(x, m.wheel, z), 0x9a9da2));
  }
  parts.push(prep(new THREE.BoxGeometry(m.w * 0.9, 0.12, 0.12).translate(0, 0.45, m.body[1][0] + 0.02), 0x202020));
  parts.push(prep(new THREE.BoxGeometry(m.w * 0.9, 0.12, 0.12).translate(0, 0.45, m.body[0][0] - 0.02), 0x202020));
  if (m.sign) parts.push(prep(new THREE.BoxGeometry(0.7, 0.22, 0.25).translate(0, 1.62, -0.2), 0xfff3b0));
  return mergeGeometries(parts);
}
function lightGeometry(m) {
  const f = m.body[1][0] + 0.03, b = m.body[0][0] - 0.03;
  return mergeGeometries([
    prep(new THREE.BoxGeometry(0.42, 0.14, 0.04).translate(-m.w / 2 + 0.35, 0.78, f), 0xfff4d8), prep(new THREE.BoxGeometry(0.42, 0.14, 0.04).translate(m.w / 2 - 0.35, 0.78, f), 0xfff4d8),
    prep(new THREE.BoxGeometry(0.42, 0.12, 0.04).translate(-m.w / 2 + 0.3, 0.88, b), 0xff1010), prep(new THREE.BoxGeometry(0.42, 0.12, 0.04).translate(m.w / 2 - 0.3, 0.88, b), 0xff1010)]);
}

export class Traffic {
  constructor(scene) {
    this.mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
    this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.lanes = [];
    for (const x of AVES) {
      if (x > PARK.minX - 12 && x < PARK.maxX + 12) continue;
      this.lanes.push({ axis: 'z', c: x - 5, dir: 1, min: ISLAND.minZ, max: ISLAND.maxZ, speed: 12 + Math.random() * 4, cross: STREETS });
      this.lanes.push({ axis: 'z', c: x + 5, dir: -1, min: ISLAND.minZ, max: ISLAND.maxZ, speed: 12 + Math.random() * 4, cross: STREETS });
    }
    for (const z of STREETS) {
      if (z > PARK.minZ - 8 && z < PARK.maxZ + 8) continue;
      this.lanes.push({ axis: 'x', c: z + 3, dir: 1, min: ISLAND.minX, max: ISLAND.maxX, speed: 9 + Math.random() * 3, cross: AVES });
      if (Math.random() < 0.5) this.lanes.push({ axis: 'x', c: z - 3, dir: -1, min: ISLAND.minX, max: ISLAND.maxX, speed: 9 + Math.random() * 3, cross: AVES });
    }
    const kinds = ['sedan', 'sedan', 'suv', 'cab', 'cab', 'van'];
    const palette = [0x111111, 0xe8e8e8, 0x8a8f96, 0x1d2a44, 0x7a1010, 0x2c4a2c, 0x3a3a3a, 0xb0b8c0, 0x4a2a14, 0x0e3a5a];
    this.N = 480; this.cars = []; this.meshes = {}; this.lights = {};
    const c = new THREE.Color();
    const counts = {};
    for (let i = 0; i < this.N; i++) {
      const lane = this.lanes[i % this.lanes.length], kind = kinds[(Math.random() * kinds.length) | 0];
      counts[kind] = (counts[kind] || 0) + 1;
      this.cars.push({ lane, kind, idx: counts[kind] - 1, t: lane.min + Math.random() * (lane.max - lane.min), sp: lane.speed * (0.85 + Math.random() * 0.3), v: 0, len: MODELS[kind].body[1][0] * 2 });
    }
    for (const k of Object.keys(MODELS)) {
      const n = counts[k] || 1;
      const m = new THREE.InstancedMesh(carGeometry(MODELS[k]), this.mat, n); m.castShadow = true; m.receiveShadow = true;
      const l = new THREE.InstancedMesh(lightGeometry(MODELS[k]), this.lightMat, n);
      for (let i = 0; i < n; i++) m.setColorAt(i, c.set(k === 'cab' ? 0xf2c200 : palette[(Math.random() * palette.length) | 0]));
      this.meshes[k] = m; this.lights[k] = l; scene.add(m, l);
    }
    // group cars by lane for queueing
    this.byLane = new Map(); for (const car of this.cars) { if (!this.byLane.has(car.lane)) this.byLane.set(car.lane, []); this.byLane.get(car.lane).push(car); }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.density = 1; this.phase = 0; this.honkT = 0;
  }
  setDensity(d) { this.density = d; }
  update(dt, focus, danger, phase = 0, audio) {
    const { m, q, p, s } = this;
    const greenAxis = phase === 0 ? 'z' : phase === 2 ? 'x' : null;
    for (const [lane, cars] of this.byLane) {
      cars.sort((a, b) => (a.t - b.t) * lane.dir);
      const L = lane.max - lane.min;
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i]; let target = car.sp;
        const ahead = cars[(i + 1) % cars.length];
        let gap = (ahead.t - car.t) * lane.dir; if (gap <= 0) gap += L;
        if (cars.length > 1 && gap < car.len + 3.5) target = 0; else if (cars.length > 1 && gap < car.len + 12) target = Math.min(target, (gap - car.len - 3.5) * 1.2);
        // red light: stop before next crossing
        if (lane.axis !== greenAxis) {
          for (const cx of lane.cross) {
            const stopAt = cx - lane.dir * ((lane.axis === 'z' ? ST_W : AVE_W) / 2 + 3.5 + car.len / 2);
            const d = (stopAt - car.t) * lane.dir;
            if (d > -0.5 && d < 18) { target = Math.min(target, Math.max(0, d - 0.3) * 1.1); break; }
          }
        }
        if (danger) { const dx = (lane.axis === 'z' ? lane.c : car.t) - danger.x, dz = (lane.axis === 'z' ? car.t : lane.c) - danger.z; if (dx * dx + dz * dz < 900) { target = 0; if (Math.random() < dt * 0.05 && audio) audio.honk?.(); } }
        car.v = THREE.MathUtils.damp(car.v, target, target < car.v ? 4 : 1.2, dt);
        car.t += car.v * lane.dir * dt;
        if (car.t > lane.max) car.t -= L; if (car.t < lane.min) car.t += L;
      }
    }
    const visibleFrac = this.density;
    for (const car of this.cars) {
      const L = car.lane, mesh = this.meshes[car.kind], lm = this.lights[car.kind];
      const hide = (car.idx / mesh.count) > visibleFrac;
      if (L.axis === 'z') { p.set(L.c, hide ? -50 : 0, car.t); q.setFromAxisAngle(UP, L.dir > 0 ? 0 : Math.PI); }
      else { p.set(car.t, hide ? -50 : 0, L.c); q.setFromAxisAngle(UP, L.dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
      m.compose(p, q, s); mesh.setMatrixAt(car.idx, m); lm.setMatrixAt(car.idx, m);
    }
    for (const k in this.meshes) { this.meshes[k].instanceMatrix.needsUpdate = true; this.lights[k].instanceMatrix.needsUpdate = true; }
  }
}
const UP = new THREE.Vector3(0, 1, 0);
