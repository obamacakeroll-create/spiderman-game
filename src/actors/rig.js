import * as THREE from 'three';
import { canvas, tex } from '../world/textures.js';

// Procedural articulated humanoid with code-driven pose blending.
export const SUITS = {
  ali_volt: { name: 'Volt Weaver', hero: 'ali', base: '#0d1116', second: '#12202a', accent: '#18e0ff', line: '#0a8fb0', pattern: 'lightning', eyes: '#bff8ff', eyeGlow: 1.6, metal: 0.2, rough: 0.45, level: 1 },
  ali_classic: { name: 'Juma Classic', hero: 'ali', base: '#c3161c', second: '#16307a', accent: '#f2f2f2', line: '#1a0c0c', pattern: 'web', eyes: '#f4f7ff', eyeGlow: 0.2, metal: 0.1, rough: 0.55, level: 3 },
  ali_circuit: { name: 'Night Circuit', hero: 'ali', base: '#e8e8f0', second: '#1d1433', accent: '#b25cff', line: '#6a2ec0', pattern: 'lightning', eyes: '#e3c8ff', eyeGlow: 2, metal: 0.2, rough: 0.35, level: 6 },
  majed_iron: { name: 'Ironsilk', hero: 'majed', base: '#8e0f16', second: '#2a2d33', accent: '#c9ced6', line: '#1a0708', pattern: 'plates', eyes: '#fff3e6', eyeGlow: 0.3, metal: 0.55, rough: 0.35, level: 1 },
  majed_desert: { name: 'Desert Sentinel', hero: 'majed', base: '#b89a6a', second: '#141414', accent: '#e0b040', line: '#3b2c16', pattern: 'plates', eyes: '#ffe7a8', eyeGlow: 1.0, metal: 0.4, rough: 0.5, level: 3 },
  majed_midnight: { name: 'Midnight Warden', hero: 'majed', base: '#101a33', second: '#6c7686', accent: '#e8eef8', line: '#050810', pattern: 'web', eyes: '#cfe4ff', eyeGlow: 1.2, metal: 0.5, rough: 0.3, level: 6 },
  venom: { name: 'Venom', hero: 'venom', base: '#050507', second: '#0b0b12', accent: '#f4f4f4', line: '#1c1c2a', pattern: 'symbiote', eyes: '#ffffff', eyeGlow: 0.4, metal: 0.3, rough: 0.2, level: 1 },
  venom_ali: { name: 'Anti-Venom', hero: 'venom', base: '#f0f0f0', second: '#d8d8e0', accent: '#101010', line: '#999', pattern: 'symbiote', eyes: '#111', eyeGlow: 0, metal: 0.3, rough: 0.25, level: 10 },
};

function suitTexture(s, part) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = s.base; g.fillRect(0, 0, 512, 512);
  if (part === 'torso' && s.pattern !== 'symbiote') {
    // side panels in secondary color
    g.fillStyle = s.second; g.fillRect(0, 0, 90, 512); g.fillRect(422, 0, 90, 512); g.fillRect(170, 0, 172, 512 * 0.0);
  }
  if (part === 'leg' && s.pattern !== 'symbiote') { g.fillStyle = s.second; g.fillRect(0, 0, 512, 300); g.fillStyle = s.base; g.fillRect(0, 300, 512, 212); }
  if (part === 'arm' && s.pattern !== 'symbiote') { g.fillStyle = s.second; g.fillRect(200, 0, 112, 512); }
  g.strokeStyle = s.line; g.lineWidth = 2.5;
  if (s.pattern === 'web' || s.pattern === 'plates' || s.pattern === 'lightning') {
    for (let x = 0; x <= 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    for (let y = 0; y <= 512; y += 36) { g.beginPath(); for (let x = 0; x <= 512; x += 32) { g.quadraticCurveTo(x - 16, y + 7, x, y); } g.stroke(); }
  }
  if (s.pattern === 'lightning') {
    g.strokeStyle = s.accent; g.lineWidth = 5; g.shadowColor = s.accent; g.shadowBlur = 10;
    for (let k = 0; k < 5; k++) { g.beginPath(); let x = 40 + k * 100, y = 0; g.moveTo(x, y); while (y < 512) { x += (Math.random() - .5) * 60; y += 30 + Math.random() * 30; g.lineTo(x, y); } g.stroke(); }
    g.shadowBlur = 0;
  }
  if (s.pattern === 'plates') {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 18; y < 512; y += 72) for (let x = 0; x < 512; x += 64) { g.fillRect(x + 4, y, 56, 4); }
    g.strokeStyle = s.accent; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
  }
  if (s.pattern === 'symbiote') {
    for (let i = 0; i < 70; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40); const x = Math.random() * 512, y = Math.random() * 512; g.save(); g.translate(x, y); gr.addColorStop(0, 'rgba(60,60,110,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-40, -40, 80, 80); g.restore(); }
    g.strokeStyle = 'rgba(80,80,140,0.25)'; g.lineWidth = 3;
    for (let i = 0; i < 30; i++) { g.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - .5) * 90; y += Math.random() * 60; g.lineTo(x, y); } g.stroke(); }
  }
  return tex(c);
}
function emblemTexture(color, big) {
  const [c, g] = canvas(256, 256);
  g.translate(128, 128); g.fillStyle = color; g.strokeStyle = color; g.lineCap = 'round';
  const s = big ? 1.4 : 1;
  g.beginPath(); g.ellipse(0, -22 * s, 16 * s, 20 * s, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(0, 22 * s, 20 * s, 34 * s, 0, 0, 7); g.fill();
  g.lineWidth = 7 * s;
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    g.beginPath(); g.moveTo(sx * 10 * s, (-20 + k * 12) * s);
    const a = (-0.9 + k * 0.55);
    g.quadraticCurveTo(sx * 60 * s, (-40 + k * 25) * s * (big ? 1.6 : 1), sx * (80 + (big ? 30 : 0)) * s * 0.9, (a * 90) * s * (big ? 1.4 : 1));
    g.stroke();
  }
  const t = tex(c, false); return t;
}

