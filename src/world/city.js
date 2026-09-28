import * as THREE from 'three';
import { facadeSet, groundTextures, billboardTexture, rng, storefrontTextures, radialTexture, canvas, tex } from './textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Scaled-down Manhattan: avenues run north-south (Z), streets east-west (X). North is -Z.
export const AVES = []; for (let i = 0; i <= 10; i++) AVES.push(-480 + i * 96);
export const STREETS = []; for (let j = 0; j <= 40; j++) STREETS.push(-1100 + j * 50);
export const AVE_W = 20, ST_W = 12;
export const ISLAND = { minX: -520, maxX: 520, minZ: -1120, maxZ: 920 };
export const PARK = { minX: -182, maxX: 86, minZ: -1044, maxZ: -656 };
export const TIMES_SQ = { minX: -86, maxX: -10, minZ: -394, maxZ: -306 };
export const LANDMARKS = {
  empire: new THREE.Vector3(48, 0, -175), chrysler: new THREE.Vector3(144, 0, -275),
  wardenTower: new THREE.Vector3(-336, 0, 375), timesSquare: new THREE.Vector3(-48, 0, -350),
  park: new THREE.Vector3(-48, 0, -850), bridge: new THREE.Vector3(720, 25, 625),
  dock: new THREE.Vector3(-500, 0, 700), fidi: new THREE.Vector3(144, 0, 725), village: new THREE.Vector3(0, 0, 200),
  jumaHome: new THREE.Vector3(240, 0, 75),
};

class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  quad(a, b, c, d, n, uvs) {
    for (const [p, t] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]], [a, uvs[0]], [c, uvs[2]], [d, uvs[3]]]) { this.pos.push(...p); this.nor.push(...n); this.uv.push(...t); }
  }
  // Box walls with world-scaled UVs (1 tile = 16m x 16m), plus optional roof into another builder
  box(x0, y0, z0, x1, y1, z1, roof, uo = 0, vo = 0, U = 16, V = 16) {
    const u = (a) => a / U + uo, v = (b) => b / V + vo;
    const w = x1 - x0, d = z1 - z0;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[u(0), v(y0)], [u(w), v(y0)], [u(w), v(y1)], [u(0), v(y1)]]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[u(0), v(y0)], [u(w), v(y0)], [u(w), v(y1)], [u(0), v(y1)]]);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[u(0), v(y0)], [u(d), v(y0)], [u(d), v(y1)], [u(0), v(y1)]]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[u(0), v(y0)], [u(d), v(y0)], [u(d), v(y1)], [u(0), v(y1)]]);
    if (roof) roof.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[x0 / 8, z1 / 8], [x1 / 8, z1 / 8], [x1 / 8, z0 / 8], [x0 / 8, z0 / 8]]);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

function heightFor(x, z, r) {
  let base, vari;
  if (z < -1050) { base = 25; vari = 35; }
  else if (z < -600) { base = 30; vari = 50; }
  else if (z < -120) { base = 70; vari = 140; }
  else if (z < 460) { base = 16; vari = 34; }
  else { base = 70; vari = 150; }
  let h = base + Math.pow(r(), 1.6) * vari;
  if (Math.abs(x) > 400) h *= 0.75;
  if (r() < 0.04 && (z < -120 && z > -600 || z > 460)) h += 120;
  return Math.round(h / 4) * 4;
}

