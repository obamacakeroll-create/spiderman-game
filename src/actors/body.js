import * as THREE from 'three';

// Procedural anatomy: a smooth signed-distance-field body is polygonised with
// surface nets, then skinned to the rig's bones. Suits are drawn in a shader
// (raised webbing, emblem, glow lines) using per-vertex pattern coordinates.

const CACHE = new Map();

// ---- SDF primitives -------------------------------------------------------
function capsule(a, b, r1, r2, k = 0.03) {
  const ab = b.clone().sub(a), l2 = ab.lengthSq();
  const pad = Math.max(r1, r2) + k;
  const min = a.clone().min(b).subScalar(pad), max = a.clone().max(b).addScalar(pad);
  return { k, min, max, f(x, y, z) {
    const px = x - a.x, py = y - a.y, pz = z - a.z;
    let t = (px * ab.x + py * ab.y + pz * ab.z) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - ab.x * t, dy = py - ab.y * t, dz = pz - ab.z * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (r1 + (r2 - r1) * t);
  } };
}
function ellipsoid(c, r, k = 0.03) {
  const pad = Math.max(r.x, r.y, r.z) + k;
  return { k, min: c.clone().subScalar(pad), max: c.clone().addScalar(pad), f(x, y, z) {
    const px = (x - c.x) / r.x, py = (y - c.y) / r.y, pz = (z - c.z) / r.z;
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const qx = px / r.x, qy = py / r.y, qz = pz / r.z;
    const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    return k1 < 1e-6 ? -Math.min(r.x, r.y, r.z) : k0 * (k0 - 1) / k1;
  } };
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

// ---- surface nets -----------------------------------------------------------
function surfaceNets(sdf, min, max, step) {
  const nx = Math.ceil((max.x - min.x) / step) + 1, ny = Math.ceil((max.y - min.y) / step) + 1, nz = Math.ceil((max.z - min.z) / step) + 1;
  const V = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    V[i + nx * (j + ny * k)] = sdf(min.x + i * step, min.y + j * step, min.z + k * step);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const o = corners[c]; cv[c] = V[idx(i + o[0], j + o[1], k + o[2])]; if (cv[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]); const A = corners[a], B = corners[b];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
    }
    cellV[cidx(i, j, k)] = pos.length / 3;
    pos.push(min.x + (i + sx / n) * step, min.y + (j + sy / n) * step, min.z + (k + sz / n) * step);
  }
  const index = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) index.push(a, b, c, a, c, d); else index.push(a, c, b, a, d, c); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = V[idx(i, j, k)] < 0;
    if (i < nx - 1 && (V[idx(i + 1, j, k)] < 0) !== v0) quad(cellV[cidx(i, j - 1, k - 1)], cellV[cidx(i, j, k - 1)], cellV[cidx(i, j, k)], cellV[cidx(i, j - 1, k)], v0);
    if (j < ny - 1 && (V[idx(i, j + 1, k)] < 0) !== v0) quad(cellV[cidx(i - 1, j, k - 1)], cellV[cidx(i - 1, j, k)], cellV[cidx(i, j, k)], cellV[cidx(i, j, k - 1)], v0);
    if (k < nz - 1 && (V[idx(i, j, k + 1)] < 0) !== v0) quad(cellV[cidx(i - 1, j - 1, k)], cellV[cidx(i, j - 1, k)], cellV[cidx(i, j, k)], cellV[cidx(i - 1, j, k)], v0);
  }
  return { pos, index };
}

// ---- body definition ----------------------------------------------------------
export const PART = { head: 0, neck: 1, chest: 2, spine: 3, hips: 4, upper: 5, fore: 6, hand: 7, thigh: 8, shin: 9, foot: 10 };
const BONE_PART = { head: 0, neck: 1, chest: 2, spine: 3, hips: 4, shL: 5, shR: 5, elL: 6, elR: 6, handL: 7, handR: 7, thL: 8, thR: 8, knL: 9, knR: 9, ankL: 10, ankR: 10 };
const GROUP = { head: 'torso', neck: 'torso', chest: 'torso', spine: 'torso', hips: 'torso', shL: 'armL', elL: 'armL', handL: 'armL', shR: 'armR', elR: 'armR', handR: 'armR', thL: 'legL', knL: 'legL', ankL: 'legL', thR: 'legR', knR: 'legR', ankR: 'legR' };
const ALLOWED = {
  torso: ['head', 'neck', 'chest', 'spine', 'hips', 'shL', 'shR', 'thL', 'thR'],
  armL: ['shL', 'elL', 'handL', 'chest'], armR: ['shR', 'elR', 'handR', 'chest'],
  legL: ['thL', 'knL', 'ankL', 'hips'], legR: ['thR', 'knR', 'ankR', 'hips'],
};
export const A_POSE = { shL: [0, 0, 0.5], shR: [0, 0, -0.5], thL: [0, 0, 0.07], thR: [0, 0, -0.07], elL: [-0.12, 0, 0], elR: [-0.12, 0, 0] };

