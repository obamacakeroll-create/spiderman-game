import * as THREE from 'three';
import { Rig, Poses, SUITS } from './rig.js';
import { dampAngle } from './hero.js';

export const ARCHETYPES = {
  thug: { hp: 60, dmg: 9, speed: 6.5, range: 2.0, cd: [1.6, 3.2], windup: 0.55, scale: 1, bulk: 1.05, colors: { jacket: 0x3a3f4a, pants: 0x22252b, skin: 0x9a6f55, accent: 0x9c1b1b }, mask: true, xp: 20 },
  gunner: { hp: 45, dmg: 8, speed: 5.5, range: 26, cd: [2.2, 3.6], windup: 0.85, scale: 1, bulk: 1, colors: { jacket: 0x4a4232, pants: 0x2b2b25, skin: 0x7a5a45, accent: 0x111111 }, mask: true, ranged: true, xp: 25 },
  brute: { hp: 240, dmg: 22, speed: 5, range: 2.8, cd: [2.5, 4], windup: 0.9, scale: 1.4, bulk: 1.4, colors: { jacket: 0x5a2020, pants: 0x1b1b1b, skin: 0x8a6048, accent: 0x333333 }, unblockable: true, xp: 60 },
  shield: { hp: 90, dmg: 10, speed: 5.5, range: 2.2, cd: [2, 3.5], windup: 0.6, scale: 1.05, bulk: 1.15, colors: { jacket: 0x283850, pants: 0x1a1f28, skin: 0x8a6a55, accent: 0x6a7a90 }, mask: true, shield: true, xp: 35 },
  jetpack: { hp: 55, dmg: 8, speed: 8, range: 24, cd: [2, 3], windup: 0.8, scale: 1, bulk: 1, colors: { jacket: 0x2f3a2f, pants: 0x1f241f, skin: 0x8a6a55, accent: 0xff8a20 }, mask: true, ranged: true, flying: true, xp: 40 },
  symbiote: { hp: 85, dmg: 12, speed: 9, range: 2.2, cd: [1.2, 2.4], windup: 0.45, scale: 1.08, bulk: 1.1, colors: { jacket: 0x0a0a12, pants: 0x0a0a12, skin: 0x0a0a12, accent: 0xeeeeee }, regen: 6, xp: 45, symb: true },
  carapace: { hp: 1100, dmg: 26, speed: 7, range: 3.4, cd: [1.4, 2.4], windup: 0.8, scale: 1.8, bulk: 1.5, colors: { jacket: 0xb85a14, pants: 0x1c1c1c, skin: 0x333333, accent: 0xd2742a }, armor: true, boss: 'CARAPACE', unblockable: true, xp: 500 },
  venomBoss: { hp: 1500, dmg: 20, speed: 13, range: 3.2, cd: [0.9, 1.8], windup: 0.5, scale: 1.45, bulk: 1.35, suit: 'venom', boss: 'VENOM', xp: 800 },
  warden: { hp: 1800, dmg: 18, speed: 4, range: 40, cd: [1.6, 2.6], windup: 1.0, scale: 1, boss: 'THE WARDEN', mech: true, xp: 1000 },
};