export function buildCity(scene, col, envMapRef) {
  const r = rng(1337);
  const T = groundTextures();
  const styles = ['glass', 'darkglass', 'stone', 'brick', 'concrete', 'deco'];
  const sets = styles.map((s, i) => facadeSet(s, 100 + i * 17));
  const facadeMats = sets.map((s, i) => new THREE.MeshStandardMaterial({
    map: s.map, roughnessMap: s.rm, metalnessMap: s.rm, roughness: 1, metalness: 1, normalMap: s.nm, normalScale: new THREE.Vector2(1.3, 1.3),
    emissiveMap: s.em, emissive: new THREE.Color(1, 0.85, 0.65), emissiveIntensity: 0,
  }));
  const builders = styles.map(() => new GeoBuilder());
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  const roofB = new GeoBuilder();
  const blocks = [], roofSpots = [], buildings = [];
  const waterTowers = [], acUnits = [], spires = [], awnings = [], antennas = [];
  const storeB = new GeoBuilder();
  const crownCols = [0xfff1d6, 0x6fe3ff, 0xff5ab4, 0xffc24a, 0x9c7bff];
  const crownB = crownCols.map(() => new GeoBuilder());

  const inRect = (x, z, R, m = 0) => x > R.minX - m && x < R.maxX + m && z > R.minZ - m && z < R.maxZ + m;
  const sidewalkB = new GeoBuilder();

  for (let i = 0; i < AVES.length - 1; i++) for (let j = 0; j < STREETS.length - 1; j++) {
    const bx0 = AVES[i] + AVE_W / 2, bx1 = AVES[i + 1] - AVE_W / 2, bz0 = STREETS[j] + ST_W / 2, bz1 = STREETS[j + 1] - ST_W / 2;
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    const block = { minX: bx0, maxX: bx1, minZ: bz0, maxZ: bz1, type: 'city' };
    blocks.push(block);
    if (inRect(cx, cz, PARK)) { block.type = 'park'; continue; }
    sidewalkB.box(bx0, 0, bz0, bx1, 0.25, bz1, sidewalkB, 0, 0, 4, 4);
    col.add(bx0, 0, bz0, bx1, 0.25, bz1, 'sidewalk');
    if (inRect(cx, cz, TIMES_SQ)) { block.type = 'plaza'; continue; }
    // lots
    const special = [LANDMARKS.empire, LANDMARKS.chrysler, LANDMARKS.wardenTower].find(p => Math.abs(p.x - cx) < 40 && Math.abs(p.z - cz) < 20);
    const lots = special ? 1 : 1 + Math.floor(r() * 3);
    const lw = (bx1 - bx0 - 6) / lots;
    for (let l = 0; l < lots; l++) {
      const x0 = bx0 + 3 + l * lw + (lots > 1 ? 0.6 : 0), x1 = x0 + lw - (lots > 1 ? 1.2 : 0);
      const z0 = bz0 + 3 + (r() < 0.3 ? r() * 4 : 0), z1 = bz1 - 3 - (r() < 0.3 ? r() * 4 : 0);
      let h = heightFor(cx, cz, r);
      let style = cz > 460 || (cz < -120 && cz > -600) ? (r() < 0.55 ? (r() < 0.5 ? 0 : 1) : 2 + Math.floor(r() * 4)) : (r() < 0.45 ? 3 : 2 + Math.floor(r() * 4));
      if (h < 40 && style < 2) style = 3;
      if (special === LANDMARKS.empire) { h = 260; style = 5; }
      if (special === LANDMARKS.chrysler) { h = 200; style = 5; }
      if (special === LANDMARKS.wardenTower) { h = 230; style = 1; }
      const b = builders[style], uo = Math.floor(r() * 4) * 0.25 * 0 + Math.floor(r() * 2), vo = Math.floor(r() * 2);
      const tiers = h > 150 ? 3 : h > 80 ? 2 : 1;
      let tx0 = x0, tx1 = x1, tz0 = z0, tz1 = z1, y = 0;
      const tierH = [h * (tiers === 1 ? 1 : tiers === 2 ? 0.72 : 0.55), h * (tiers === 2 ? 1 : 0.82), h];
      for (let t = 0; t < tiers; t++) {
        const top = tierH[t];
        b.box(tx0, y, tz0, tx1, top, tz1, roofB, uo, vo);
        if (t === 0) {
          storeB.box(tx0 - 0.06, 0.25, tz0 - 0.06, tx1 + 0.06, 4.6, tz1 + 0.06, null, r(), -0.0575, 32, 4.35);
          roofB.box(tx0 - 0.4, 4.6, tz0 - 0.4, tx1 + 0.4, 5.1, tz1 + 0.4, roofB, 0, 0, 8, 8);
          for (const side of [-1, 1]) for (let k = 0; k < 3; k++) if (r() < 0.45) {
            const w = 3 + r() * 4, cx2 = tx0 + 2 + r() * Math.max(0.1, tx1 - tx0 - 4 - w) + w / 2;
            awnings.push([cx2, side < 0 ? tz0 : tz1, w, side, (r() * 6) | 0]);
          }
        }
        // parapet ledge
        roofB.box(tx0 - 0.4, top, tz0 - 0.4, tx1 + 0.4, top + 0.8, tz1 + 0.4, null, 0, 0, 8, 8);
        col.add(tx0, y, tz0, tx1, top, tz1);
        const w = tx1 - tx0, d = tz1 - tz0;
        buildings.push({ minX: tx0, maxX: tx1, minZ: tz0, maxZ: tz1, h: top });
        if (t === tiers - 1) {
          roofSpots.push(new THREE.Vector3((tx0 + tx1) / 2, top, (tz0 + tz1) / 2));
          if (top < 70 && r() < 0.55) waterTowers.push([tx0 + 3 + r() * (w - 6), top, tz0 + 3 + r() * (d - 6)]);
          for (let k = 0; k < 2 + r() * 4; k++) acUnits.push([tx0 + 2 + r() * (w - 4), top, tz0 + 2 + r() * (d - 4), r() * 3]);
          if (w > 10 && d > 10) { const bx = tx0 + 2 + r() * (w - 8), bz = tz0 + 2 + r() * (d - 7); roofB.box(bx, top, bz, bx + 3.5 + r() * 2, top + 3 + r() * 1.5, bz + 3.5, roofB, 0, 0, 8, 8); col.add(bx, top, bz, bx + 3.5, top + 3, bz + 3.5, 'prop'); }
          if (top > 60 && r() < 0.35) antennas.push([tx0 + w * (0.2 + r() * 0.6), top, tz0 + d * (0.2 + r() * 0.6), 6 + r() * 14]);
          if (top > 95) { const cb = crownB[(r() * crownB.length) | 0]; cb.box(tx0 - 0.08, top - 3.2, tz0 - 0.08, tx1 + 0.08, top - 2.4, tz1 + 0.08, null); if (r() < 0.5) cb.box(tx0 - 0.08, top - 7.2, tz0 - 0.08, tx1 + 0.08, top - 6.8, tz1 + 0.08, null); }
          if (top > 120 && r() < 0.5 || special) spires.push([(tx0 + tx1) / 2, top, (tz0 + tz1) / 2, special === LANDMARKS.empire ? 60 : special === LANDMARKS.chrysler ? 45 : 15 + r() * 25, special === LANDMARKS.chrysler]);
        }
        y = top; const sx = w * 0.12, sz = d * 0.12;
        tx0 += sx; tx1 -= sx; tz0 += sz; tz1 -= sz;
      }
    }
  }
  const city = new THREE.Group(); city.name = 'city'; scene.add(city);
  builders.forEach((b, i) => {
    if (!b.pos.length) return;
    const m = new THREE.Mesh(b.geometry(), facadeMats[i]); m.castShadow = true; m.receiveShadow = true; city.add(m);
  });
  const roofMat = new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.92, color: 0x9a9690 });
  const roofMesh = new THREE.Mesh(roofB.geometry(), roofMat); roofMesh.receiveShadow = true; roofMesh.castShadow = true; city.add(roofMesh);
  const sf = storefrontTextures(77);
  const storeMat = new THREE.MeshStandardMaterial({ map: sf.map, emissiveMap: sf.em, emissive: new THREE.Color(1, 0.9, 0.75), emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.3 });
  const storeMesh = new THREE.Mesh(storeB.geometry(), storeMat); storeMesh.receiveShadow = true; city.add(storeMesh);
  const crownMats = crownCols.map(c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
  crownB.forEach((cb, i) => { if (cb.pos.length) city.add(new THREE.Mesh(cb.geometry(), crownMats[i])); });
  // awnings
  const awnGeo = new THREE.BoxGeometry(1, 0.12, 1.6); awnGeo.translate(0, 0, 0.8);
  const awnMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const awn = new THREE.InstancedMesh(awnGeo, awnMat, Math.max(1, awnings.length));
  const awnCols = [0x7a1d1d, 0x1d4a2a, 0x1d2f5a, 0x5a3a1d, 0x222222, 0x8a6a1d];
  awnings.forEach(([x, z, w, side, ci], i) => { m4.compose(new THREE.Vector3(x, 4.1, z), q.setFromEuler(new THREE.Euler(0.28 * -side * 0 + 0.28, side < 0 ? Math.PI : 0, 0)), new THREE.Vector3(w, 1, 1)); awn.setMatrixAt(i, m4); awn.setColorAt(i, new THREE.Color(awnCols[ci])); });
  awn.castShadow = true; city.add(awn);
  const antGeo = mergeGeometries([new THREE.CylinderGeometry(0.08, 0.2, 1, 6).translate(0, 0.5, 0), new THREE.BoxGeometry(1.2, 0.05, 0.05).translate(0, 0.7, 0), new THREE.BoxGeometry(0.8, 0.05, 0.05).translate(0, 0.85, 0)]);
  const ant = new THREE.InstancedMesh(antGeo, new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.8, roughness: 0.4 }), Math.max(1, antennas.length));
  antennas.forEach(([x, y, z, h], i) => { m4.compose(new THREE.Vector3(x, y, z), q.identity(), new THREE.Vector3(1, h, 1)); ant.setMatrixAt(i, m4); });
  city.add(ant);
  T.sidewalk.repeat.set(1, 1);
  const swMat = new THREE.MeshStandardMaterial({ map: T.sidewalk, roughness: 0.85 });
  const sw = new THREE.Mesh(sidewalkB.geometry(), swMat); sw.receiveShadow = true; city.add(sw);

  // Ground (asphalt) island
  T.asphalt.repeat.set(200, 200);
  T.asphaltN.repeat.set(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({ map: T.asphalt, normalMap: T.asphaltN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.9, metalness: 0.0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ISLAND.maxX - ISLAND.minX + 40, ISLAND.maxZ - ISLAND.minZ + 40), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, (ISLAND.minZ + ISLAND.maxZ) / 2); ground.receiveShadow = true; city.add(ground);
  // seawall
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.9 });
  const sea = new GeoBuilder();
  sea.box(ISLAND.minX - 22, -6, ISLAND.minZ - 20, ISLAND.minX - 18, 0.4, ISLAND.maxZ + 20, null, 0, 0, 4, 4);
  sea.box(ISLAND.maxX + 18, -6, ISLAND.minZ - 20, ISLAND.maxX + 22, 0.4, ISLAND.maxZ + 20, null, 0, 0, 4, 4);
  sea.box(ISLAND.minX - 22, -6, ISLAND.maxZ + 18, ISLAND.maxX + 22, 0.4, ISLAND.maxZ + 22, null, 0, 0, 4, 4);
  sea.box(ISLAND.minX - 22, -6, ISLAND.minZ - 22, ISLAND.maxX + 22, 0.4, ISLAND.minZ - 18, null, 0, 0, 4, 4);
  city.add(new THREE.Mesh(sea.geometry(), wallMat));

  // Road markings: yellow center lines on avenues, crosswalks
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6 });
  const lineGeo = [];
  for (const x of AVES) { const g = new THREE.PlaneGeometry(0.5, ISLAND.maxZ - ISLAND.minZ); g.rotateX(-Math.PI / 2); g.translate(x, 0.02, (ISLAND.maxZ + ISLAND.minZ) / 2); lineGeo.push(g); }
  city.add(new THREE.Mesh(mergeGeometries(lineGeo), lineMat));
  const dashGeo = []; const Lz = ISLAND.maxZ - ISLAND.minZ;
  for (const x of AVES) for (const o of [-5, 5]) { const g = new THREE.PlaneGeometry(0.9, Lz); g.rotateX(-Math.PI / 2); g.translate(x + o, 0.021, (ISLAND.maxZ + ISLAND.minZ) / 2); dashGeo.push(g); }
  T.dash.repeat.set(1, Lz / 9);
  city.add(new THREE.Mesh(mergeGeometries(dashGeo), new THREE.MeshStandardMaterial({ map: T.dash, transparent: true, depthWrite: false, roughness: 0.6 })));
  const crossMat = new THREE.MeshStandardMaterial({ map: T.cross, transparent: true, roughness: 0.7, depthWrite: false });
  const crossGeo = new THREE.PlaneGeometry(AVE_W, 4); crossGeo.rotateX(-Math.PI / 2);
  const crossInst = new THREE.InstancedMesh(crossGeo, crossMat, AVES.length * STREETS.length * 2);
  let ci = 0;
  for (const x of AVES) for (const z of STREETS) {
    if (inRect(x, z, PARK, -4)) continue;
    for (const sgn of [-1, 1]) { m4.compose(new THREE.Vector3(x, 0.03, z + sgn * (ST_W / 2 + 2)), q, s1); crossInst.setMatrixAt(ci++, m4); }
  }
  crossInst.count = ci; city.add(crossInst);

  // Park
  T.grass.repeat.set(40, 60);
  const grassMat = new THREE.MeshStandardMaterial({ map: T.grass, roughness: 0.95 });
  const park = new THREE.Mesh(new THREE.PlaneGeometry(PARK.maxX - PARK.minX, PARK.maxZ - PARK.minZ), grassMat);
  park.rotation.x = -Math.PI / 2; park.position.set((PARK.minX + PARK.maxX) / 2, 0.05, (PARK.minZ + PARK.maxZ) / 2); park.receiveShadow = true; city.add(park);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1b3140, roughness: 0.06, metalness: 0.6, normalMap: T.waterN, normalScale: new THREE.Vector2(0.35, 0.35) });
  T.waterN.repeat.set(60, 60);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMat);
  lake.rotation.x = -Math.PI / 2; lake.scale.set(70, 45, 1); lake.position.set(-40, 0.08, -930); city.add(lake);
  // Trees
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 5, 6); trunkGeo.translate(0, 2.5, 0);
  const lobes = []; const rr = rng(9);
  for (let k = 0; k < 7; k++) { const g = new THREE.IcosahedronGeometry(1.6 + rr() * 1.2, 2); const a = k / 7 * Math.PI * 2; g.translate(k === 0 ? 0 : Math.cos(a) * 1.9, 6.2 + (k === 0 ? 1.4 : rr() * 1.6), k === 0 ? 0 : Math.sin(a) * 1.9); lobes.push(g); }
  const canopyGeo = mergeGeometries(lobes);
  { const p = canopyGeo.attributes.position; for (let i = 0; i < p.count; i++) { const n = Math.sin(p.getX(i) * 3.1) * Math.cos(p.getZ(i) * 2.7) * Math.sin(p.getY(i) * 2.3) * 0.35; p.setXYZ(i, p.getX(i) * (1 + n * 0.3), p.getY(i) + n * 0.4, p.getZ(i) * (1 + n * 0.3)); } canopyGeo.computeVertexNormals(); }
  { const p = canopyGeo.attributes.position, cA = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const v = THREE.MathUtils.clamp((p.getY(i) - 4.5) / 4, 0.35, 1); cA.set([v, v, v], i * 3); } canopyGeo.setAttribute('color', new THREE.BufferAttribute(cA, 3)); }
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5d8a3a, roughness: 0.85, vertexColors: true });
  const treePos = [];
  for (let k = 0; k < 520; k++) {
    const x = PARK.minX + 6 + r() * (PARK.maxX - PARK.minX - 12), z = PARK.minZ + 6 + r() * (PARK.maxZ - PARK.minZ - 12);
    if (((x + 40) / 72) ** 2 + ((z + 930) / 47) ** 2 < 1) continue;
    treePos.push([x, z, 0.8 + r() * 0.7]);
  }
  // street trees in the village
  for (const b of blocks) if (b.type === 'city' && b.minZ > -100 && b.maxZ < 460) for (let x = b.minX + 6; x < b.maxX - 4; x += 14) { treePos.push([x, b.minZ + 1.5, 0.55]); treePos.push([x, b.maxZ - 1.5, 0.55]); }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePos.length), leaves = new THREE.InstancedMesh(canopyGeo, leafMat, treePos.length);
  const tcol = new THREE.Color();
  treePos.forEach(([x, z, s], i) => {
    m4.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(i, m4); leaves.setMatrixAt(i, m4);
    leaves.setColorAt(i, tcol.setHSL(0.24 + r() * 0.08, 0.45 + r() * 0.2, 0.28 + r() * 0.12));
  });
  trunks.castShadow = leaves.castShadow = true; leaves.receiveShadow = true;
  city.add(trunks, leaves);

  // Rivers
  const river = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), waterMat);
  river.rotation.x = -Math.PI / 2; river.position.set(0, -1.6, 0); city.add(river);
  // Far shore silhouettes (Brooklyn / NJ)
  const farB = new GeoBuilder();
  for (const side of [-1, 1]) for (let z = -1400; z < 1300; z += 30 + r() * 30) {
    const x = side * (900 + r() * 200), w = 20 + r() * 30, h = 10 + Math.pow(r(), 2) * 90;
    farB.box(x - w / 2, -2, z, x + w / 2, h, z + 20 + r() * 20, null, Math.floor(r() * 4), 0);
  }
  const farMesh = new THREE.Mesh(farB.geometry(), facadeMats[4]); city.add(farMesh);

  // Rooftop props
  const wtGeo = mergeGeometries([
    new THREE.CylinderGeometry(2.2, 2.2, 4, 12).translate(0, 5.5, 0),
    new THREE.ConeGeometry(2.5, 1.8, 12).translate(0, 8.4, 0),
    new THREE.CylinderGeometry(0.15, 0.15, 3.5, 4).translate(1.6, 1.75, 1.6),
    new THREE.CylinderGeometry(0.15, 0.15, 3.5, 4).translate(-1.6, 1.75, 1.6),
    new THREE.CylinderGeometry(0.15, 0.15, 3.5, 4).translate(1.6, 1.75, -1.6),
    new THREE.CylinderGeometry(0.15, 0.15, 3.5, 4).translate(-1.6, 1.75, -1.6),
  ]);
  const wtMat = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.95 });
  const wt = new THREE.InstancedMesh(wtGeo, wtMat, waterTowers.length);
  waterTowers.forEach(([x, y, z], i) => { m4.compose(new THREE.Vector3(x, y, z), q.identity(), s1); wt.setMatrixAt(i, m4); col.add(x - 2.2, y, z - 2.2, x + 2.2, y + 9, z + 2.2, 'prop'); });
  wt.castShadow = true; city.add(wt);
  const acGeo = new THREE.BoxGeometry(3, 1.6, 2.2); acGeo.translate(0, 0.8, 0);
  const acMat = new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.5, metalness: 0.6 });
  const ac = new THREE.InstancedMesh(acGeo, acMat, acUnits.length);
  acUnits.forEach(([x, y, z, a], i) => { m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(new THREE.Euler(0, a, 0)), s1); ac.setMatrixAt(i, m4); });
  ac.castShadow = true; city.add(ac);
  const spireMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.9, roughness: 0.25 });
  const decoMat = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.18 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3020 });
  for (const [x, y, z, h, deco] of spires) {
    if (deco) {
      for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(2 + (4 - k) * 2.2, 3 + (4 - k) * 2.4, 7, 16, 1, false, 0, Math.PI * 2), decoMat); c.position.set(x, y + 3.5 + k * 7, z); city.add(c); }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(1.2, 20, 12), decoMat); tip.position.set(x, y + 45, z); city.add(tip);
    } else {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.8, h, 10), spireMat); c.position.set(x, y + h / 2, z); c.castShadow = true; city.add(c);
    }
    const bcn = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), beaconMat); bcn.position.set(x, y + h + 0.5, z); city.add(bcn);
  }

  // Times Square billboards: big emissive panels on buildings facing the plaza
  const billboards = [];
  const words = ['JUMA COLA', 'BROADWAY', 'NEON NIGHTS', 'DAILY BUGLE', 'OSCORP', 'SPIDER-MEN!', 'ROXXON', 'HAMMER TECH', 'MIDTOWN', 'SYMBIO?'];
  let wi = 0;
  const addBoard = (x, y, z, w, h, rotY) => {
    const t = billboardTexture(500 + wi, words[wi % words.length]); wi++;
    const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
    m.color.setScalar(1.6);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = rotY; city.add(p); billboards.push(p);
  };
  for (let k = 0; k < 4; k++) {
    addBoard(TIMES_SQ.minX - 13.5, 14 + k * 13, TIMES_SQ.minZ + 20 + (k % 2) * 40, 22, 11, Math.PI / 2);
    addBoard(TIMES_SQ.maxX + 13.5, 14 + k * 13, TIMES_SQ.minZ + 30 + (k % 2) * 30, 22, 11, -Math.PI / 2);
  }
  addBoard(-48, 30, TIMES_SQ.minZ - 9.5, 40, 20, 0);
  addBoard(-48, 26, TIMES_SQ.maxZ + 9.5, 40, 20, Math.PI);

  // Street lamps (instanced) along avenues
  const lampGeo = mergeGeometries([new THREE.CylinderGeometry(0.12, 0.18, 8, 6).translate(0, 4, 0), new THREE.BoxGeometry(2.2, 0.15, 0.2).translate(1.1, 8, 0)]);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c3034, metalness: 0.7, roughness: 0.4 });
  const headGeo = new THREE.BoxGeometry(0.9, 0.2, 0.5); headGeo.translate(2.0, 7.85, 0);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0 });
  const lampPts = [];
  for (const b of blocks) if (b.type === 'city') for (let z = b.minZ + 4; z < b.maxZ; z += 18) { lampPts.push([b.minX + 1, z, 0]); lampPts.push([b.maxX - 1, z, Math.PI]); }
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampPts.length), heads = new THREE.InstancedMesh(headGeo, headMat, lampPts.length);
  lampPts.forEach(([x, z, a], i) => { m4.compose(new THREE.Vector3(x, 0.25, z), q.setFromEuler(new THREE.Euler(0, a, 0)), s1); lamps.setMatrixAt(i, m4); heads.setMatrixAt(i, m4); });
  city.add(lamps, heads);

  // Light pools under street lamps (additive decals)
  const poolGeo = new THREE.PlaneGeometry(14, 14); poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false, fog: true });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampPts.length);
  lampPts.forEach(([x, z, a], i) => { m4.compose(new THREE.Vector3(x + Math.cos(a) * 2.2, 0.06, z - Math.sin(a) * 2.2), q.identity(), s1); pools.setMatrixAt(i, m4); });
  pools.renderOrder = 2; city.add(pools);
  // Traffic signals at intersections
  const sigGeo = mergeGeometries([new THREE.CylinderGeometry(0.12, 0.15, 6, 8).translate(0, 3, 0), new THREE.BoxGeometry(0.12, 0.12, 7).translate(0, 5.8, -3.5), new THREE.BoxGeometry(0.45, 1.2, 0.4).translate(0, 5.2, -6.5)]);
  const sigMat = new THREE.MeshStandardMaterial({ color: 0x2a2e2a, metalness: 0.6, roughness: 0.5 });
  const sigPts = [];
  for (let i = 1; i < AVES.length - 1; i++) for (let j = 1; j < STREETS.length - 1; j++) { const x = AVES[i], z = STREETS[j]; if (inRect(x, z, PARK, 10)) continue; sigPts.push([x, z]); }
  const sig = new THREE.InstancedMesh(sigGeo, sigMat, sigPts.length * 2);
  const lampGeo2 = new THREE.SphereGeometry(0.16, 8, 6);
  const sigLights = new THREE.InstancedMesh(lampGeo2, new THREE.MeshBasicMaterial({ toneMapped: false }), sigPts.length * 2);
  sigPts.forEach(([x, z], i) => {
    const head = new THREE.Vector3(0, 5.45, -6.5 + 0.25);
    m4.compose(new THREE.Vector3(x + AVE_W / 2 + 0.8, 0.25, z + ST_W / 2 + 0.8), q.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), s1); sig.setMatrixAt(i * 2, m4);
    m4.compose(head.clone().applyMatrix4(m4), q.identity(), s1); sigLights.setMatrixAt(i * 2 + 1, m4);
    m4.compose(new THREE.Vector3(x - AVE_W / 2 - 0.8, 0.25, z - ST_W / 2 - 0.8), q.setFromEuler(new THREE.Euler(0, Math.PI, 0)), s1); sig.setMatrixAt(i * 2 + 1, m4);
    m4.compose(head.clone().applyMatrix4(m4), q.identity(), s1); sigLights.setMatrixAt(i * 2, m4);
  });
  city.add(sig, sigLights);
  const cRed = new THREE.Color(3, 0.15, 0.1), cGreen = new THREE.Color(0.2, 3, 0.8), cYellow = new THREE.Color(3, 1.8, 0.1);
  let lastPhase = -1;
  const setSignals = (phase) => { // phase 0 ave green,1 ave yellow,2 street green,3 street yellow
    const ave = phase === 0 ? cGreen : phase === 1 ? cYellow : cRed, st = phase === 2 ? cGreen : phase === 3 ? cYellow : cRed;
    for (let i = 0; i < sigPts.length; i++) { sigLights.setColorAt(i * 2, st); sigLights.setColorAt(i * 2 + 1, ave); }
    sigLights.instanceColor.needsUpdate = true;
  };
  // Steam vents (NYC street stacks)
  const steamVents = [];
  const ventTex = (() => { const [c, g] = canvas(32, 128); for (let y = 0; y < 128; y += 32) { g.fillStyle = '#e8641c'; g.fillRect(0, y, 32, 16); g.fillStyle = '#f2f2f2'; g.fillRect(0, y + 16, 32, 16); } return tex(c); })();
  const ventGeo = new THREE.CylinderGeometry(0.45, 0.55, 2.6, 16, 1, true); ventGeo.translate(0, 1.3, 0);
  const vent = new THREE.InstancedMesh(ventGeo, new THREE.MeshStandardMaterial({ map: ventTex, roughness: 0.6, side: THREE.DoubleSide }), 60);
  for (let k = 0; k < 60; k++) { const x = AVES[1 + ((r() * (AVES.length - 2)) | 0)] + (r() < 0.5 ? -2 : 2), z = STREETS[1 + ((r() * (STREETS.length - 2)) | 0)] + 8 + r() * 20; if (inRect(x, z, PARK, 8)) continue; steamVents.push(new THREE.Vector3(x, 2.6, z)); m4.compose(new THREE.Vector3(x, 0, z), q.identity(), s1); vent.setMatrixAt(steamVents.length - 1, m4); }
  vent.count = steamVents.length; city.add(vent);

  // Bridge (east, downtown)
  const bridge = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x5d5a55, roughness: 0.8 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8c7b66, roughness: 0.9 });
  const bz = LANDMARKS.bridge.z, deckY = 25;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(520, 2, 26), deckMat); deck.position.set(780, deckY - 1, bz); deck.receiveShadow = deck.castShadow = true; bridge.add(deck);
  col.add(520, deckY - 2, bz - 13, 1040, deckY, bz + 13, 'bridge');
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(60, 2, 26), deckMat); ramp.position.set(495, deckY / 2 - 1, bz); ramp.rotation.z = Math.atan2(deckY, 60); bridge.add(ramp);
  for (const tx of [640, 900]) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(8, 110, 6), stoneMat); leg.position.set(tx, 55 - 5, bz + s * 11); leg.castShadow = true; bridge.add(leg);
      col.add(tx - 4, -5, bz + s * 11 - 3, tx + 4, 105, bz + s * 11 + 3, 'bridge');
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 28), stoneMat); top.position.set(tx, 98, bz); bridge.add(top);
    col.add(tx - 4, 91, bz - 14, tx + 4, 105, bz + 14, 'bridge');
    const cross = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 28), stoneMat); cross.position.set(tx, 60, bz); bridge.add(cross);
  }
  // cables
  const cablePts = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 60; k++) { const x = 520 + k * (520 / 60); const tt = (x - 640) / 260; let y; if (x < 640) y = 104 - (640 - x) / 120 * 70; else if (x > 900) y = 104 - (x - 900) / 140 * 70; else y = 104 - Math.sin(tt * Math.PI) * 68; pts.push(new THREE.Vector3(x, Math.max(y, deckY + 1), bz + s * 12)); }
    cablePts.push(pts);
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.5, 6), lampMat); bridge.add(tube);
    const vert = [];
    for (let k = 0; k < pts.length; k += 1) vert.push(pts[k].x, pts[k].y, pts[k].z, pts[k].x, deckY, pts[k].z);
    const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(vert, 3));
    bridge.add(new THREE.LineSegments(vg, new THREE.LineBasicMaterial({ color: 0x777777 })));
  }
  const bl = [];
  for (const pts of cablePts) for (let k = 0; k < pts.length; k += 2) bl.push(pts[k]);
  const bLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }), bl.length);
  bl.forEach((p, i) => { m4.compose(p, q.identity(), s1); bLights.setMatrixAt(i, m4); });
  bridge.add(bLights);
  city.add(bridge);

  // Piers
  for (let k = 0; k < 6; k++) {
    const z = 300 + k * 110; const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 2, 16), deckMat);
    pier.position.set(ISLAND.minX - 50, 0, z); pier.receiveShadow = true; city.add(pier);
    col.add(ISLAND.minX - 80, -1, z - 8, ISLAND.minX - 20, 1, z + 8, 'pier');
  }

  const nightMats = facadeMats;
  return {
    group: city, blocks, buildings, roofSpots, billboards, waterMat, groundMat, headMat, nightMats, T, river,
    lampPools: pools, steamVents, signalPhase: 0, storeMat,
    update(t, night, rain = 0) {
      for (const m of nightMats) m.emissiveIntensity = night * 1.05;
      storeMat.emissiveIntensity = 0.25 + night * 1.6;
      crownMats.forEach((m, i) => m.color.set(crownCols[i]).multiplyScalar(0.15 + night * 2.2));
      poolMat.opacity = night * 0.55;
      bLights.material.color.setRGB(1, 0.94, 0.8).multiplyScalar(0.2 + night * 2.5);
      groundMat.roughness = 0.9 - rain * 0.55; groundMat.color.setScalar(1 - rain * 0.35);
      swMat.roughness = 0.85 - rain * 0.5;
      const cyc = t % 30; const phase = cyc < 12 ? 0 : cyc < 15 ? 1 : cyc < 27 ? 2 : 3;
      if (phase !== lastPhase) { lastPhase = phase; setSignals(phase); }
      this.signalPhase = phase;

      headMat.emissiveIntensity = night * 6;
      T.waterN.offset.set(t * 0.004, t * 0.006);
      for (let i = 0; i < billboards.length; i++) billboards[i].material.color.setScalar(1.2 + Math.sin(t * 2 + i) * 0.3);
    },
  };
}
