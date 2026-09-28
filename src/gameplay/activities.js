import * as THREE from 'three';
import { rng } from '../world/textures.js';
import { LANDMARKS as L, AVES, STREETS } from '../world/city.js';

// Side content: random crimes, enemy bases, ring challenges, collectibles.
export class Activities {
  constructor(G) {
    this.G = G; const r = rng(4242);
    // Collectibles: Juma Memories (glowing backpacks) on rooftops & plazas
    const geo = new THREE.BoxGeometry(0.8, 1, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a3a5a, emissive: 0x3fc8ff, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.4 });
    this.collectibles = [];
    const roofs = G.city.roofSpots;
    for (let i = 0; i < 20; i++) {
      const p = roofs[(r() * roofs.length) | 0].clone(); p.y += 1.2;
      const m = new THREE.Mesh(geo, mat); m.position.copy(p); G.scene.add(m);
      this.collectibles.push({ id: 'c' + i, p, m });
    }
    // Challenges: ring courses
    const ringGeo = new THREE.TorusGeometry(4, 0.35, 8, 32);
    this.challenges = [
      { id: 'ch1', name: 'Midtown Sprint', pts: [L.timesSquare.clone().setY(30), L.empire.clone().add(new THREE.Vector3(-40, 60, 20)), L.chrysler.clone().add(new THREE.Vector3(-30, 50, 40)), new THREE.Vector3(144, 40, -500), new THREE.Vector3(0, 30, -620)] },
      { id: 'ch2', name: 'Village Weave', pts: [new THREE.Vector3(-96, 20, 0), new THREE.Vector3(-96, 18, 120), new THREE.Vector3(0, 22, 200), new THREE.Vector3(96, 18, 300), new THREE.Vector3(192, 25, 420)] },
      { id: 'ch3', name: 'Bridge Run', pts: [new THREE.Vector3(384, 40, 600), new THREE.Vector3(560, 35, 625), new THREE.Vector3(700, 40, 625), new THREE.Vector3(850, 60, 625), new THREE.Vector3(990, 35, 625)] },
      { id: 'ch4', name: 'Park Dive', pts: [new THREE.Vector3(96, 140, -600), new THREE.Vector3(40, 60, -680), new THREE.Vector3(-40, 20, -760), new THREE.Vector3(-100, 15, -880), new THREE.Vector3(-40, 12, -1000)] },
    ];
    const rmat = new THREE.MeshBasicMaterial({ color: 0x7dff8a, toneMapped: false, transparent: true, opacity: 0.85 });
    for (const c of this.challenges) {
      // interpolate extra rings along a curve
      const curve = new THREE.CatmullRomCurve3(c.pts); c.rings = [];
      const n = 10;
      for (let i = 0; i <= n; i++) { const p = curve.getPoint(i / n), t = curve.getTangent(i / n); const m = new THREE.Mesh(ringGeo, rmat.clone()); m.position.copy(p); m.lookAt(p.clone().add(t)); m.visible = false; G.scene.add(m); c.rings.push(m); }
      c.start = c.pts[0];
    }
    // Enemy bases
    this.bases = [
      { id: 'b1', name: 'Warden Depot — Hell\'s Kitchen', p: new THREE.Vector3(-384, 0, -425), waves: [['thug', 'thug', 'gunner', 'gunner', 'shield'], ['brute', 'shield', 'gunner', 'jetpack'], ['brute', 'brute', 'jetpack', 'jetpack', 'thug']] },
      { id: 'b2', name: 'Harbor Warehouse — Chelsea', p: new THREE.Vector3(-480, 0, 150), waves: [['thug', 'thug', 'thug', 'gunner'], ['shield', 'shield', 'gunner', 'gunner'], ['brute', 'jetpack', 'jetpack']] },
      { id: 'b3', name: 'Symbiote Nest — East Harlem', p: new THREE.Vector3(336, 0, -1075), waves: [['symbiote', 'symbiote', 'thug'], ['symbiote', 'symbiote', 'symbiote', 'brute'], ['symbiote', 'symbiote', 'symbiote', 'symbiote']] },
    ];
    this.crime = null; this.crimeTimer = 20; this.base = null; this.run = null; this.t = 0;
  }
  refreshMarkers() {
    const G = this.G, s = G.progress.s;
    for (const b of this.bases) G.hud.setMarker('a-' + b.id, s.bases.includes(b.id) ? null : b.p, 'base', b.name.split('—')[0]);
    for (const c of this.challenges) G.hud.setMarker('a-' + c.id, this.run ? null : c.start, 'challenge', c.name);
  }
  onKill(e) {}
  update(dt) {
    const G = this.G, h = G.player, s = G.progress.s; this.t += dt;
    // collectibles
    for (const c of this.collectibles) {
      if (s.collect.includes(c.id)) { c.m.visible = false; continue; }
      c.m.rotation.y += dt * 1.5; c.m.position.y = c.p.y + Math.sin(this.t * 2) * 0.3;
      const d = h.pos.distanceTo(c.p);
      G.hud.setMarker('a-' + c.id, d < 160 ? c.p : null, 'collect', 'MEMORY');
      if (d < 3) { s.collect.push(c.id); G.progress.save(); G.hud.notify(`Juma Memory found (${s.collect.length}/20): ${MEMORIES[s.collect.length - 1]}`, true); G.progress.addXP(80); G.audio.chime(); G.fx.burst(c.p, 40, 0x3fc8ff, 6, 0.8, 0.2, 0); G.hud.setMarker('a-' + c.id, null); }
    }
    const missionFight = G.missions.current && ['fight', 'boss', 'chase'].includes(G.missions.step?.type);
    // random crimes
    if (!this.crime && !missionFight && !this.base && !this.run) {
      this.crimeTimer -= dt;
      if (this.crimeTimer <= 0) this.spawnCrime();
    }
    if (this.crime) {
      const c = this.crime;
      if (G.combat.alive('crime').length === 0) {
        s.crimes++; G.progress.addXP(120); s.tokens++; G.progress.save();
        G.hud.notify(`Crime stopped: ${c.name}  +120 XP · +1 token`, true); G.say('civ', ['Thank you, Spider-Man!', 'You guys are the best!', 'Juma brothers! Juma brothers!'][(Math.random() * 3) | 0], 2);
        G.hud.setMarker('a-crime', null); this.crime = null; this.crimeTimer = 30 + Math.random() * 30;
      } else if (h.pos.distanceTo(c.p) > 700) { G.combat.clear('crime'); G.hud.setMarker('a-crime', null); this.crime = null; this.crimeTimer = 15; }
    }
    // bases
    if (!this.base && !missionFight) for (const b of this.bases) if (!s.bases.includes(b.id) && h.pos.distanceTo(b.p) < 45) { this.base = { b, wave: 0 }; G.hud.notify('ENEMY BASE: ' + b.name, true); G.combat.spawnGroup(b.p, b.waves[0], { tag: 'base', unaware: true }); break; }
    if (this.base) {
      const B = this.base;
      G.hud.objective('ENEMY BASE', `${B.b.name} — wave ${B.wave + 1}/${B.b.waves.length}`);
      if (G.combat.alive('base').length === 0) {
        B.wave++;
        if (B.wave >= B.b.waves.length) { s.bases.push(B.b.id); s.tokens += 3; G.progress.addXP(600); G.progress.save(); G.hud.notify('BASE CLEARED  +600 XP · +3 tokens', true); G.audio.chime(); this.base = null; G.missions.current ? G.hud.objective(G.missions.current.title.toUpperCase(), G.missions.step?.text) : G.hud.objective('FREE ROAM', ''); this.refreshMarkers(); }
        else { G.hud.notify(`Wave ${B.wave + 1}`); G.combat.spawnGroup(B.b.p, B.b.waves[B.wave], { tag: 'base' }); }
      } else if (h.pos.distanceTo(B.b.p) > 250) { G.combat.clear('base'); this.base = null; G.hud.notify('Left the base — it will reset.'); }
    }
    // challenges
    if (!this.run) {
      for (const c of this.challenges) if (!missionFight && h.pos.distanceTo(c.start) < 8) { this.run = { c, i: 0, t: 0 }; c.rings.forEach(r => r.visible = true); G.hud.notify('CHALLENGE: ' + c.name + ' — fly through every ring!', true); this.refreshMarkers(); break; }
    } else {
      const R = this.run; R.t += dt;
      R.c.rings.forEach((r, i) => { r.material.color.set(i === R.i ? 0xffffff : i < R.i ? 0x225522 : 0x7dff8a); r.visible = i >= R.i; });
      const ring = R.c.rings[R.i];
      G.hud.objective('CHALLENGE: ' + R.c.name, `Ring ${R.i + 1}/${R.c.rings.length} · ${R.t.toFixed(1)}s`);
      G.hud.setMarker('a-ring', ring.position, 'challenge', 'RING');
      if (h.pos.distanceTo(ring.position) < 6) { R.i++; G.audio.ui(2); G.progress.addXP(5); }
      if (R.i >= R.c.rings.length) {
        const best = s.challenges[R.c.id]; const nb = !best || R.t < best;
        if (nb) s.challenges[R.c.id] = R.t; s.tokens += 1; G.progress.addXP(250); G.progress.save();
        G.hud.notify(`${R.c.name} complete: ${R.t.toFixed(1)}s ${nb ? '— NEW BEST!' : ''} +250 XP`, true); G.audio.chime();
        this.endRun();
      } else if (R.t > 120) { G.hud.notify('Challenge failed — out of time'); this.endRun(); }
    }
  }
  endRun() { this.run.c.rings.forEach(r => r.visible = false); this.run = null; this.G.hud.setMarker('a-ring', null); this.refreshMarkers(); const G = this.G; G.missions.current ? G.hud.objective(G.missions.current.title.toUpperCase(), G.missions.step?.text) : G.hud.objective('FREE ROAM', ''); }
  spawnCrime() {
    const G = this.G, h = G.player;
    const ang = Math.random() * Math.PI * 2, dist = 150 + Math.random() * 200;
    const x = AVES.reduce((a, b) => Math.abs(b - (h.pos.x + Math.cos(ang) * dist)) < Math.abs(a - (h.pos.x + Math.cos(ang) * dist)) ? b : a);
    const z = STREETS.reduce((a, b) => Math.abs(b - (h.pos.z + Math.sin(ang) * dist)) < Math.abs(a - (h.pos.z + Math.sin(ang) * dist)) ? b : a);
    const p = new THREE.Vector3(x, 0, z);
    const symb = G.progress.s.mission >= 4 && Math.random() < 0.35;
    const kinds = symb ? [['Symbiote outbreak', ['symbiote', 'symbiote', 'symbiote']]] : [['Armed robbery', ['thug', 'thug', 'gunner']], ['Gang war', ['thug', 'thug', 'shield', 'brute']], ['Warden hijack', ['gunner', 'gunner', 'jetpack', 'thug']], ['Mugging', ['thug', 'thug']]];
    const [name, list] = kinds[(Math.random() * kinds.length) | 0];
    G.combat.spawnGroup(p, list, { tag: 'crime' });
    this.crime = { name, p };
    G.hud.setMarker('a-crime', p, 'crime', name.toUpperCase());
    G.hud.notify('Police scanner: ' + name + ' in progress!');
    G.say('cop', ['All units, ' + name.toLowerCase() + ' reported. Spider-Men, if you\'re listening...', 'We need help down here, web-heads!'][(Math.random() * 2) | 0], 3);
  }
}
const MEMORIES = ['Dad\'s first camera', 'Ali\'s science-fair volcano', 'Majed\'s graduation cap', 'Mom\'s spice tin', 'Coney Island ticket stubs', 'Their first web-shooter prototype', 'A Knicks jersey signed "to the Juma boys"', 'Cairo postcard from Majed', 'Ali\'s broken skateboard', 'Grandma\'s prayer beads', 'Subway map with doodles', 'Family photo, Eid 2012', 'Majed\'s boxing gloves', 'Ali\'s robot sketchbook', 'A mixtape labelled "SWING SONGS"', 'Dad\'s taxi medallion', 'The first mask Mom sewed', 'Rooftop BBQ photo', 'A note: "Look after your brother"', 'The Juma family key'];