let ENEMY_ID = 0;
export class Enemy {
  constructor(G, type, pos, opts = {}) {
    this.G = G; this.type = type; this.a = ARCHETYPES[type]; this.id = ENEMY_ID++;
    const a = this.a;
    this.maxHp = this.hp = a.hp * (opts.hpMul || 1);
    this.pos = pos.clone(); this.vel = new THREE.Vector3(); this.yaw = Math.random() * 6;
    this.state = opts.unaware ? 'idle' : 'chase'; this.stateT = 0; this.t = Math.random() * 10;
    this.cd = 1 + Math.random() * 2; this.alive = true; this.webHits = 0; this.webbedT = 0; this.stunT = 0;
    this.detect = 0; this.home = pos.clone(); this.tag = opts.tag;
    if (a.mech) this.buildMech(); else {
      this.rig = new Rig({ scale: a.scale, bulk: a.bulk });
      if (a.suit) this.rig.dress(SUITS[a.suit]); else this.rig.dress(null, { colors: a.colors, mask: a.mask, armor: a.armor });
      if (a.shield) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x8aa0b8, metalness: 0.8, roughness: 0.3, emissive: 0x203050 })); s.rotation.x = Math.PI / 2; s.position.set(0, -0.15, 0.1); this.rig.j.elL.add(s); this.shieldMesh = s; }
      if (a.flying) { const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x444, metalness: 0.8, roughness: 0.3 })); pack.position.set(0, 0.1, -0.2); this.rig.j.chest.add(pack); this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false })); this.flame.rotation.x = Math.PI; this.flame.position.set(0, -0.4, -0.2); this.rig.j.chest.add(this.flame); }
      if (a.ranged && !a.flying) { const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x111, metalness: 0.9, roughness: 0.3 })); gun.position.set(0, -0.25, 0.15); gun.rotation.x = -Math.PI / 2; this.rig.j.handR.add(gun); }
      this.root = this.rig.root;
    }
    G.scene.add(this.root);
    this.laser = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.8 }));
    this.laser.visible = false; this.laser.frustumCulled = false; G.scene.add(this.laser);
    if (a.flying) this.pos.y += 6;
  }
  buildMech() {
    const g = new THREE.Group();
    const armor = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.85, roughness: 0.35 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xd9a21b, metalness: 0.9, roughness: 0.3 });
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a10, emissiveIntensity: 3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3), armor); body.position.y = 5.2; g.add(body);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0x102030, metalness: 0.2, roughness: 0.05, transmission: 0.2, clearcoat: 1 })); cockpit.position.set(0, 6.4, 1.1); g.add(cockpit);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), this.coreMat); core.position.set(0, 5, 1.55); g.add(core);
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 1.8, 4.4, 0); g.add(hip);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.9), armor); thigh.position.y = -1.3; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -2.6; hip.add(knee);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.8), trim); shin.position.y = -1.1; knee.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 2), armor); foot.position.set(0, -2.1, 0.3); knee.add(foot);
      this.legs.push({ hip, knee });
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 3), armor); arm.position.set(s * 2.5, 5.2, 1.2); g.add(arm);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.2, 10), trim); barrel.rotation.x = Math.PI / 2; barrel.position.set(s * 2.5, 5.2, 3.2); g.add(barrel);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.root = g; this.mechScale = 1;
  }
  get center() { return (this._c || (this._c = new THREE.Vector3())).copy(this.pos).setY(this.pos.y + (this.a.mech ? 5 : 1.1 * this.a.scale)); }
  get airborne() { return this.pos.y > this.ground + 0.6 && !this.a.flying; }
  dispose() { this.G.scene.remove(this.root); this.G.scene.remove(this.laser); }

  hit(dmg, dir, kind, hero) {
    if (!this.alive) return false;
    const a = this.a;
    let mult = 1;
    if (a.shield && kind === 'light' && dir && Math.cos(this.yaw) * -dir.z + Math.sin(this.yaw) * -dir.x > 0.3 && this.state !== 'stagger' && this.webbedT <= 0) { mult = 0.15; this.G.fx.sparks(this.center, 0x9fc8ff); this.G.hud.style('BLOCKED — attack from behind or air', 0); }
    if (a.armor && this.stunT <= 0) mult *= 0.45;
    if (this.webbedT > 0) mult *= 1.5;
    this.hp -= dmg * mult;
    const kb = kind === 'heavy' ? 12 : kind === 'launch' ? 3 : kind === 'finisher' ? 18 : kind === 'slam' ? 4 : 4;
    if (!a.boss || this.stunT > 0) {
      if (dir) { this.vel.x = dir.x * kb * (a.boss ? 0.2 : 1); this.vel.z = dir.z * kb * (a.boss ? 0.2 : 1); }
      if (kind === 'launch' && !a.boss) { this.vel.y = 13; this.juggle = 1.4; }
      if (kind === 'slam') this.vel.y = -30;
      if (kind === 'heavy' && !a.boss) this.vel.y = 5;
      if (!a.boss) { this.state = 'stagger'; this.stateT = 0; this.laser.visible = false; this.attackAt = null; }
    }
    if (this.state === 'idle') this.alert();
    if (this.hp <= 0) this.kill(hero, kind);
    return true;
  }
  alert() { if (this.state === 'idle') { this.state = 'chase'; this.G.combat?.alertNear(this.pos, 30); } }
  kill(hero, kind) {
    this.alive = false; this.state = 'down'; this.stateT = 0; this.laser.visible = false; this.attackAt = null;
    this.G.combat?.onKill(this, hero, kind);
  }
  update(dt, heroes) {
    const G = this.G, a = this.a; this.t += dt; this.stateT += dt;
    this.ground = G.col.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5, 0.2);
    if (this.stunT > 0) this.stunT -= dt;
    // target nearest hero
    let tgt = null, td = 1e9;
    for (const h of heroes) { if (!h.rig.root.visible || h.dead) continue; const d = h.pos.distanceTo(this.pos); if (d < td) { td = d; tgt = h; } }
    this.target = tgt;
    if (!this.alive) {
      this.vel.y -= 30 * dt; this.pos.addScaledVector(this.vel, dt);
      if (this.pos.y < this.ground) { this.pos.y = this.ground; this.vel.multiplyScalar(0.8); }
      this.animate(dt, 'down');
      return;
    }
    if (a.regen && this.state !== 'stagger' && this.webbedT <= 0) this.hp = Math.min(this.maxHp, this.hp + a.regen * dt);
    if (this.webbedT > 0) { this.webbedT -= dt; this.vel.x *= 0.9; this.vel.z *= 0.9; }
    const toT = tgt ? tmpV.copy(tgt.pos).sub(this.pos) : tmpV.set(0, 0, 0); toT.y = 0; const dist = toT.length(); if (dist > 0) toT.divideScalar(dist);
    let pose = null;
    switch (this.state) {
      case 'idle': {
        // patrol + vision cone
        const ang = this.t * 0.3 + this.id;
        const patrol = this.home.clone().add(new THREE.Vector3(Math.sin(ang) * 6, 0, Math.cos(ang) * 6)).sub(this.pos).setY(0);
        if (patrol.length() > 0.5) { patrol.normalize(); this.vel.x = patrol.x * 1.5; this.vel.z = patrol.z * 1.5; this.yaw = dampAngle(this.yaw, Math.atan2(patrol.x, patrol.z), 3, dt); }
        pose = Poses.run(this.t * 4, 0.3);
        if (tgt && td < 24) {
          const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const seen = fwd.dot(toT) > 0.55 && Math.abs(tgt.pos.y - this.pos.y) < 8;
          this.detect += (seen ? (26 - td) / 10 : -0.5) * dt; this.detect = Math.max(0, this.detect);
          if (this.detect > 1) { this.alert(); G.hud.notify('Spotted!'); }
        }
        break;
      }
      case 'chase': {
        if (!tgt) break;
        const want = a.ranged ? a.range * 0.6 : a.range * 0.9;
        this.yaw = dampAngle(this.yaw, Math.atan2(toT.x, toT.z), 8, dt);
        if (td > want + 1) { this.vel.x = toT.x * a.speed; this.vel.z = toT.z * a.speed; pose = Poses.run(this.t * 9, 0.9); }
        else if (a.ranged && td < want - 4) { this.vel.x = -toT.x * a.speed * 0.6; this.vel.z = -toT.z * a.speed * 0.6; pose = Poses.run(-this.t * 7, 0.6); }
        else {
          // circle strafe
          const side = (this.id % 2 ? 1 : -1);
          this.vel.x = -toT.z * side * 2 * (a.boss ? 0 : 1); this.vel.z = toT.x * side * 2 * (a.boss ? 0 : 1);
          pose = a.ranged ? Poses.aim() : Poses.run(this.t * 5, 0.3);
        }
        this.cd -= dt;
        const inRange = a.ranged ? td < a.range + 4 : td < a.range + 0.5;
        if (this.cd <= 0 && inRange && G.combat.canAttack(this, tgt)) this.startAttack(tgt);
        if (a.boss) this.bossThink(dt, tgt, td, toT);
        break;
      }
      case 'windup': {
        this.vel.x *= 0.85; this.vel.z *= 0.85;
        if (tgt) this.yaw = dampAngle(this.yaw, Math.atan2(toT.x, toT.z), a.ranged ? 10 : 4, dt);
        pose = a.ranged ? Poses.aim() : Poses.windup();
        if (a.ranged && tgt) { const p = this.laser.geometry.attributes.position; const c = this.center; p.setXYZ(0, c.x, c.y + 0.2, c.z); const h = tgt.center; p.setXYZ(1, h.x, h.y, h.z); p.needsUpdate = true; this.laser.visible = true; }
        if (this.attackKind === 'charge') { pose = Poses.run(this.t * 12, 1); }
        if (G.time.now >= this.attackAt) this.doAttack(tgt);
        break;
      }
      case 'charging': {
        this.vel.x = this.chargeDir.x * 26; this.vel.z = this.chargeDir.z * 26; pose = Poses.run(this.t * 14, 1.1);
        for (const h of heroes) if (h.pos.distanceTo(this.pos) < 2.8 && h.invuln <= 0) G.combat.damageHero(h, a.dmg * 1.3, this, true);
        if (this.stateT > 1.4) { this.state = 'recover'; this.stateT = 0; }
        break;
      }
      case 'recover': this.vel.x *= 0.8; this.vel.z *= 0.8; pose = Poses.idle(this.t); if (this.stateT > 0.5) { this.state = 'chase'; } break;
      case 'stagger': {
        pose = this.stunT > 0 ? Poses.cower() : Poses.hurt();
        if (this.juggle > 0) { this.juggle -= dt; }
        if (this.stateT > (this.airborne ? 2.5 : 0.55) && !this.airborne) { this.state = 'chase'; this.cd = Math.max(this.cd, 0.6); }
        break;
      }
    }
    if (this.webbedT > 0) pose = Poses.cower();
    // physics
    const flying = a.flying && this.alive;
    if (flying) {
      const want = (tgt ? Math.max(tgt.pos.y, this.ground) : this.ground) + 6 + Math.sin(this.t) * 1.5;
      if (this.state !== 'stagger' && this.webbedT <= 0) this.vel.y = THREE.MathUtils.damp(this.vel.y, (want - this.pos.y) * 2, 3, dt);
      else this.vel.y -= 30 * dt;
      if (this.flame) this.flame.scale.setScalar(0.7 + Math.random() * 0.6);
    } else {
      const g = (this.juggle > 0 && this.state === 'stagger') ? 6 : 30;
      this.vel.y -= g * dt;
    }
    this.pos.addScaledVector(this.vel, dt);
    const n = tmpN.set(0, 0, 0);
    if (G.col.resolve(this.pos, 0.5 * (a.scale || 1), 1.6, n) && n.lengthSq() > 0) {
      const into = -this.vel.dot(n);
      if (this.state === 'charging') { this.state = 'stagger'; this.stateT = 0; this.stunT = 3; G.cam.shake(0.5); G.audio.boom(); G.hud.notify('Carapace is STUNNED — hit him now!'); }
      if (into > 10 && this.state === 'stagger' && !a.boss) { this.webbedT = 6; G.hud.style('WALL WEBBED', 15); this.hit(30, null, 'env'); }
      if (into > 0) this.vel.addScaledVector(n, into);
    }
    if (this.pos.y < this.ground) {
      if (this.vel.y < -18 && !flying) { this.hit(15, null, 'env'); G.fx.dust(this.pos, 8); }
      if (this.slamming && this.stateT > -1.0) { this.slamming = false; G.cam.shake(0.8); G.audio.boom(); G.fx.dust(this.pos, 40); G.fx.goo(this.center, 30); for (const h of heroes) if (h.pos.distanceTo(this.pos) < 6 && h.invuln <= 0) G.combat.damageHero(h, 25, this, true); this.state = 'recover'; this.stateT = 0; }
      this.pos.y = this.ground; this.vel.y = 0;
      if (this.state !== 'charging') { this.vel.x *= Math.pow(0.02, dt); this.vel.z *= Math.pow(0.02, dt); }
    }
    this.animate(dt, pose);
  }
  startAttack(tgt) {
    const a = this.a;
    this.state = 'windup'; this.stateT = 0; this.attackTarget = tgt;
    this.attackKind = a.ranged ? 'shot' : 'melee';
    if (this.type === 'carapace' && Math.random() < 0.35 && this.pos.distanceTo(tgt.pos) > 8) this.attackKind = 'charge';
    const w = a.windup * (this.attackKind === 'charge' ? 1.3 : 1);
    this.attackAt = this.G.time.now + w;
    this.unblockable = a.unblockable || this.attackKind === 'charge';
  }
  doAttack(tgt) {
    const G = this.G, a = this.a;
    this.laser.visible = false; this.attackAt = null;
    this.cd = a.cd[0] + Math.random() * (a.cd[1] - a.cd[0]);
    this.state = 'recover'; this.stateT = 0;
    if (!tgt) return;
    if (this.attackKind === 'charge') { this.state = 'charging'; this.stateT = 0; this.chargeDir = tgt.pos.clone().sub(this.pos).setY(0).normalize(); G.audio.roar(); return; }
    if (this.attackKind === 'shot') {
      G.audio.gun(); G.fx.sparks(this.center.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xffc060);
      G.combat.tracer(this.center, tgt.center);
      if (tgt.invuln <= 0 && this.pos.distanceTo(tgt.pos) < a.range + 6) G.combat.damageHero(tgt, a.dmg, this);
      return;
    }
    this.rig && this.rig.pose(Poses.punchR(), 1, 60);
    if (tgt.pos.distanceTo(this.pos) < a.range + 1.2 && tgt.invuln <= 0) G.combat.damageHero(tgt, a.dmg, this, this.unblockable);
    else G.audio.whoosh(0.5);
  }
  bossThink(dt, tgt, td, toT) {
    const G = this.G;
    this.special = (this.special ?? 4) - dt;
    const phase2 = this.hp < this.maxHp * 0.5;
    if (this.special > 0) return;
    if (this.type === 'carapace' && phase2) {
      this.special = 7; G.hud.notify('Missile volley — DODGE!');
      for (let i = 0; i < 6; i++) setTimeout(() => this.alive && G.combat.missile(this.center.clone().add(new THREE.Vector3(0, 2, 0)), tgt), i * 250);
    } else if (this.type === 'venomBoss') {
      this.special = phase2 ? 6 : 9;
      if (phase2 && G.combat.enemies.filter(e => e.alive && e.type === 'symbiote').length < 3) {
        G.audio.roar(); G.cam.shake(0.6); G.hud.notify('Venom spawns symbiote hosts!');
        for (let i = 0; i < 3; i++) G.combat.spawn('symbiote', this.pos.clone().add(new THREE.Vector3(Math.sin(i * 2) * 6, 0, Math.cos(i * 2) * 6)));
      } else { // leap slam at player
        this.vel.copy(toT).multiplyScalar(td * 0.9).setY(16); this.state = 'stagger'; this.stateT = -1.2; this.slamming = true;
        G.audio.roar();
      }
    } else if (this.type === 'warden') {
      this.special = phase2 ? 6 : 9;
      if (G.combat.enemies.filter(e => e.alive && e.type === 'jetpack').length < (phase2 ? 4 : 2)) {
        G.hud.notify('The Warden deploys jet troopers!');
        for (let i = 0; i < 2; i++) G.combat.spawn('jetpack', this.pos.clone().add(new THREE.Vector3((i - .5) * 10, 8, 4)));
      }
      for (let i = 0; i < (phase2 ? 8 : 4); i++) setTimeout(() => this.alive && G.combat.missile(this.center.clone().add(new THREE.Vector3(0, 3, 0)), tgt), i * 220);
    }
  }
  animate(dt, pose) {
    if (this.a.mech) {
      this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
      const w = Math.hypot(this.vel.x, this.vel.z) * 0.3 * this.t;
      this.legs.forEach((l, i) => { l.hip.rotation.x = Math.sin(this.t * 3 + i * Math.PI) * 0.4 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 3); l.knee.rotation.x = Math.max(0, -Math.sin(this.t * 3 + i * Math.PI)) * 0.6; });
      this.coreMat.emissiveIntensity = 2 + Math.sin(this.t * 6) * 1 + (this.hp < this.maxHp * 0.3 ? 4 : 0);
      if (!this.alive) { this.root.rotation.z = Math.min(this.root.rotation.z + dt, 1.2); }
      return;
    }
    if (pose === 'down') { pose = Poses.down(); this.rig.root.rotation.x = THREE.MathUtils.damp(this.rig.root.rotation.x, -Math.PI / 2, 8, dt); }
    this.rig.pose(pose || Poses.idle(this.t), dt, this.state === 'windup' ? 8 : 14);
    this.rig.root.position.copy(this.pos);
    if (this.alive) { this.rig.root.rotation.set(this.a.flying ? 0.3 : 0, this.yaw, this.juggle > 0 && this.airborne ? Math.sin(this.t * 10) * 0.4 : 0); }
    else this.rig.root.rotation.y = this.yaw;
    if (this.webbedT > 0 && !this.webMesh) { this.webMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55 * this.a.scale, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.9, transparent: true, opacity: 0.85, wireframe: false })); this.webMesh.scale.set(1, 1.7, 1); this.webMesh.position.y = 1; this.rig.root.add(this.webMesh); }
    if (this.webMesh) this.webMesh.visible = this.webbedT > 0 || (!this.alive && this.webWrapped);
  }
}
const tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3();
