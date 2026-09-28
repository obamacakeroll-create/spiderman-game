import * as THREE from 'three';
import { CAMPAIGN } from './story.js';
import { Rig, Poses, SUITS } from '../actors/rig.js';

export class Missions {
  constructor(G) { this.G = G; this.list = CAMPAIGN; this.current = null; this.si = 0; this.step = null; this.st = {}; }
  roofNear(p, minH = 0, maxH = 1e9) { let best = null, bd = 1e9; for (const r of this.G.city.roofSpots) { if (r.y < minH || r.y > maxH) continue; const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < bd) { bd = d; best = r; } } return best.clone(); }
  start(idx, stepIdx = 0) {
    const G = this.G; this.cleanup();
    if (idx >= this.list.length) { this.current = null; G.hud.objective('FREE ROAM', 'Stop crimes, clear bases, find Juma Memories'); return; }
    this.current = this.list[idx]; G.progress.s.mission = idx;
    if (this.current.time !== undefined && stepIdx === 0) G.sky.time = this.current.time;
    G.sky.weather = this.current.weather || 'clear';
    if (stepIdx === 0) G.hud.notify(`MISSION ${idx + 1}: ${this.current.title.toUpperCase()}`, true);
    this.enter(stepIdx);
  }
  cleanup() { const G = this.G; G.combat.clear('m'); G.hud.clearMarkers('m-'); G.hud.boss(null); if (this.chaser) { G.scene.remove(this.chaser.root); this.chaser = null; } document.body.classList.remove('cine'); G.cinematic = false; G.camRig.cine = null; }
  enter(i) {
    const G = this.G; this.si = i; const s = this.step = this.current.steps[i]; this.st = { t: 0 };
    if (!s) { this.complete(); return; }
    if (s.checkpoint) { G.progress.s.step = i; G.progress.save(); this.checkpointPos = G.player.pos.clone(); }
    G.hud.objective(this.current.title.toUpperCase(), s.text || '');
    switch (s.type) {
      case 'say': {
        s.lines.forEach(l => G.hud.say(...l));
        this.st.dur = s.lines.reduce((a, l) => a + l[2], 0);
        if (s.cine) { G.cinematic = true; document.body.classList.add('cine'); const c = s.cine; let t = 0; G.camRig.cine = { update: (dt) => { t += dt; const a = t * 0.12; return { pos: c.clone().add(new THREE.Vector3(Math.cos(a) * 90, 25 + t * 2, Math.sin(a) * 90)), look: c.clone().setY(c.y - 20), fov: 50 }; } }; }
        break;
      }
      case 'goto': G.hud.setMarker('m-goto', s.pos, 'mission', this.current.title); break;
      case 'fight': {
        let p = s.pos.clone();
        if (s.roof) p = s.roof === 'near' ? this.roofNear(s.pos.clone().add(new THREE.Vector3(60, 0, 20)), 20, 70) : this.roofNear(s.pos, 30);
        this.st.center = p; this.st.wave = 0; this.spawnWave();
        G.hud.setMarker('m-fight', p, 'mission', 'FIGHT');
        break;
      }
      case 'boss': {
        const p = s.pos.clone(); p.y = G.col.groundAt(p.x, p.z, p.y + 2);
        const b = G.combat.spawn(s.type2, p, { tag: 'm', hpMul: s.hpMul || 1 }); this.st.boss = b;
        G.hud.setMarker('m-boss', p, 'mission', b.a.boss);
        if (s.type2 === 'warden') G.combat.spawnGroup(p, ['jetpack', 'gunner', 'gunner'], { tag: 'm' });
        break;
      }
      case 'playAs': G.switchTo(s.hero, true); break;
      case 'switchPrompt': break;
      case 'chase': {
        const rig = new Rig({ scale: 1.42, bulk: 1.3, muscle: 1.4, waist: 0.72, head: 1.12, venom: true }); rig.dress(SUITS.venom); G.scene.add(rig.root);
        this.chaser = { root: rig.root, rig, p: s.path[0].clone(), seg: 0, hp: 5 };
        G.hud.setMarker('m-chase', this.chaser.p, 'mission', 'VENOM');
        break;
      }
      case 'unlockVenom': G.progress.s.venomUnlocked = true; G.progress.save(); G.hud.notify('VENOM UNLOCKED — press V in free roam', true); G.hud.setHero(G.player); break;
    }
  }
  spawnWave() {
    const G = this.G, s = this.step; const w = s.waves[this.st.wave];
    G.combat.spawnGroup(this.st.center, w, { tag: 'm', unaware: !!s.stealth });
    if (this.st.wave > 0) G.hud.notify(`Wave ${this.st.wave + 1} / ${s.waves.length}`);
  }
  next() { this.G.hud.clearMarkers('m-'); this.enter(this.si + 1); }
  complete() {
    const G = this.G; const idx = this.list.indexOf(this.current);
    G.progress.addXP(400 + idx * 100); G.progress.s.mission = idx + 1; G.progress.s.step = 0; G.progress.save();
    G.hud.notify(`MISSION COMPLETE: ${this.current.title.toUpperCase()}  +${400 + idx * 100} XP`, true); G.audio.chime();
    this.cleanup(); this.current = null;
    // brief breather before the next mission
    const nextIdx = idx + 1;
    if (nextIdx < this.list.length) { G.hud.objective('NEXT: ' + this.list[nextIdx].title.toUpperCase(), 'Free roam — press ENTER to start the next mission'); this.pendingNext = nextIdx; }
    else { G.hud.objective('FREE ROAM', 'Press V for Venom · crimes, bases, challenges await'); G.switchTo('ali', true); }
  }
  restartStep() {
    const G = this.G; if (!this.current) return;
    const cp = this.current.steps.slice(0, this.si + 1).map((x, i) => x.checkpoint ? i : -1).filter(i => i >= 0).pop() ?? 0;
    const idx = this.list.indexOf(this.current); this.start(idx, cp);
  }
  onKill() {}
  update(dt) {
    const G = this.G, s = this.step; if (!this.current || !s) {
      if (this.pendingNext !== undefined && G.input.hit('Enter')) { const n = this.pendingNext; this.pendingNext = undefined; this.start(n); }
      return;
    }
    this.st.t += dt; const p = G.player;
    switch (s.type) {
      case 'say': if (this.st.t > this.st.dur + 0.2 || (s.cine && G.input.hit('Enter', 'Space') && this.st.t > 0.5)) { if (s.cine) { G.hud.clearSubs(); } G.cinematic = false; document.body.classList.remove('cine'); G.camRig.cine = null; this.next(); } break;
      case 'goto': if (Math.hypot(p.pos.x - s.pos.x, p.pos.z - s.pos.z) < s.radius) this.next(); break;
      case 'fight': {
        if (G.combat.alive('m').length === 0) {
          if (s.stealth && this.st.wave === 0 && !this.st.detected) G.hud.style('GHOST — UNDETECTED', 150);
          this.st.wave++; if (this.st.wave < s.waves.length) this.spawnWave(); else this.next();
        }
        if (s.stealth && G.combat.alive('m').some(e => e.state !== 'idle')) this.st.detected = true;
        break;
      }
      case 'boss': G.hud.boss(this.st.boss); G.hud.setMarker('m-boss', this.st.boss.pos, 'mission', this.st.boss.a.boss);
        if (!this.st.boss.alive) { G.hud.boss(null); if (this.st.t > 0) { this.st.boss.dispose?.(); this.next(); } }
        else if (!this.st.half && this.st.boss.hp < this.st.boss.maxHp * 0.5) { this.st.half = true; const lines = { carapace: [['carapace', 'Enough! Missiles, full volley!', 3]], venomBoss: [['venom', 'Little spider STINGS. WE will make more of US!', 3.5]], warden: [['warden', 'Deploy everything! Burn them!', 3]] }[s.type2]; lines?.forEach(l => G.hud.say(...l)); }
        break;
      case 'switchPrompt': if (p.id === s.to) this.next(); break;
      case 'chase': {
        const c = this.chaser; const path = s.path;
        const target = path[Math.min(c.seg + 1, path.length - 1)];
        const d = p.pos.distanceTo(c.p);
        const spd = s.speed * (d > 70 ? 0.6 : d < 25 ? 1.25 : 1);
        const to = target.clone().sub(c.p); const l = to.length();
        if (l < 3) { if (c.seg < path.length - 2) c.seg++; else if (d < 30) { this.next(); break; } }
        else c.p.addScaledVector(to.normalize(), Math.min(l, spd * dt));
        const bob = Math.abs(Math.sin(this.st.t * 3)) * 4;
        c.root.position.copy(c.p).setY(c.p.y + bob); c.root.rotation.y = Math.atan2(to.x, to.z);
        c.rig.pose(Poses.jump(), dt);
        G.hud.setMarker('m-chase', c.p, 'mission', `VENOM`);
        if (Math.random() < dt * 4) G.fx.goo(c.p.clone().setY(c.p.y + 1), 3);
        if (d > 220) { G.hud.notify('Venom got away! Restarting chase.'); this.restartStep(); }
        break;
      }
    }
  }
}
