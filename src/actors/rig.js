import * as THREE from 'three';

import { buildBodyGeometry, makeSuitMaterial, applyAPose } from './body.js';

// Procedural articulated humanoid: skinned SDF body + code-driven pose blending.
export const SUITS = {
  ali_volt: { name: 'Volt Weaver', hero: 'ali', layout: 'volt', base: '#0b0e13', second: '#122a36', accent: '#18e0ff', line: '#0e7d94', glow: 0.8, emblemCol: '#18e0ff', emblemGlow: 2.2, eyes: '#c8faff', eyeGlow: 2.2, metal: 0.15, rough: 0.42, level: 1 },
  ali_classic: { name: 'Juma Classic', hero: 'ali', layout: 'spider', base: '#b3121b', second: '#16307c', accent: '#f2f2f2', line: '#1c0707', emblemCol: '#0c0c0c', eyes: '#f4f7ff', eyeGlow: 0.3, metal: 0.05, rough: 0.5, level: 3 },
  ali_circuit: { name: 'Night Circuit', hero: 'ali', layout: 'volt', base: '#e6e6ee', second: '#211538', accent: '#b25cff', line: '#6a3ab8', glow: 0.8, emblemCol: '#b25cff', emblemGlow: 1.8, eyes: '#e3c8ff', eyeGlow: 2, metal: 0.15, rough: 0.35, level: 6 },
  majed_iron: { name: 'Ironsilk', hero: 'majed', layout: 'armor', base: '#8c0f16', second: '#26292f', accent: '#aeb5c0', line: '#14060a', emblemCol: '#d8dce4', eyes: '#fff3e6', eyeGlow: 0.4, metal: 0.35, rough: 0.35, level: 1 },
  majed_desert: { name: 'Desert Sentinel', hero: 'majed', layout: 'armor', base: '#b39466', second: '#151515', accent: '#e0b040', line: '#3b2c16', emblemCol: '#141414', eyes: '#ffe7a8', eyeGlow: 1.0, metal: 0.3, rough: 0.5, level: 3 },
  majed_midnight: { name: 'Midnight Warden', hero: 'majed', layout: 'spider', base: '#0f1a36', second: '#59636f', accent: '#e8eef8', line: '#7d95c2', emblemCol: '#e8eef8', emblemGlow: 0.6, eyes: '#cfe4ff', eyeGlow: 1.4, metal: 0.3, rough: 0.3, level: 6 },
  venom: { name: 'Venom', hero: 'venom', layout: 'symbiote', base: '#050508', second: '#0b0b12', accent: '#f4f4f4', line: '#1c1c2a', emblemCol: '#f2f2f2', eyes: '#ffffff', eyeGlow: 0.5, metal: 0.25, rough: 0.2, level: 1 },
  venom_ali: { name: 'Anti-Venom', hero: 'venom', layout: 'symbiote', base: '#e8e8ec', second: '#d8d8e0', accent: '#101010', line: '#999', emblemCol: '#0c0c0c', eyes: '#111', eyeGlow: 0, metal: 0.25, rough: 0.25, level: 10 },
};