export function applyAPose(rig) {
  for (const n in rig.j) rig.j[n].rotation.set(0, 0, 0);
  for (const [n, r] of Object.entries(A_POSE)) rig.j[n].rotation.set(...r);
  rig.body.updateMatrixWorld(true);
}

function jointPos(rig) {
  const inv = new THREE.Matrix4().copy(rig.body.matrixWorld).invert();
  const P = {};
  for (const n in rig.j) P[n] = new THREE.Vector3().setFromMatrixPosition(rig.j[n].matrixWorld).applyMatrix4(inv);
  const tip = (n, local) => new THREE.Vector3().copy(local).applyMatrix4(rig.j[n].matrixWorld).applyMatrix4(inv);
  P.handTipL = tip('handL', new THREE.Vector3(0, -0.15, 0.01)); P.handTipR = tip('handR', new THREE.Vector3(0, -0.15, 0.01));
  P.toeL = tip('ankL', new THREE.Vector3(0, -0.07, 0.17)); P.toeR = tip('ankR', new THREE.Vector3(0, -0.07, 0.17));
  P.headTop = tip('head', new THREE.Vector3(0, 0.24, 0));
  return P;
}

function buildPrims(P, o) {
  const b = o.bulk, m = o.muscle, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lb = o.venom ? 1 + (b - 1) * 0.4 : b; // lower body bulk
  const H = P.hips, C = P.chest, Hd = P.head;
  const pr = [];
  // torso
  pr.push(ellipsoid(H.clone().add(V(0, 0.0, 0)), V(0.15 * lb, 0.12, 0.11 * lb), 0.05));
  for (const s of [-1, 1]) pr.push(ellipsoid(H.clone().add(V(s * 0.066 * lb, -0.05, -0.05)), V(0.08 * lb, 0.095, 0.07 * lb), 0.04));
  pr.push(capsule(H.clone().add(V(0, 0.06, 0.005)), C.clone().add(V(0, 0.02, 0.01)), 0.125 * b * o.waist, 0.135 * b, 0.06));
  pr.push(ellipsoid(C.clone().add(V(0, 0.12, -0.005)), V(0.175 * b, 0.165, 0.115 * b), 0.06));
  for (const s of [-1, 1]) {
    pr.push(ellipsoid(C.clone().add(V(s * 0.078 * b, 0.155, 0.055 * b)), V(0.085 * b * m, 0.075 * m, 0.055 * m), 0.035)); // pecs
    pr.push(ellipsoid(C.clone().add(V(s * 0.12 * b, 0.08, -0.03)), V(0.075 * b * m, 0.13, 0.08 * m), 0.05)); // lats
    pr.push(capsule(P.neck.clone().add(V(0, -0.02, -0.02)), P['sh' + (s > 0 ? 'L' : 'R')].clone().add(V(-s * 0.02, 0.03, -0.01)), 0.055 * m, 0.05 * m, 0.05)); // traps
    // abs
    for (let r = 0; r < 3; r++) pr.push(ellipsoid(H.clone().lerp(C, 0.35 + r * 0.25).add(V(s * 0.035 * b, 0.07, 0.085 * b)), V(0.036 * m, 0.04, 0.035), 0.03));
  }
  // neck & head
  pr.push(capsule(P.neck.clone().add(V(0, -0.02, -0.005)), Hd.clone().add(V(0, 0.04, 0.0)), 0.058 * (0.9 + b * 0.1), 0.052, 0.04));
  const hs = o.head;
  pr.push(ellipsoid(Hd.clone().add(V(0, 0.115 * hs, 0.005)), V(0.09 * hs, 0.118 * hs, 0.103 * hs), 0.03));
  pr.push(ellipsoid(Hd.clone().add(V(0, 0.055 * hs, 0.035 * hs)), V(0.066 * hs, 0.07 * hs, 0.07 * hs), 0.04)); // jaw
  if (o.venom) pr.push(ellipsoid(Hd.clone().add(V(0, 0.07, 0.07)), V(0.075, 0.05, 0.06), 0.04));
  // limbs
  for (const s of ['L', 'R']) {
    const sh = P['sh' + s], el = P['el' + s], ha = P['hand' + s], ht = P['handTip' + s];
    const th = P['th' + s], kn = P['kn' + s], an = P['ank' + s], toe = P['toe' + s];
    pr.push(ellipsoid(sh.clone().add(V(0, 0.005, 0)), V(0.075 * b * m, 0.07 * m, 0.07 * b * m), 0.04)); // deltoid
    pr.push(capsule(sh, el, 0.056 * b, 0.043 * b, 0.03));
    pr.push(ellipsoid(sh.clone().lerp(el, 0.5).add(V(0, 0, 0.022)), V(0.045 * m, 0.08, 0.042 * m), 0.03)); // bicep
    pr.push(capsule(el, ha, 0.046 * b, 0.031, 0.025));
    pr.push(ellipsoid(el.clone().lerp(ha, 0.28), V(0.047 * m, 0.07, 0.045 * m), 0.03)); // forearm
    pr.push(capsule(ha.clone().lerp(ht, 0.1), ha.clone().lerp(ht, 0.55), 0.036, 0.034, 0.02)); // palm
    pr.push(capsule(ha.clone().lerp(ht, 0.55), ht, 0.032, 0.022, 0.02)); // fingers (mitten)
    pr.push(capsule(th.clone().add(V(0, 0.03, 0)), kn, 0.085 * lb, 0.055 * lb, 0.05));
    pr.push(ellipsoid(th.clone().lerp(kn, 0.45).add(V(0, 0, 0.028)), V(0.068 * lb * Math.min(m, 1.2), 0.16, 0.062 * Math.min(m, 1.2)), 0.04)); // quad
    pr.push(capsule(kn, an, 0.052 * lb, 0.033, 0.025));
    pr.push(ellipsoid(kn.clone().lerp(an, 0.28).add(V(0, 0, -0.032)), V(0.05 * m, 0.1, 0.05 * m), 0.035)); // calf
    pr.push(capsule(an.clone().add(V(0, -0.035, -0.035)), toe, 0.042, 0.032, 0.025)); // foot
  }
  return pr;
}

