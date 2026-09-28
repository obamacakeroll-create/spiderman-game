import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { AVES, STREETS, PARK, ISLAND } from './city.js';

function colored(g, c) { const n = g.attributes.position.count; const a = new Float32Array(n * 3); const col = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.toNonIndexed ? g : g; }
function prep(g, c) { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return colored(g, c); }

export class Traffic {
  constructor(scene) {
    const body = prep(new RoundedBoxGeometry(1.9, 0.8, 4.4, 3, 0.25).translate(0, 0.75, 0), 0xffffff);
    const cabin = prep(new RoundedBoxGeometry(1.7, 0.65, 2.3, 3, 0.2).translate(0, 1.42, -0.2), 0x1a2128);
    const wheels = [];
    for (const x of [-0.9, 0.9]) for (const z of [-1.4, 1.4]) wheels.push(prep(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12).rotateZ(Math.PI / 2).translate(x, 0.36, z), 0x0c0c0c));
    const geo = mergeGeometries([body, cabin, ...wheels]);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.28 });
    this.lanes = [];
    for (const x of AVES) {
      if (x > PARK.minX - 12 && x < PARK.maxX + 12) continue;
      this.lanes.push({ axis: 'z', c: x - 4.5, dir: 1, min: ISLAND.minZ, max: ISLAND.maxZ, speed: 11 + Math.random() * 5 });
      this.lanes.push({ axis: 'z', c: x + 4.5, dir: -1, min: ISLAND.minZ, max: ISLAND.maxZ, speed: 11 + Math.random() * 5 });
    }
    for (const z of STREETS) {
      if (z > PARK.minZ - 8 && z < PARK.maxZ + 8) continue;
      this.lanes.push({ axis: 'x', c: z + 2.8, dir: 1, min: ISLAND.minX, max: ISLAND.maxX, speed: 8 + Math.random() * 4 });
      if (Math.random() < 0.5) this.lanes.push({ axis: 'x', c: z - 2.8, dir: -1, min: ISLAND.minX, max: ISLAND.maxX, speed: 8 + Math.random() * 4 });
    }
    const N = 420; this.cars = [];
    this.mesh = new THREE.InstancedMesh(geo, this.mat, N); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    const lg = mergeGeometries([
      prep(new THREE.BoxGeometry(0.4, 0.15, 0.05).translate(-0.6, 0.85, 2.21), 0xfff4d8), prep(new THREE.BoxGeometry(0.4, 0.15, 0.05).translate(0.6, 0.85, 2.21), 0xfff4d8),
      prep(new THREE.BoxGeometry(0.4, 0.12, 0.05).translate(-0.65, 0.9, -2.21), 0xff1010), prep(new THREE.BoxGeometry(0.4, 0.12, 0.05).translate(0.65, 0.9, -2.21), 0xff1010)]);
    this.lights = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), N);
    const palette = [0x111111, 0xe8e8e8, 0x8a8f96, 0x1d2a44, 0x7a1010, 0xf2c200, 0xf2c200, 0xf2c200, 0x2c4a2c, 0x3a3a3a, 0xb0b8c0];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const lane = this.lanes[i % this.lanes.length];
      this.cars.push({ lane, t: lane.min + Math.random() * (lane.max - lane.min), sp: lane.speed * (0.9 + Math.random() * 0.2), stop: 0, hp: 3 });
      this.mesh.setColorAt(i, c.set(palette[(Math.random() * palette.length) | 0]));
    }
    scene.add(this.mesh, this.lights);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
  }
  update(dt, focus, danger) {
    const { m, q, p, s } = this;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i], L = car.lane;
      // brake near danger
      let target = car.sp;
      if (danger) { const dx = (L.axis === 'z' ? L.c : car.t) - danger.x, dz = (L.axis === 'z' ? car.t : L.c) - danger.z; if (dx * dx + dz * dz < 900) target = 0; }
      car.v = THREE.MathUtils.damp(car.v ?? car.sp, target, 2, dt);
      car.t += car.v * L.dir * dt;
      if (car.t > L.max) car.t = L.min; if (car.t < L.min) car.t = L.max;
      if (L.axis === 'z') { p.set(L.c, 0, car.t); q.setFromAxisAngle(UP, L.dir > 0 ? 0 : Math.PI); }
      else { p.set(car.t, 0, L.c); q.setFromAxisAngle(UP, L.dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
      m.compose(p, q, s); this.mesh.setMatrixAt(i, m); this.lights.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.lights.instanceMatrix.needsUpdate = true;
  }
  carPos(i, out) { const car = this.cars[i], L = car.lane; return L.axis === 'z' ? out.set(L.c, 0, car.t) : out.set(car.t, 0, L.c); }
}
const UP = new THREE.Vector3(0, 1, 0);