const capsule = (r, l) => { const g = new THREE.CapsuleGeometry(r, l, 6, 14); g.translate(0, -l / 2 - r * 0.2, 0); return g; };

export class Rig {
  constructor(opts = {}) {
    const bulk = opts.bulk || 1, scale = opts.scale || 1;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body); // body can pitch/roll independently
    this.j = {};
    this.parts = [];
    const J = (name, parent, x, y, z) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); this.j[name] = o; return o; };
    const hips = J('hips', this.body, 0, 0.98, 0);
    const spine = J('spine', hips, 0, 0.1, 0);
    const chest = J('chest', spine, 0, 0.26, 0);
    const neck = J('neck', chest, 0, 0.3, 0);
    const head = J('head', neck, 0, 0.08, 0);
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const sh = J('sh' + s, chest, sx * 0.2 * bulk, 0.22, 0);
      const el = J('el' + s, sh, 0, -0.3, 0);
      J('hand' + s, el, 0, -0.27, 0);
      const th = J('th' + s, hips, sx * 0.1 * bulk, -0.04, 0);
      const kn = J('kn' + s, th, 0, -0.44, 0);
      J('ank' + s, kn, 0, -0.43, 0);
    }
    this.root.scale.setScalar(scale);
    this.bulk = bulk;
    this.current = {}; for (const k in this.j) this.current[k] = new THREE.Euler();
  }
  dress(suit, kind = 'hero') {
    // remove old meshes
    for (const m of this.parts) m.parent.remove(m);
    this.parts = [];
    const b = this.bulk;
    let torsoM, armM, legM, headM, accentM;
    if (kind === 'hero') {
      const mk = (part) => new THREE.MeshPhysicalMaterial({ map: suitTexture(suit, part), roughness: suit.rough, metalness: suit.metal * 0.3, clearcoat: suit.pattern === 'symbiote' ? 1 : 0.3, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color(suit.accent) });
      torsoM = mk('torso'); armM = mk('arm'); legM = mk('leg'); headM = mk('head');
      accentM = new THREE.MeshStandardMaterial({ color: suit.second, metalness: suit.metal, roughness: 0.3, emissive: suit.pattern === 'lightning' ? suit.accent : '#000', emissiveIntensity: 0.3 });
    } else {
      const c = kind.colors;
      torsoM = new THREE.MeshStandardMaterial({ color: c.jacket, roughness: 0.8 });
      armM = torsoM; legM = new THREE.MeshStandardMaterial({ color: c.pants, roughness: 0.9 });
      headM = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.7 });
      accentM = new THREE.MeshStandardMaterial({ color: c.accent || 0x222222, roughness: 0.5, metalness: 0.5 });
    }
    const add = (joint, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; this.j[joint].add(m); this.parts.push(m); return m; };
    // torso
    add('hips', new THREE.SphereGeometry(0.17, 16, 12), legM, 0, 0.02, 0, 1.1 * b, 0.8, 0.8 * b);
    add('spine', capsule(0.15, 0.12), torsoM, 0, 0.26, 0, 1.05 * b, 1, 0.78 * b);
    const ch = add('chest', new THREE.SphereGeometry(0.22, 20, 16), torsoM, 0, 0.14, 0.0, 1.12 * b, 1.05, 0.72 * b);
    add('neck', capsule(0.065, 0.06), headM, 0, 0.08, 0);
    add('head', new THREE.SphereGeometry(0.125, 24, 18), headM, 0, 0.11, 0.01, 0.92, 1.12, 1.0);
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      add('sh' + s, new THREE.SphereGeometry(0.085, 12, 10), torsoM, 0, 0, 0, 1.2 * b, 1, 1.1 * b);
      add('sh' + s, capsule(0.063 * b, 0.2), armM, 0, 0, 0);
      add('el' + s, capsule(0.052 * b, 0.19), armM, 0, 0, 0);
      add('hand' + s, new THREE.SphereGeometry(0.055, 10, 8), accentM, 0, -0.04, 0, 0.9, 1.3, 0.7);
      add('th' + s, capsule(0.085 * b, 0.33), legM, 0, 0, 0);
      add('kn' + s, capsule(0.066 * b, 0.32), legM, 0, 0, 0);
      add('ank' + s, new THREE.BoxGeometry(0.1, 0.07, 0.24), accentM, 0, -0.03, 0.05);
      if (kind === 'hero' && suit.pattern === 'plates') {
        const plate = new THREE.MeshStandardMaterial({ color: suit.accent, metalness: 0.9, roughness: 0.25 });
        add('sh' + s, new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), plate, sx * 0.01, 0.02, 0, 1.35 * b, 0.9, 1.25 * b);
        add('el' + s, new THREE.CylinderGeometry(0.06 * b, 0.07 * b, 0.14, 10), plate, 0, -0.12, 0);
      }
      if (kind === 'hero' && suit.pattern === 'lightning') {
        const glow = new THREE.MeshBasicMaterial({ color: suit.accent, toneMapped: false });
        add('el' + s, new THREE.TorusGeometry(0.058, 0.009, 6, 16), glow, 0, -0.17, 0).rotation.x = Math.PI / 2;
        add('kn' + s, new THREE.TorusGeometry(0.07, 0.01, 6, 16), glow, 0, -0.1, 0).rotation.x = Math.PI / 2;
      }
    }
    if (kind === 'hero') {
      const eyeMat = new THREE.MeshStandardMaterial({ color: suit.eyes, emissive: suit.eyes, emissiveIntensity: suit.eyeGlow, roughness: 0.2, metalness: 0.2 });
      const rimMat = new THREE.MeshStandardMaterial({ color: suit.pattern === 'symbiote' ? '#000' : '#050505', roughness: 0.3 });
      const big = suit.pattern === 'symbiote' ? 1.5 : 1;
      for (const sx of [-1, 1]) {
        const rim = add('head', new THREE.SphereGeometry(0.052 * big, 14, 10), rimMat, sx * 0.05 * big, 0.13, 0.095, 1.05, 0.8, 0.35);
        rim.rotation.z = sx * 0.55;
        const eye = add('head', new THREE.SphereGeometry(0.045 * big, 14, 10), eyeMat, sx * 0.05 * big, 0.13, 0.1, 1.0, 0.72, 0.35);
        eye.rotation.z = sx * 0.55;
      }
      const em = new THREE.Mesh(new THREE.PlaneGeometry(0.34 * b, 0.34), new THREE.MeshStandardMaterial({ map: emblemTexture(suit.pattern === 'symbiote' ? suit.accent : suit.line === '#1a0c0c' ? '#111' : suit.accent, suit.pattern === 'symbiote'), transparent: true, roughness: 0.4, emissive: suit.pattern === 'lightning' ? suit.accent : '#000', emissiveIntensity: 0.8, emissiveMap: null, depthWrite: false }));
      em.position.set(0, 0.14, 0.158 * b); ch.parent.add(em); this.parts.push(em);
      const emB = em.clone(); emB.position.z = -0.158 * b; emB.rotation.y = Math.PI; ch.parent.add(emB); this.parts.push(emB);
      if (suit.pattern === 'symbiote') {
        const teethM = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.3 });
        const mouth = add('head', new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a0610, roughness: 0.5 }), 0, 0.03, 0.09, 1.3, 0.8, 0.6);
        for (let k = 0; k < 9; k++) { const t = add('head', new THREE.ConeGeometry(0.012, 0.045, 5), teethM, -0.07 + k * 0.0175, 0.045, 0.125); t.rotation.x = Math.PI; }
        for (let k = 0; k < 9; k++) add('head', new THREE.ConeGeometry(0.011, 0.04, 5), teethM, -0.068 + k * 0.017, -0.0, 0.12);
        const tongue = add('head', new THREE.CapsuleGeometry(0.018, 0.12, 4, 8), new THREE.MeshStandardMaterial({ color: 0xb02040, roughness: 0.4 }), 0, -0.04, 0.14); tongue.rotation.x = 1.3;
        this.mouth = mouth;
      }
    } else {
      if (kind.mask) add('head', new THREE.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), accentM, 0, 0.13, 0, 1, 1, 1);
      if (kind.armor) { add('chest', new THREE.BoxGeometry(0.46 * b, 0.4, 0.34 * b), accentM, 0, 0.14, 0); add('head', new THREE.SphereGeometry(0.15, 16, 12), accentM, 0, 0.12, 0); }
    }
  }
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
