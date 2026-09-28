import * as THREE from 'three';
import { Enemy } from '../actors/enemies.js';
import { Poses } from '../actors/rig.js';
import { WebLine } from './webline.js';

const COMBO = ['punchL', 'punchR', 'kick', 'punchL', 'spinKick'];
const V = () => new THREE.Vector3();

export class Combat {
  constructor(G) {
    this.G = G; this.enemies = []; this.projectiles = []; this.tracers = [];
    this.combo = 0; this.comboT = 0; this.senseEls = new Map();
    this.fxWeb = new WebLine(G.scene, 0xffffff, 0.04);
    const mg = new THREE.SphereGeometry(0.25, 8, 6);
    this.missileGeo = mg; this.missileMat = new THREE.MeshBasicMaterial({ color: 0xff7020, toneMapped: false });
  }
  spawn(type, pos, opts) { const e = new Enemy(this.G, type, pos, opts); this.enemies.push(e); return e; }
  spawnGroup(center, list, opts = {}) {
    const out = [];
    list.forEach((type, i) => {
      const a = (i / list.length) * Math.PI * 2 + Math.random() * 0.5, r = 4 + Math.random() * 6;
      const p = center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      p.y = this.G.col.groundAt(p.x, p.z, center.y + 2);
      out.push(this.spawn(type, p, opts));
    });
    return out;
  }
  clear(tag) { this.enemies = this.enemies.filter(e => { if (!tag || e.tag === tag) { e.dispose(); return false; } return true; }); }
  alive(tag) { return this.enemies.filter(e => e.alive && (!tag || e.tag === tag)); }
  alertNear(p, r) { for (const e of this.enemies) if (e.state === 'idle' && e.pos.distanceTo(p) < r) e.state = 'chase'; }
  busy(h) { return !!h.action; }
  hasTarget(h) { return !!this.pickTarget(h, 26, true); }
  canAttack(e, h) {
    // limit simultaneous melee attackers for readable combat
    const n = this.enemies.filter(o => o.alive && o.state === 'windup' && o.attackTarget === h).length;
    return n < (e.a.boss ? 3 : 2);
  }
  pickTarget(h, range = 14, anyDir = false, dir) {
    let best = null, bs = 1e9;
    const d = dir || h.G.camFwd;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const to = e.pos.clone().sub(h.pos); const dist = to.length(); if (dist > range) continue;
      to.y = 0; to.normalize();
      const s = dist * (1.6 - (d ? to.dot(d) : 0));
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  update(dt, heroes, player, inp) {
    const G = this.G;
    for (const e of this.enemies) e.update(dt, heroes);
    // remove long-dead
    this.enemies = this.enemies.filter(e => { if (!e.alive && e.stateT > 8) { e.dispose(); return false; } return true; });
    for (const h of heroes) if (h.rig.root.visible) this.heroUpdate(h, h === player ? inp : h.vin, dt, h === player);
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    // projectiles (missiles)
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.target) { const to = p.target.center.clone().sub(p.mesh.position).normalize(); p.vel.lerp(to.multiplyScalar(22), 1 - Math.exp(-1.6 * dt)); }
      p.mesh.position.addScaledVector(p.vel, dt);
      G.fx.emit(p.mesh.position, V(), 0xff8030, 0.4, 0.4, -2);
      const hitHero = heroes.find(h => h.rig.root.visible && h.center.distanceTo(p.mesh.position) < 1.4);
      const g = G.col.groundAt(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y);
      if (hitHero || p.mesh.position.y < g + 0.3 || p.t > 6) {
        p.dead = true; G.fx.burst(p.mesh.position, 30, 0xffa040, 10, 0.5, 0.4, 5); G.audio.boom(); G.cam.shake(0.25);
        if (hitHero && hitHero.invuln <= 0) this.damageHero(hitHero, 14, null);
        G.scene.remove(p.mesh);
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
    for (const t of this.tracers) { t.life -= dt; t.line.material.opacity = t.life * 6; if (t.life <= 0) G.scene.remove(t.line); }
    this.tracers = this.tracers.filter(t => t.life > 0);
    this.updateSense(player);
    const inCombat = this.enemies.some(e => e.alive && e.state !== 'idle' && e.pos.distanceTo(player.pos) < 45);
    G.audio.intensity = THREE.MathUtils.damp(G.audio.intensity, inCombat ? 1 : player.speed > 25 ? 0.4 : 0.1, 1, dt);
    this.inCombat = inCombat;
  }
  missile(from, target) { const m = new THREE.Mesh(this.missileGeo, this.missileMat); m.position.copy(from); this.G.scene.add(m); this.projectiles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - .5) * 10, 14, (Math.random() - .5) * 10), target, t: 0 }); }
  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true })); this.G.scene.add(l); this.tracers.push({ line: l, life: 0.15 });
  }
  updateSense(player) {
    const G = this.G; const layer = document.getElementById('marker-layer');
    let threat = null;
    for (const e of this.enemies) if (e.alive && e.state === 'windup' && e.attackTarget === player && e.attackAt - G.time.now < 0.65) { if (!threat || e.unblockable) threat = e; }
    let el = this.senseEl; if (!el) { el = this.senseEl = document.createElement('div'); el.className = 'sense'; layer.appendChild(el); }
    if (threat) {
      const p = player.center.clone().add(new THREE.Vector3(0, 1.1, 0)).project(G.camera);
      el.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
      el.className = 'sense ' + (threat.unblockable ? 'yellow' : threat.a.ranged ? 'blue' : 'red'); el.textContent = threat.unblockable ? '⟨ ! ⟩' : '〈 ‼ 〉'; el.style.display = 'block';
    } else el.style.display = 'none';
  }

  damageHero(h, dmg, src, unblockable) {
    const G = this.G;
    if (h.invuln > 0 || h.dead || G.cinematic) return;
    if (h.ai) dmg *= 0.35; // companions are sturdier
    if (h.buffs.guardian) { dmg *= 0.3; if (src && src.a.ranged) { src.hit(10, null, 'env', h); G.fx.sparks(h.center, 0xff6060); } }
    h.hp -= dmg; h.hurtT = 0.3; h.action = null; this.combo = 0;
    G.fx.sparks(h.center, 0xff4040); G.audio.punch(0.5); G.cam.shake(h.ai ? 0 : 0.35);
    if (!h.ai) { G.hud.damage(); }
    if (src) { const d = h.pos.clone().sub(src.pos).setY(0).normalize(); h.vel.addScaledVector(d, 6); }
    if (h.hp <= 0) { h.hp = 0; if (h.ai) { h.hp = h.maxHp * 0.5; h.invuln = 3; } else G.onHeroDown(h); }
  }

  heroUpdate(h, inp, dt, isPlayer) {
    const G = this.G; if (!inp || h.dead) return;
    const venom = h.def.id === 'venom';
    // resolve active action
    const act = h.action;
    if (act) {
      act.t += dt;
      if (act.update) act.update(dt, act);
      for (const hit of act.hits || []) if (!hit.done && act.t >= hit.at * act.dur) { hit.done = true; hit.fn(); }
      if (act.t >= act.dur) { h.action = null; if (act.queued) this.attack(h, inp); }
    }
    if (h.hurtT > 0) return;
    const wantAttack = inp.hit('Mouse0');
    if (wantAttack) {
      if (h.action && h.action.combo && h.action.t > h.action.dur * 0.4) h.action.queued = true;
      else if (!h.action) this.attack(h, inp);
    }
    if (inp.hit('KeyR') && !h.action) this.launcher(h);
    if (inp.hit('KeyF')) this.dodge(h, inp);
    if (inp.hit('KeyE') && !h.action && this.hasTarget(h)) venom ? this.grab(h) : this.webStrike(h);
    if (inp.hit('KeyQ') && !h.action && !venom) this.webShot(h);
    if (inp.hit('KeyX', 'KeyZ') && !h.action) this.finisher(h);
    for (let i = 0; i < 3; i++) if (inp.hit('Digit' + (i + 1))) this.ability(h, i);
    // counter window
    if (h.counterT > 0) h.counterT -= dt;
    // Takedown prompt for stealth
    if (isPlayer) {
      const e = this.pickTarget(h, 4, true);
      const prompt = e && e.state === 'idle' ? 'LMB · SILENT TAKEDOWN' : null;
      const perch = !prompt && (h.state === 'perch' || h.state === 'wall') ? this.enemies.find(o => o.alive && o.state === 'idle' && o.pos.distanceTo(h.pos) < 28) : null;
      G.hud.prompt(prompt || (perch ? 'E · PERCH TAKEDOWN' : null));
    }
  }

  lungeTo(h, e, then) {
    const dist = h.pos.distanceTo(e.pos);
    if (dist < 2.4) { then(); return; }
    const dur = Math.min(0.35, dist / 38);
    h.action = { t: 0, dur, pose: () => Poses.dive(0), update: (dt) => {
      const to = e.pos.clone().sub(h.pos); to.y = (e.pos.y - h.pos.y); const d = to.length();
      if (d > 1.8) { h.vel.copy(to.normalize().multiplyScalar(38)); } else h.vel.multiplyScalar(0.2);
      h.yaw = Math.atan2(e.pos.x - h.pos.x, e.pos.z - h.pos.z);
    }, hits: [{ at: 0.99, fn: () => { h.vel.multiplyScalar(0.1); then(); } }] };
  }
  strikeFX(h, e, heavy) {
    const G = this.G; const c = e.center.clone();
    G.fx.sparks(c, h.def.id === 'ali' ? 0x60f0ff : h.def.id === 'venom' ? 0xb080ff : 0xffb070);
    G.audio.punch(heavy ? 1 : 0); G.time.hitstop(heavy ? 0.1 : 0.05); if (!h.ai) G.cam.shake(heavy ? 0.4 : 0.15);
    if (h.def.id === 'ali' && (h.buffs.overclock || Math.random() < 0.3)) G.fx.electric(h.center, c);
    if (h.def.id === 'venom') G.fx.goo(c, 8);
  }
  dmgMul(h) { return h.stats.dmg * (1 + h.mod('dmg')) * (h.buffs.overclock ? 2 : 1); }
  gainFocus(h, n) { h.focus = Math.min(100, h.focus + n * (1 + h.mod('focus'))); }
  registerHit(h, e) { if (!h.ai) { this.combo++; this.comboT = 2.5; } this.gainFocus(h, 4); }
  attack(h, inp) {
    const G = this.G; const e = this.pickTarget(h, h.def.id === 'venom' ? 16 : 14, false, h.ai ? null : G.camFwd);
    if (!e) {
      // whiff swing
      const n = h.comboIdx = ((h.comboIdx || 0) + 1) % COMBO.length;
      h.action = { t: 0, dur: 0.3, combo: true, pose: () => Poses[COMBO[n]]() };
      return;
    }
    // silent takedown
    if (e.state === 'idle' && e.pos.distanceTo(h.pos) < 4.5) { this.takedown(h, e); return; }
    this.lungeTo(h, e, () => {
      const n = h.comboIdx = ((h.comboIdx || 0) + 1) % COMBO.length;
      const air = h.state === 'air' || e.airborne;
      if (air) h.airCombo = true;
      const heavy = n === COMBO.length - 1;
      const venom = h.def.id === 'venom';
      const dur = (venom ? 0.42 : 0.3) / h.stats.comboSpeed / (h.buffs.overclock ? 1.4 : 1);
      const counter = h.counterT > 0; if (counter) { h.counterT = 0; G.hud.style('COUNTER!', 20); }
      h.action = { t: 0, dur, combo: true, pose: () => venom ? (n % 2 ? Poses.slam() : Poses.punchR()) : Poses[COMBO[n]](), update: () => { if (air) { h.vel.y = Math.max(h.vel.y, 0.5); } }, hits: [{ at: 0.45, fn: () => {
        const dir = e.pos.clone().sub(h.pos).setY(0).normalize();
        let dmg = (10 + (heavy ? 12 : 0)) * this.dmgMul(h) * (air ? 1 + h.mod('airDmg') : 1) * (counter ? 3 : 1);
        const targets = venom ? this.enemies.filter(o => o.alive && o.pos.distanceTo(h.pos) < 4.5) : [e];
        if (!targets.includes(e)) targets.push(e);
        for (const t of targets) { t.hit(dmg, dir, heavy || counter ? 'heavy' : 'light', h); if (air) { t.vel.y = 1.5; t.juggle = 1.2; } this.registerHit(h, t); }
        this.strikeFX(h, e, heavy);
        if (heavy && h.mod('aftershock')) this.shockwave(h, h.pos, 6, 20, 0xffb070);
      } }] };
    });
  }
  launcher(h) {
    const e = this.pickTarget(h, 8); if (!e) return;
    this.lungeTo(h, e, () => {
      h.action = { t: 0, dur: 0.35, pose: () => Poses.uppercut(), hits: [{ at: 0.4, fn: () => {
        e.hit(14 * this.dmgMul(h), null, 'launch', h); this.registerHit(h, e); this.strikeFX(h, e, true);
        h.vel.y = 13.5; h.state = 'air'; h.stateT = 0; h.airCombo = true; this.G.hud.style('LAUNCH', 10);
      } }] };
    });
  }
  dodge(h, inp) {
    const G = this.G; if (h.dodgeCd > G.time.now) return;
    h.dodgeCd = G.time.now + 0.35;
    const ax = inp.moveAxis();
    const f = G.camFwd.clone(), r = new THREE.Vector3(-f.z, 0, f.x);
    const dir = f.multiplyScalar(ax.y).addScaledVector(r, ax.x); if (dir.lengthSq() < 0.01) dir.set(-Math.sin(h.yaw), 0, -Math.cos(h.yaw)); dir.normalize();
    // perfect dodge check
    const win = 0.35 + h.mod('dodge');
    const threat = this.enemies.find(e => e.alive && e.state === 'windup' && e.attackTarget === h && e.attackAt - G.time.now < win) || this.projectiles.find(p => p.target === h && p.mesh.position.distanceTo(h.center) < 6);
    h.invuln = 0.45; h.action = { t: 0, dur: 0.32, pose: () => Poses.dodge(), update: () => { h.vel.x = dir.x * 16; h.vel.z = dir.z * 16; } };
    h.flipT = 0.5; h.flipAxis = Math.abs(ax.x) > Math.abs(ax.y) ? 1 : 0;
    G.audio.whoosh(0.8);
    if (threat) {
      if (!h.ai) { G.time.slowmo(0.7, 0.25); G.hud.style('PERFECT DODGE', 15); }
      h.counterT = 1.5; this.gainFocus(h, 10);
      if (threat.attackAt) { threat.attackAt = G.time.now + 0.6; threat.stateT = 0; }
    }
  }
  webStrike(h) {
    const G = this.G; const e = this.pickTarget(h, 26, true); if (!e) return;
    // perch takedown on unaware enemies
    if (e.state === 'idle') { this.webLine(h, e, 0.25); this.takedown(h, e, true); return; }
    G.audio.thwip(h.pos);
    const start = h.pos.clone();
    h.action = { t: 0, dur: 0.4, web: true, pose: () => Poses.kick(), update: (dt, a) => {
      const to = e.center.clone().sub(h.center); const d = to.length();
      h.webs[0].set(h.handPos(1), e.center, 0, Math.min(1, a.t / 0.08));
      if (d > 1.6) h.vel.copy(to.normalize().multiplyScalar(45)); else h.vel.multiplyScalar(0.1);
      h.yaw = Math.atan2(to.x, to.z);
    }, hits: [{ at: 0.8, fn: () => { h.webs[0].hide(); const dir = e.pos.clone().sub(start).setY(0).normalize(); e.hit(18 * this.dmgMul(h), dir, 'heavy', h); this.registerHit(h, e); this.strikeFX(h, e, true); G.hud.style('WEB STRIKE', 10); } }] };
  }
  webLine(h, e, dur) { const G = this.G; this.fxWeb.set(h.handPos(1), e.center, 0, 1); setTimeout(() => this.fxWeb.hide(), dur * 1000); G.audio.thwip(h.pos); }
  webShot(h) {
    const G = this.G; const e = this.pickTarget(h, 30); if (!e) return;
    h.action = { t: 0, dur: 0.22, pose: () => Poses.webShoot(1), hits: [{ at: 0.3, fn: () => {
      this.webLine(h, e, 0.12); e.webHits++; G.fx.burst(e.center, 12, 0xffffff, 4, 0.4, 0.2, 5);
      if (e.webHits >= (e.a.boss ? 6 : 3)) { e.webHits = 0; if (e.a.boss) { e.stunT = 2.5; e.state = 'stagger'; e.stateT = 0; G.hud.notify(e.a.boss + ' is webbed & stunned!'); } else { e.webbedT = 6; e.state = 'stagger'; e.stateT = 0; G.hud.style('WEBBED', 10); } }
      e.alert();
    } }] };
  }
  grab(h) { // Venom tendril grab & throw
    const G = this.G; const e = this.pickTarget(h, 22, true); if (!e) return;
    G.audio.roar();
    h.action = { t: 0, dur: 0.8, web: true, pose: () => Poses.webShoot(1), update: (dt, a) => {
      h.webs[0].set(h.handPos(1), e.center, 0, Math.min(1, a.t / 0.1));
      if (a.t < 0.45 && !e.a.boss) { const hold = h.center.clone().add(new THREE.Vector3(Math.sin(h.yaw) * 2, 1.5, Math.cos(h.yaw) * 2)); e.pos.lerp(hold.setY(hold.y - 1), 1 - Math.exp(-14 * dt)); e.vel.set(0, 0, 0); }
    }, hits: [{ at: 0.6, fn: () => {
      h.webs[0].hide(); const dir = G.camFwd.clone(); e.vel.copy(dir.multiplyScalar(34)).setY(6); e.thrown = 1;
      e.hit(35 * this.dmgMul(h) * 0.5, null, 'heavy', h); e.vel.copy(G.camFwd).multiplyScalar(34).setY(6);
      this.strikeFX(h, e, true); G.hud.style('TENDRIL THROW', 20);
      setTimeout(() => { for (const o of this.enemies) if (o !== e && o.alive && o.pos.distanceTo(e.pos) < 3.5) { o.hit(30, e.vel.clone().normalize(), 'heavy', h); G.fx.goo(o.center, 10); } }, 250);
    } }] };
  }
  takedown(h, e, perch) {
    const G = this.G;
    G.time.slowmo(0.6, 0.3); G.hud.style(perch ? 'PERCH TAKEDOWN' : 'SILENT TAKEDOWN', 50);
    e.webWrapped = true; e.webbedT = 99; e.hit(9999, null, 'finisher', h);
    G.fx.burst(e.center, 20, 0xffffff, 3, 0.8, 0.3, 2); G.audio.thwip(e.pos, 0.7);
    if (perch) e.pos.y += 0.0; // they get strung up
  }
  finisher(h) {
    const G = this.G; if (h.focus < 33) { if (!h.ai) G.hud.notify('Need a full focus bar for a finisher'); return; }
    const e = this.pickTarget(h, 10); if (!e) return;
    h.focus -= 33;
    const venom = h.def.id === 'venom';
    const heroP = h.center.clone();
    if (!h.ai) {
      G.time.slowmo(1.1, 0.2);
      const side = new THREE.Vector3(-(e.pos.z - h.pos.z), 0, e.pos.x - h.pos.x).normalize();
      let t = 0; G.camRig.cine = { update: (dt) => { t += dt; if (t > 1.1) return null; const mid = heroP.clone().lerp(e.center, 0.5); return { pos: mid.clone().addScaledVector(side, 4 - t * 1.5).add(new THREE.Vector3(0, 1.2 + t, 0)), look: mid, fov: 45 }; } };
    }
    this.lungeTo(h, e, () => {
      h.action = { t: 0, dur: 0.6, pose: (k) => k < 0.5 ? Poses.windup() : venom ? Poses.slam() : Poses.uppercut(), hits: [{ at: 0.55, fn: () => {
        const boss = !!e.a.boss;
        e.hit(boss ? e.maxHp * 0.12 : 9999, e.pos.clone().sub(h.pos).setY(0).normalize(), 'finisher', h);
        if (!boss) e.vel.y = 12;
        this.strikeFX(h, e, true); G.fx.burst(e.center, 60, venom ? 0x9060ff : h.def.color, 14, 0.8, 0.25, 8);
        G.hud.style(venom ? 'FEAST' : h.def.id === 'ali' ? 'OVERCHARGE FINISHER' : 'IRON FINISHER', 60);
        if (h.mod('finHeal')) h.hp = Math.min(h.maxHp, h.hp + h.mod('finHeal'));
        if (venom) h.hp = Math.min(h.maxHp, h.hp + 30);
        G.flash(0.25);
      } }] };
    });
  }
  shockwave(h, p, r, dmg, color, launch = true) {
    const G = this.G;
    for (const e of this.enemies) if (e.alive && e.pos.distanceTo(p) < r) { const d = e.pos.clone().sub(p).setY(0).normalize(); e.hit(dmg * this.dmgMul(h), d, launch ? 'launch' : 'heavy', h); e.vel.addScaledVector(d, 8); this.registerHit(h, e); }
    // ring particles
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; G.fx.emit(p.clone().setY(p.y + 0.3), new THREE.Vector3(Math.cos(a) * r * 2, 1, Math.sin(a) * r * 2), color, 0.45, 0.5, 0); }
    G.cam.shake(0.5); G.audio.boom();
  }
  landingImpact(h, impact) {
    if (h.def.id === 'venom' || h.mod('meteor')) { if (this.enemies.some(e => e.alive && e.pos.distanceTo(h.pos) < 8)) this.shockwave(h, h.pos, 7, 15 + impact * 0.3, h.def.id === 'venom' ? 0x8050ff : 0xff8040); }
  }
  ability(h, i) {
    const G = this.G; const ab = h.def.abilities[i]; if (!ab) return;
    if ((h.cooldowns[ab.id] || 0) > 0) return;
    if (!G.progress.abilityUnlocked(h.id, i)) { if (!h.ai) G.hud.notify(ab.name + ' unlocks at level ' + (i * 2 + 1)); return; }
    h.cooldowns[ab.id] = ab.cd * (1 - h.mod('cd'));
    if (!h.ai) G.hud.style(ab.name.toUpperCase(), 0);
    const near = (r) => this.enemies.filter(e => e.alive && e.pos.distanceTo(h.pos) < r);
    switch (ab.id) {
      case 'arc': {
        let from = h.center.clone(); const hit = []; const max = 5 + h.mod('arc');
        let cur = this.pickTarget(h, 25, true);
        while (cur && hit.length < max) { hit.push(cur); G.fx.electric(from, cur.center); cur.hit(22 * this.dmgMul(h), null, 'heavy', h); cur.stunT = 1.5; cur.state = 'stagger'; cur.stateT = 0; this.registerHit(h, cur); from = cur.center.clone(); cur = this.enemies.filter(e => e.alive && !hit.includes(e) && e.pos.distanceTo(from) < 12).sort((a, b) => a.pos.distanceTo(from) - b.pos.distanceTo(from))[0]; }
        G.audio.zap(); h.action = { t: 0, dur: 0.35, pose: () => Poses.webShoot(1) };
        break;
      }
      case 'dome': {
        h.action = { t: 0, dur: 0.5, pose: () => Poses.slam(), hits: [{ at: 0.5, fn: () => { this.shockwave(h, h.pos, 9, 18, 0x40e8ff); for (const e of near(9)) { e.stunT = 3; G.fx.electric(h.center, e.center); } G.audio.zap(); } }] };
        break;
      }
      case 'overclock': h.buffs.overclock = 10; G.audio.zap(); G.flash(0.2); G.fx.burst(h.center, 60, 0x40e8ff, 10, 0.6, 0.3, 0); break;
      case 'seismic': {
        h.vel.y = 16; h.state = 'air'; h.stateT = 0;
        h.action = { t: 0, dur: 0.9, pose: (k) => k < 0.5 ? Poses.jump() : Poses.slam(), update: (dt, a) => { if (a.t > 0.45) h.vel.y = -45; }, hits: [{ at: 0.99, fn: () => this.shockwave(h, h.pos, 10, 30, 0xff9050) }] };
        break;
      }
      case 'hammer': {
        const targets = near(12).slice(0, 4);
        targets.forEach(e => { e.webbedT = 2; e.vel.y = 8; });
        let ang = 0;
        h.action = { t: 0, dur: 1.2, pose: () => Poses.spinKick(), update: (dt, a) => {
          ang += dt * 10; h.yaw += dt * 10;
          targets.forEach((e, i) => { const a2 = ang + i * Math.PI / 2; e.pos.set(h.pos.x + Math.cos(a2) * 5, h.pos.y + 1.5, h.pos.z + Math.sin(a2) * 5); e.vel.set(0, 0, 0); });
          if (targets[0]) this.fxWeb.set(h.handPos(1), targets[0].center, 0, 1);
        }, hits: [{ at: 0.99, fn: () => { this.fxWeb.hide(); targets.forEach(e => { e.hit(40 * this.dmgMul(h), e.pos.clone().sub(h.pos).setY(0).normalize(), 'heavy', h); e.vel.y = -10; }); this.shockwave(h, h.pos, 8, 10, 0xffffff, false); } }] };
        break;
      }
      case 'guardian': h.buffs.guardian = 8; G.fx.burst(h.center, 50, 0xffffff, 6, 0.8, 0.3, 0); G.audio.whoosh(1); break;
      case 'whirl': {
        h.action = { t: 0, dur: 0.8, pose: () => Poses.spinKick(), update: (dt) => { h.yaw += dt * 14; for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28; G.fx.emit(h.center, new THREE.Vector3(Math.cos(a) * 14, Math.random() * 3, Math.sin(a) * 14), 0x201830, 0.35, 0.5, 0); } },
          hits: [0.3, 0.6, 0.9].map(at => ({ at, fn: () => { for (const e of near(7)) { e.hit(16 * this.dmgMul(h), e.pos.clone().sub(h.pos).setY(0).normalize(), 'heavy', h); this.registerHit(h, e); } G.audio.punch(1); G.cam.shake(0.3); } })) };
        break;
      }
      case 'surge': {
        h.action = { t: 0, dur: 0.5, pose: () => Poses.slam(), hits: [{ at: 0.6, fn: () => {
          this.shockwave(h, h.pos, 12, 26, 0x8050ff);
          for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28, r = 3 + Math.random() * 8; const spike = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.5, 6), new THREE.MeshStandardMaterial({ color: 0x08080e, roughness: 0.2, metalness: 0.4 })); spike.position.set(h.pos.x + Math.cos(a) * r, h.pos.y + 1.2, h.pos.z + Math.sin(a) * r); spike.rotation.set((Math.random() - .5) * 0.6, 0, (Math.random() - .5) * 0.6); G.scene.add(spike); setTimeout(() => G.scene.remove(spike), 900); }
        } }] };
        break;
      }
      case 'roar': { G.audio.roar(); G.cam.shake(0.8); h.hp = Math.min(h.maxHp, h.hp + 60); for (const e of near(16)) { e.stunT = 3; e.state = 'stagger'; e.stateT = 0; e.vel.add(e.pos.clone().sub(h.pos).setY(0).normalize().multiplyScalar(10)); } h.action = { t: 0, dur: 0.9, pose: () => Poses.cheer(0) }; if (h.rig.mouth) h.rig.mouth.scale.y = 1.6; setTimeout(() => h.rig.mouth && (h.rig.mouth.scale.y = 0.8), 900); break; }
    }
  }
  onKill(e, h, kind) {
    const G = this.G;
    G.progress.addXP(e.a.xp);
    if (h && !h.ai && Math.random() < 0.3) G.say(h.id, h.def.lines.kill[(Math.random() * h.def.lines.kill.length) | 0], 1.6);
    if (e.a.boss) { G.time.slowmo(1.5, 0.15); G.flash(0.4); }
    G.missions?.onKill(e); G.activities?.onKill(e);
  }
}