function segList(P) {
  const S = [];
  const add = (name, a, b) => S.push({ name, a: P[a] || a, b: P[b] || b });
  add('hips', 'hips', 'spine'); add('spine', 'spine', 'chest'); add('chest', 'chest', 'neck'); add('neck', 'neck', 'head'); add('head', 'head', 'headTop');
  for (const s of ['L', 'R']) { add('sh' + s, 'sh' + s, 'el' + s); add('el' + s, 'el' + s, 'hand' + s); add('hand' + s, 'hand' + s, 'handTip' + s); add('th' + s, 'th' + s, 'kn' + s); add('kn' + s, 'kn' + s, 'ank' + s); add('ank' + s, 'ank' + s, 'toe' + s); }
  return S;
}
function segDist(p, s, out) {
  const ab = out.ab || (out.ab = new THREE.Vector3()); ab.subVectors(s.b, s.a);
  let t = ab.dot(new THREE.Vector3().subVectors(p, s.a)) / ab.lengthSq(); t = Math.max(0, Math.min(1, t));
  out.t = t; out.len = ab.length();
  const q = s.a.clone().addScaledVector(ab, t); out.d = p.distanceTo(q); out.q = q;
  return out.d;
}

export function buildBodyGeometry(rig, o) {
  const key = o.key;
  if (CACHE.has(key)) return CACHE.get(key);
  applyAPose(rig);
  const P = jointPos(rig);
  const prims = buildPrims(P, o);
  const min = new THREE.Vector3(1e9, 1e9, 1e9), max = new THREE.Vector3(-1e9, -1e9, -1e9);
  for (const p of prims) { min.min(p.min); max.max(p.max); }
  const sdf = (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < prims.length; i++) {
      const p = prims[i];
      if (x < p.min.x || y < p.min.y || z < p.min.z || x > p.max.x || y > p.max.y || z > p.max.z) continue;
      d = smin(d, p.f(x, y, z), p.k);
    }
    return d === 1e9 ? 1 : d;
  };
  const step = o.step || 0.0145;
  const { pos, index } = surfaceNets(sdf, min, max, step);
  const nV = pos.length / 3;
  // normals from SDF gradient
  const nor = new Float32Array(nV * 3), e = step * 0.5;
  for (let i = 0; i < nV; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const nx = sdf(x + e, y, z) - sdf(x - e, y, z), ny = sdf(x, y + e, z) - sdf(x, y - e, z), nz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(nx, ny, nz) || 1; nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = nz / l;
  }
  // fix winding against normals
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az, vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * nor[a * 3] + fy * nor[a * 3 + 1] + fz * nor[a * 3 + 2] < 0) { index[t + 1] = c; index[t + 2] = b; }
  }
  // skinning + pattern coordinates
  const boneNames = Object.keys(rig.j);
  const segs = segList(P);
  const skinI = new Uint16Array(nV * 4), skinW = new Float32Array(nV * 4);
  const part = new Float32Array(nV), web = new Float32Array(nV * 2), limbT = new Float32Array(nV);
  const p = new THREE.Vector3(), tmp = {};
  const chestFocal = P.chest.clone().add(new THREE.Vector3(0, 0.14, 0));
  const faceFocal = P.head.clone().add(new THREE.Vector3(0, 0.125, 0));
  for (let i = 0; i < nV; i++) {
    p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const ds = segs.map(s => ({ s, d: segDist(p, s, tmp), t: tmp.t, len: tmp.len, q: tmp.q }));
    ds.sort((x, y) => x.d - y.d);
    const near = ds[0];
    const allow = ALLOWED[GROUP[near.s.name]];
    const cand = ds.filter(x => allow.includes(x.s.name)).slice(0, 4);
    let sum = 0; const ws = cand.map(c => { const w = 1 / Math.pow(Math.max(c.d - near.d, 0) + 0.012, 3); sum += w; return w; });
    cand.forEach((c, k) => { skinI[i * 4 + k] = boneNames.indexOf(c.s.name); skinW[i * 4 + k] = ws[k] / sum; });
    const pt = BONE_PART[near.s.name]; part[i] = pt; limbT[i] = near.t;
    // pattern coords
    if (pt === 0 || pt === 1) { web[i * 2] = Math.atan2(p.x - faceFocal.x, p.y - faceFocal.y) / (Math.PI * 2); web[i * 2 + 1] = Math.hypot(p.x - faceFocal.x, p.y - faceFocal.y, Math.min(0, p.z) * 0.8); }
    else if (pt <= 4) { const f = chestFocal; web[i * 2] = Math.atan2(p.x - f.x, p.y - f.y) / (Math.PI * 2); web[i * 2 + 1] = Math.hypot(p.x - f.x, p.y - f.y); }
    else {
      const ax = new THREE.Vector3().subVectors(near.s.b, near.s.a).normalize();
      const r = p.clone().sub(near.q); const ref = new THREE.Vector3(0, 0, 1).addScaledVector(ax, -ax.z).normalize(); const side = new THREE.Vector3().crossVectors(ax, ref);
      web[i * 2] = Math.atan2(r.dot(side), r.dot(ref)) / (Math.PI * 2);
      web[i * 2 + 1] = (near.t * near.len + ({ 5: 0, 6: 0.3, 7: 0.57, 8: 0, 9: 0.44, 10: 0.87 })[pt]) * 0.42;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(skinI, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinW, 4));
  g.setAttribute('aWeb', new THREE.BufferAttribute(web, 2));
  g.setAttribute('aRest', new THREE.Float32BufferAttribute(pos.slice(), 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  const res = { geo: g, part, limbT, P, nV };
  CACHE.set(key, res);
  return res;
}

// ---- suit coloring (per-vertex region colors) --------------------------------
function regionColors(res, suit, o) {
  const { part, limbT, nV, geo } = res, rest = geo.attributes.aRest.array;
  const col = new Float32Array(nV * 3), mask = new Float32Array(nV * 2);
  const c = k => new THREE.Color(k);
  const P = c(suit.base), S = c(suit.second), A = c(suit.accent), skin = c(suit.skin || '#a0765a'), shoe = c(suit.shoes || '#15161a');
  const chestX = 0.105 * o.bulk;
  for (let i = 0; i < nV; i++) {
    const pt = part[i], t = limbT[i], x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    let cc = P, line = 1, glow = 0;
    if (suit.layout === 'civ') {
      line = 0;
      cc = pt <= 1 ? (suit.mask && !(pt === 0 && y > res.P.head.y + 0.1 && y < res.P.head.y + 0.15 && z > 0.05) ? c(suit.maskCol || '#1a1a1c') : skin)
        : pt === 7 ? (suit.gloves ? c('#1a1a1a') : skin) : pt === 10 ? shoe : pt >= 8 || pt === 4 ? S : pt === 6 && t > 0.7 && !suit.longSleeve ? skin : P;
      if (suit.vest && (pt === 2 || pt === 3)) cc = A;
    } else if (suit.layout === 'spider') {
      const center = Math.abs(x) < chestX + (pt === 3 ? -0.02 : 0);
      if (pt === 2 || pt === 3) cc = center ? P : S;
      else if (pt === 4 || pt === 8) cc = S;
      else if (pt === 9) cc = t > 0.55 ? P : S;
      else if (pt === 5) cc = t < 0.3 ? P : (z > 0 ? S : P);
      else cc = P;
      line = cc === P ? 1 : 0.45;
    } else if (suit.layout === 'volt') {
      cc = pt === 5 || pt === 8 ? S : P; line = 1;
      glow = (pt === 6 || pt === 9) && t > 0.4 && t < 0.46 ? 1 : 0;
      if ((pt === 2 || pt === 3) && Math.abs(Math.abs(x) - 0.12) < 0.006) glow = 1;
    } else if (suit.layout === 'armor') {
      const center = Math.abs(x) < chestX;
      cc = (pt === 2 && center) || pt === 0 || pt === 1 || pt === 6 || pt === 7 || (pt === 9 && t > 0.5) || pt === 10 ? P : S;
      if ((pt === 5 && t < 0.35) || (pt === 6 && t > 0.2 && t < 0.6)) cc = A;
      line = cc === P ? 1 : 0.3;
    } else { // symbiote
      cc = P; line = 0;
    }
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    mask[i * 2] = line; mask[i * 2 + 1] = glow;
  }
  return { col, mask };
}

const SUIT_GLSL_PARS = /* glsl */`
attribute vec2 aWeb; attribute vec3 aRest; attribute vec2 aMask;
varying vec2 vWeb; varying vec3 vRest; varying vec2 vMask;`;
const SUIT_FRAG_PARS = /* glsl */`
varying vec2 vWeb; varying vec3 vRest; varying vec2 vMask;
uniform vec3 uLine; uniform float uLineAmt; uniform vec3 uGlowCol; uniform float uGlow; uniform float uTime;
uniform vec3 uEmbC; uniform float uEmbS; uniform vec3 uEmbCol; uniform float uEmbGlow; uniform float uSymb; uniform float uFabric; uniform float uPlates; uniform float uHit;
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float sdEl(vec2 p, vec2 r){ return (length(p/r)-1.0)*min(r.x,r.y); }
float spider(vec2 p){
  p.x = abs(p.x);
  float d = sdEl(p-vec2(0.,0.02), vec2(0.15,0.32));
  d = min(d, sdEl(p-vec2(0.,0.44), vec2(0.11,0.13)));
  float w = 0.042;
  d = min(d, min(sdSeg(p,vec2(.08,.36),vec2(.42,.72)), sdSeg(p,vec2(.42,.72),vec2(.5,1.02)))-w);
  d = min(d, min(sdSeg(p,vec2(.1,.2),vec2(.58,.42)), sdSeg(p,vec2(.58,.42),vec2(.8,.78)))-w);
  d = min(d, min(sdSeg(p,vec2(.1,.0),vec2(.58,-.24)), sdSeg(p,vec2(.58,-.24),vec2(.78,-.62)))-w);
  d = min(d, min(sdSeg(p,vec2(.08,-.14),vec2(.42,-.58)), sdSeg(p,vec2(.42,-.58),vec2(.48,-.98)))-w);
  return d;
}
float hash3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z); }
vec3 bumpN(vec3 surf_pos, vec3 surf_norm, float h, float faceDirection){
  vec2 dHdxy = vec2(dFdx(h), dFdy(h));
  vec3 vSigmaX = normalize(dFdx(surf_pos)); vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
float gLine = 0.0; float gEmb = 0.0; float gH = 0.0;
void computeSuit(){
  float N = 16.0;
  float a = vWeb.x * N; float fa = abs(fract(a + 0.5) - 0.5);
  float fwA = min(fwidth(a), fwidth(fract(a))) + 1e-4;
  float r = vWeb.y / 0.034 + 0.22 * abs(sin(vWeb.x * N * 3.14159));
  float fr = abs(fract(r + 0.5) - 0.5); float fwR = fwidth(r) + 1e-4;
  float wa = 0.055 * max(1.0, 0.03 / max(vWeb.y, 0.006));
  float la = 1.0 - smoothstep(wa - fwA, wa + fwA, fa);
  float lr = 1.0 - smoothstep(0.06 - fwR, 0.06 + fwR, fr);
  float fade = 1.0 - smoothstep(0.25, 0.6, max(fwA, fwR));
  gLine = max(la, lr) * vMask.x * uLineAmt * fade;
  if (uPlates > 0.5) { float px = abs(fract(vWeb.x*8.0+0.5)-0.5), py = abs(fract(vWeb.y/0.07+0.5)-0.5); gLine = max(gLine*0.5, (1.0 - smoothstep(0.03, 0.06, min(px*2.0, py))) * vMask.x * fade); }
  // emblem (front small, back large)
  vec2 ep = vec2(vRest.x, vRest.y - uEmbC.y);
  float front = step(0.0, vRest.z);
  float s = mix(uEmbS * 1.25, uEmbS, front);
  float d = spider(ep / s) * s;
  float fw = fwidth(d) + 1e-5;
  float torso = step(abs(vRest.y - uEmbC.y), s * 1.3) * step(0.04, abs(vRest.z));
  gEmb = (1.0 - smoothstep(-fw, fw, d)) * torso * step(0.001, uEmbS);
  float fab = uFabric * (noise3(vRest * 380.0) * 0.5 + noise3(vRest * 90.0) * 0.5) * (1.0 - smoothstep(0.0, 0.004, length(fwidth(vRest))));
  gH = gLine * 0.7 + gEmb * 0.35 + fab * 0.25;
}`;

export function makeSuitMaterial(res, suit, o) {
  const { col, mask } = regionColors(res, suit, o);
  const geo = new THREE.BufferGeometry();
  for (const [k, v] of Object.entries(res.geo.attributes)) geo.setAttribute(k, v);
  geo.setIndex(res.geo.index); geo.boundingSphere = res.geo.boundingSphere;
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 2));
  const symb = suit.layout === 'symbiote';
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: suit.rough ?? 0.5, metalness: suit.metal ?? 0.1,
    clearcoat: symb ? 1 : suit.layout === 'civ' ? 0 : 0.35, clearcoatRoughness: symb ? 0.12 : 0.4,
    sheen: suit.layout === 'civ' ? 0.6 : 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(symb ? '#4a3a90' : suit.layout === 'civ' ? '#666' : suit.accent),
  });
  const U = {
    uLine: { value: new THREE.Color(suit.line || '#000') }, uLineAmt: { value: suit.layout === 'civ' || symb ? 0 : 1 },
    uGlowCol: { value: new THREE.Color(suit.accent || '#000') }, uGlow: { value: suit.glow || 0 }, uTime: { value: 0 },
    uEmbC: { value: res.P.chest.clone().add(new THREE.Vector3(0, 0.14, 0)) }, uEmbS: { value: suit.emblem === false ? 0 : (symb ? 0.2 : 0.085) * o.bulk },
    uEmbCol: { value: new THREE.Color(suit.emblemCol || suit.line || '#000') }, uEmbGlow: { value: suit.emblemGlow || 0 },
    uSymb: { value: symb ? 1 : 0 }, uFabric: { value: suit.layout === 'civ' ? 1.0 : 0.7 }, uPlates: { value: suit.layout === 'armor' ? 1 : 0 }, uHit: { value: 0 },
  };
  mat.userData.u = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SUIT_GLSL_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWeb = aWeb; vRest = aRest; vMask = aMask;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + SUIT_FRAG_PARS)
      .replace('#include <color_fragment>', `#include <color_fragment>
        computeSuit();
        diffuseColor.rgb = mix(diffuseColor.rgb, uLine, gLine * 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, uEmbCol, gEmb);
        if (uSymb > 0.5) { float n = noise3(vRest * 14.0 + vec3(0., uTime * 0.6, 0.)); diffuseColor.rgb += vec3(0.05, 0.04, 0.12) * smoothstep(0.55, 0.9, n); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, gLine);
        if (uSymb > 0.5) roughnessFactor = mix(0.08, 0.35, noise3(vRest * 22.0 + uTime * 0.3));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpN(-vViewPosition, normal, gH * 0.006, faceDirection);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlowCol * uGlow * (gLine * 0.12 + vMask.y * 0.9);
        totalEmissiveRadiance += uEmbCol * uEmbGlow * gEmb * 0.35;
        totalEmissiveRadiance += vec3(1.0, 0.25, 0.2) * uHit;`);
  };
  mat.customProgramCacheKey = () => 'suit-v1';
  return { geo, mat };
}