export class Rig {
  constructor(opts = {}) {
    const bulk = opts.bulk || 1, scale = opts.scale || 1;
    this.opts = { bulk, muscle: opts.muscle || 1, waist: opts.waist || 1, head: opts.head || 1, venom: !!opts.venom, step: opts.step };
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.j = {}; this.parts = [];
    const J = (name, parent, x, y, z) => { const o = new THREE.Bone(); o.name = name; o.position.set(x, y, z); parent.add(o); this.j[name] = o; return o; };
    const hips = J('hips', this.body, 0, 0.98, 0);
    const spine = J('spine', hips, 0, 0.1, 0);
    const chest = J('chest', spine, 0, 0.26, 0);
    const neck = J('neck', chest, 0, 0.3, 0);
    J('head', neck, 0, 0.08, 0);
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const sh = J('sh' + s, chest, sx * 0.19 * bulk, 0.21, -0.01);
      const el = J('el' + s, sh, 0, -0.29, 0);
      J('hand' + s, el, 0, -0.26, 0.01);
      const th = J('th' + s, hips, sx * 0.095 * bulk, -0.05, 0);
      const kn = J('kn' + s, th, 0, -0.44, 0.005);
      J('ank' + s, kn, 0, -0.42, -0.01);
    }
    this.bulk = bulk; this.scale = scale;
    this.bodyKey = opts.key || `b${bulk}-${this.opts.muscle}-${this.opts.waist}-${this.opts.head}-${this.opts.venom}`;
  }
  dress(suit, kind = 'hero') {
    for (const m of this.parts) m.parent && m.parent.remove(m);
    this.parts = [];
    const parent = this.root.parent; if (parent) parent.remove(this.root);
    const keep = { p: this.root.position.clone(), q: this.root.quaternion.clone() };
    this.root.scale.setScalar(1); this.root.position.set(0, 0, 0); this.root.quaternion.identity();
    this.root.updateMatrixWorld(true);
    const o = { ...this.opts, key: this.bodyKey };
    const res = buildBodyGeometry(this, o);
    let suitDef = suit;
    if (kind !== 'hero') {
      const c = kind.colors, hex = v => '#' + new THREE.Color(v).getHexString();
      suitDef = { layout: 'civ', base: hex(c.jacket), second: hex(c.pants), accent: hex(c.accent || 0x333333), skin: hex(c.skin), mask: kind.mask, maskCol: '#18181c', vest: kind.vest, rough: 0.8, metal: 0, emblem: false, emblemCol: '#e8e8e8', gloves: kind.gloves };
      if (kind.symb) Object.assign(suitDef, { layout: 'symbiote', base: '#07070b', rough: 0.25, emblem: true });
    }
    const { geo, mat } = makeSuitMaterial(res, suitDef, o);
    this.mat = mat;
    applyAPose(this);
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    this.body.add(mesh); this.parts.push(mesh);
    this.body.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(Object.values(this.j)));
    this.mesh = mesh;
    for (const n in this.j) this.j[n].rotation.set(0, 0, 0);
    this.accessories(suitDef, kind);
    this.root.scale.setScalar(this.scale); this.root.position.copy(keep.p); this.root.quaternion.copy(keep.q);
    if (parent) parent.add(this.root);
  }
  accessories(suit, kind) {
    const hs = this.opts.head, b = this.bulk;
    const add = (joint, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; this.j[joint].add(m); this.parts.push(m); return m; };
    if (kind === 'hero') {
      const eyeMat = new THREE.MeshPhysicalMaterial({ color: suit.eyes, emissive: suit.eyes, emissiveIntensity: suit.eyeGlow, roughness: 0.08, metalness: 0.1, clearcoat: 1 });
      const rimMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.35, metalness: 0.4 });
      const v = suit.layout === 'symbiote';
      const big = v ? 1.55 : 1;
      for (const sx of [-1, 1]) {
        const x = sx * (v ? 0.05 : 0.041) * hs, y = (v ? 0.14 : 0.133) * hs, z = (v ? 0.078 : 0.085) * hs;
        if (!v) { const rim = add('head', new THREE.SphereGeometry(0.036 * big * hs, 20, 14), rimMat, x, y, z - 0.002, 1.3, 0.92, 0.42); rim.rotation.z = sx * 0.5; }
        const eye = add('head', new THREE.SphereGeometry(0.036 * big * hs, 20, 14), eyeMat, x, y, z + 0.003, 1.12, 0.74, 0.4); eye.rotation.z = sx * (v ? 0.62 : 0.5);
      }
      if (v) {
        const teethM = new THREE.MeshPhysicalMaterial({ color: 0xf2eee0, roughness: 0.25, clearcoat: 1 });
        const gum = new THREE.MeshStandardMaterial({ color: 0x3a0610, roughness: 0.45 });
        this.mouth = add('head', new THREE.SphereGeometry(0.075, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gum, 0, 0.07, 0.085, 1.35, 0.9, 0.65);
        for (let k = 0; k < 11; k++) { const t = add('head', new THREE.ConeGeometry(0.009, 0.042, 6), teethM, -0.075 + k * 0.015, 0.075, 0.13 - Math.abs(k - 5) * 0.004); t.rotation.x = Math.PI; }
        for (let k = 0; k < 11; k++) add('head', new THREE.ConeGeometry(0.008, 0.036, 6), teethM, -0.07 + k * 0.014, 0.035, 0.125 - Math.abs(k - 5) * 0.004);
        const tongue = add('head', new THREE.CapsuleGeometry(0.016, 0.14, 4, 10), new THREE.MeshPhysicalMaterial({ color: 0xa01838, roughness: 0.3, clearcoat: 1 }), 0, 0.02, 0.15); tongue.rotation.x = 1.35;
      }
      if (suit.layout === 'volt') {
        const glow = new THREE.MeshBasicMaterial({ color: suit.accent, toneMapped: false });
        for (const s of ['L', 'R']) add('el' + s, new THREE.CylinderGeometry(0.037, 0.037, 0.045, 16, 1, true), glow, 0, -0.2, 0.0, 1, 1, 0.9);
      }
      if (suit.layout === 'armor') {
        const plate = new THREE.MeshPhysicalMaterial({ color: suit.accent, metalness: 0.95, roughness: 0.28, clearcoat: 0.6 });
        for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; add('sh' + s, new THREE.SphereGeometry(0.085 * b, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), plate, sx * 0.012, 0.025, 0, 1.15, 0.8, 1.1); add('el' + s, new THREE.CylinderGeometry(0.047 * b, 0.052 * b, 0.13, 16), plate, 0, -0.17, 0.004); }
      }
    } else {
      if (kind.cap) add('head', new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: kind.cap, roughness: 0.8 }), 0, 0.14, 0.0, 1.02, 0.9, 1.1);
      if (kind.armor) {
        const am = new THREE.MeshPhysicalMaterial({ color: kind.colors.accent, metalness: 0.7, roughness: 0.35, clearcoat: 0.5 });
        add('chest', new THREE.SphereGeometry(0.2 * b, 20, 14), am, 0, 0.12, 0.02, 1.05, 1.0, 0.72);
        add('head', new THREE.SphereGeometry(0.11, 20, 14), am, 0, 0.12, 0, 1, 1.06, 1.05);
        for (const s of ['L', 'R']) add('sh' + s, new THREE.SphereGeometry(0.1 * b, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), am, 0, 0.02, 0, 1.2, 0.9, 1.2);
        add('head', new THREE.BoxGeometry(0.12, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: 0xff7020, toneMapped: false }), 0, 0.13, 0.11);
      }
    }
  }
  flash(v) { if (this.mat) this.mat.userData.u.uHit.value = v; }
  tick(t) { if (this.mat) this.mat.userData.u.uTime.value = t; }
  // Blend towards target pose (object of joint -> [x,y,z]); unspecified joints return to rest.
  pose(target, dt, rate = 14) {
    const k = 1 - Math.exp(-rate * dt);
    for (const name in this.j) {
      const t = target[name] || ZERO, e = this.j[name].rotation;
      e.x += (t[0] - e.x) * k; e.y += (t[1] - e.y) * k; e.z += (t[2] - e.z) * k;
    }
    const hy = target.hipsY ?? 0.98;
    this.j.hips.position.y += (hy - this.j.hips.position.y) * k;
  }
}
const ZERO = [0, 0, 0];

// Pose library (functions of phase/time)
const S = Math.sin, C = Math.cos;
export const Poses = {
  idle: (t) => ({ spine: [0.03 + S(t * 2) * 0.02, 0, 0], chest: [0.04, 0, 0], shL: [0.05, 0, 0.18], shR: [0.05, 0, -0.18], elL: [-0.25, 0, 0], elR: [-0.25, 0, 0], thL: [0.05, 0, 0.04], thR: [0.05, 0, -0.04], knL: [0.12, 0, 0], knR: [0.12, 0, 0], head: [S(t * 0.7) * 0.05, S(t * 0.4) * 0.2, 0], hipsY: 0.97 + S(t * 2) * 0.01 }),
  heroIdle: (t) => ({ spine: [0.25, 0, 0], chest: [0.1, 0, 0], shL: [0.3, 0, 0.5], shR: [0.3, 0, -0.5], elL: [-1.2, 0, 0], elR: [-1.2, 0, 0], thL: [-0.7, 0, 0.35], thR: [-0.7, 0, -0.35], knL: [1.3, 0, 0], knR: [1.3, 0, 0], ankL: [-0.5, 0, 0], ankR: [-0.5, 0, 0], head: [-0.2, S(t * 0.6) * 0.3, 0], hipsY: 0.72 + S(t * 2) * 0.01 }),
  run: (p, sp = 1) => ({
    spine: [0.18 * sp, S(p) * 0.08, 0], chest: [0.1 * sp, -S(p) * 0.2, 0], head: [-0.15 * sp, S(p) * 0.1, 0],
    shL: [-S(p) * 1.1 * sp, 0, 0.12], shR: [S(p) * 1.1 * sp, 0, -0.12], elL: [-0.9 - Math.max(0, S(p)) * 0.4, 0, 0], elR: [-0.9 - Math.max(0, -S(p)) * 0.4, 0, 0],
    thL: [S(p) * 1.0 * sp, 0, 0.03], thR: [-S(p) * 1.0 * sp, 0, -0.03], knL: [Math.max(0, -C(p)) * 1.6 * sp + 0.1, 0, 0], knR: [Math.max(0, C(p)) * 1.6 * sp + 0.1, 0, 0],
    ankL: [-0.2, 0, 0], ankR: [-0.2, 0, 0], hipsY: 0.94 + Math.abs(C(p)) * 0.06 * sp,
  }),
  fall: (t) => ({ spine: [-0.1, 0, 0], shL: [0.4 + S(t * 9) * 0.2, 0, 1.3], shR: [0.4 - S(t * 9) * 0.2, 0, -1.3], elL: [-0.5, 0, 0], elR: [-0.5, 0, 0], thL: [0.6, 0, 0.2], thR: [0.1, 0, -0.2], knL: [0.9, 0, 0], knR: [1.4, 0, 0] }),
  jump: () => ({ spine: [0.3, 0, 0], shL: [-2.6, 0, 0.3], shR: [-0.2, 0, -0.6], elL: [-0.2, 0, 0], elR: [-1.2, 0, 0], thL: [1.4, 0, 0.1], thR: [0.2, 0, -0.1], knL: [2.0, 0, 0], knR: [1.2, 0, 0] }),
  dive: (t) => ({ spine: [0.2, 0, 0], shL: [-0.3, 0, 0.3 + S(t * 12) * 0.05], shR: [-0.3, 0, -0.3], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], thL: [0.1, 0, 0.1], thR: [0.1, 0, -0.1], knL: [0.3 + S(t * 10) * 0.1, 0, 0], knR: [0.3, 0, 0], head: [-0.7, 0, 0] }),
  swing: (side, t, phase) => {
    const up = side > 0 ? 'L' : 'R', dn = side > 0 ? 'R' : 'L', sx = side > 0 ? 1 : -1;
    const o = { spine: [0.1 - phase * 0.3, 0, 0], chest: [0, sx * 0.2, 0], head: [-0.2, 0, 0] };
    o['sh' + up] = [-2.9, 0, sx * 0.25]; o['el' + up] = [-0.05, 0, 0];
    o['sh' + dn] = [0.4, 0, -sx * 0.8]; o['el' + dn] = [-1.1, 0, 0];
    o.thL = [0.7 + phase * 0.8, 0, 0.1]; o.thR = [0.3 + phase * 0.6, 0, -0.1]; o.knL = [1.4 - phase * 0.8, 0, 0]; o.knR = [0.6 + phase * 0.8, 0, 0];
    return o;
  },
  wall: (p) => ({ spine: [0.5, 0, 0], shL: [-2.2 + S(p) * 0.6, 0, 0.5], shR: [-2.2 - S(p) * 0.6, 0, -0.5], elL: [-0.8, 0, 0], elR: [-0.8, 0, 0], thL: [1.2 + S(p) * 0.5, 0, 0.4], thR: [1.2 - S(p) * 0.5, 0, -0.4], knL: [1.6, 0, 0], knR: [1.6, 0, 0], head: [-0.6, 0, 0] }),
  flip: (t) => ({ spine: [0.9, 0, 0], shL: [-0.5, 0, 0.5], shR: [-0.5, 0, -0.5], elL: [-1.5, 0, 0], elR: [-1.5, 0, 0], thL: [2.0, 0, 0.1], thR: [2.0, 0, -0.1], knL: [2.4, 0, 0], knR: [2.4, 0, 0], head: [0.3, 0, 0] }),
  perch: (t) => Poses.heroIdle(t),
  punchL: () => ({ spine: [0.15, -0.5, 0], chest: [0, -0.5, 0], shL: [-1.55, 0, 0.1], elL: [-0.05, 0, 0], shR: [0.2, 0, -0.5], elR: [-1.8, 0, 0], thL: [-0.4, 0, 0], knL: [0.5, 0, 0], thR: [0.3, 0, 0], knR: [0.3, 0, 0], hipsY: 0.9 }),
  punchR: () => ({ spine: [0.15, 0.5, 0], chest: [0, 0.5, 0], shR: [-1.55, 0, -0.1], elR: [-0.05, 0, 0], shL: [0.2, 0, 0.5], elL: [-1.8, 0, 0], thR: [-0.4, 0, 0], knR: [0.5, 0, 0], thL: [0.3, 0, 0], knL: [0.3, 0, 0], hipsY: 0.9 }),
  kick: () => ({ spine: [-0.3, 0.3, 0.2], shL: [0.3, 0, 1.2], shR: [0.3, 0, -1.2], thR: [-1.7, 0, -0.2], knR: [0.1, 0, 0], thL: [0.1, 0, 0.1], knL: [0.3, 0, 0] }),
  spinKick: () => ({ spine: [-0.2, 0, 0.5], shL: [0, 0, 1.5], shR: [0, 0, -1.5], thL: [-1.5, 0, 0.9], knL: [0.1, 0, 0], thR: [0.2, 0, -0.2], knR: [0.5, 0, 0] }),
  uppercut: () => ({ spine: [-0.3, 0.3, 0], shR: [-3.0, 0, -0.2], elR: [-0.3, 0, 0], shL: [0.5, 0, 0.4], elL: [-1.5, 0, 0], thL: [-0.8, 0, 0], knL: [0.6, 0, 0], thR: [0.4, 0, 0], knR: [0.8, 0, 0], hipsY: 1.0 }),
  slam: () => ({ spine: [0.9, 0, 0], shL: [-2.8, 0, 0.4], shR: [-2.8, 0, -0.4], elL: [-0.3, 0, 0], elR: [-0.3, 0, 0], thL: [-1.2, 0, 0.3], thR: [-0.2, 0, -0.3], knL: [1.8, 0, 0], knR: [1.2, 0, 0], hipsY: 0.55 }),
  webShoot: (side = 1) => { const o = Poses.idle(0); o['sh' + (side > 0 ? 'L' : 'R')] = [-1.55, 0, side * 0.1]; o['el' + (side > 0 ? 'L' : 'R')] = [0, 0, 0]; o.spine = [0.1, side * 0.3, 0]; return o; },
  dodge: () => ({ spine: [0.9, 0, 0.5], shL: [-1, 0, 1.2], shR: [-1, 0, -1.2], thL: [1.6, 0, 0.2], thR: [1.6, 0, -0.2], knL: [2.2, 0, 0], knR: [2.2, 0, 0], hipsY: 0.6 }),
  hurt: () => ({ spine: [-0.5, 0, 0.2], head: [-0.4, 0, 0], shL: [0.6, 0, 0.8], shR: [0.6, 0, -0.8], elL: [-0.6, 0, 0], elR: [-0.6, 0, 0], thL: [0.4, 0, 0], knL: [0.6, 0, 0] }),
  down: () => ({ spine: [0, 0, 0], shL: [0, 0, 1.5], shR: [0, 0, -1.5], thL: [0, 0, 0.2], thR: [0, 0, -0.2], hipsY: 0.12 }),
  aim: () => ({ spine: [0.05, 0.3, 0], shR: [-1.5, 0.3, 0], elR: [0, 0, 0], shL: [-1.4, -0.4, 0], elL: [-0.3, 0, 0] }),
  windup: () => ({ spine: [-0.2, 0.6, 0], shR: [-0.4, 0, -1.4], elR: [-1.9, 0, 0], shL: [-0.6, 0, 0.3], elL: [-1.2, 0, 0], thL: [-0.5, 0, 0], knL: [0.4, 0, 0], thR: [0.3, 0, 0], knR: [0.5, 0, 0] }),
  cheer: (t) => ({ shL: [-2.8 + S(t * 8) * 0.3, 0, 0.3], shR: [-2.8 - S(t * 8) * 0.3, 0, -0.3], elL: [-0.3, 0, 0], elR: [-0.3, 0, 0], hipsY: 0.98 + Math.abs(S(t * 8)) * 0.05 }),
  cower: () => ({ spine: [0.7, 0, 0], head: [0.4, 0, 0], shL: [-2.2, 0, 0.8], shR: [-2.2, 0, -0.8], elL: [-2.2, 0, 0], elR: [-2.2, 0, 0], thL: [-1.3, 0, 0.2], thR: [-1.3, 0, -0.2], knL: [2.2, 0, 0], knR: [2.2, 0, 0], hipsY: 0.45 }),
};
