import * as THREE from 'three';
import { Rig, Poses, SUITS } from './rig.js';
import { HERO_DEFS } from './heroes.js';
import { WebLine } from '../gameplay/webline.js';
import { ISLAND } from '../world/city.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmpN = new THREE.Vector3();
const GRAV = 30;

export class Hero {
  constructor(G, id) {
    this.G = G; this.id = id; this.def = HERO_DEFS[id];
    this.rig = new Rig({ scale: this.def.scale, bulk: this.def.bulk, ...this.def.body });
    this.suitId = this.def.suit; this.rig.dress(SUITS[this.suitId]);
    G.scene.add(this.rig.root);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.state = 'air'; this.stateT = 0; this.t = 0;
    this.maxHp = this.def.stats.hp; this.hp = this.maxHp; this.focus = 0;
    this.anchor = null; this.ropeLen = 0; this.swingSide = 1; this.swingT = 0;
    this.wallN = new THREE.Vector3(); this.wallBox = null;
    this.zipTarget = null; this.perchT = 0;
    this.action = null; this.airCombo = false; this.invuln = 0;
    this.trickT = 0; this.flipT = 0; this.flipAxis = 0; this.landT = 0;
    this.cooldowns = {}; this.buffs = {};
    const venom = this.def.traversal === 'symbiote';
    this.webs = [new WebLine(G.scene, venom ? 0x0a0a10 : 0xeef2f8, venom ? 0.09 : 0.035), new WebLine(G.scene, venom ? 0x0a0a10 : 0xeef2f8, venom ? 0.09 : 0.035)];
    this.quat = new THREE.Quaternion();
    this.lastGround = new THREE.Vector3();
    this.ai = false; this.speed = 0; this.airTime = 0; this.glide = false;
  }
  get stats() { return this.def.stats; }
  mod(k) { return this.G.progress ? this.G.progress.mod(this.id, k) : 0; }
  setSuit(id) { this.suitId = id; this.rig.dress(SUITS[id]); }
  get center() { return tmp2.copy(this.pos).setY(this.pos.y + 1.1 * this.def.scale); }
  setVisible(v) { this.rig.root.visible = v; if (!v) this.webs.forEach(w => w.hide()); }
  teleport(p) { this.pos.copy(p); this.vel.set(0, 0, 0); this.state = 'air'; this.anchor = null; this.action = null; this.webs.forEach(w => w.hide()); }

  groundHeight(x, z, y) {
    const outside = x < ISLAND.minX - 20 || x > ISLAND.maxX + 20 || z < ISLAND.minZ - 20 || z > ISLAND.maxZ + 20;
    const g = this.G.col.groundAt(x, z, y, 0.3);
    if (outside && g <= 0) return -1.6;
    return g;
  }

  handPos(side, out = new THREE.Vector3()) { return this.rig.j[side > 0 ? 'handL' : 'handR'].getWorldPosition(out); }

  // --- traversal helpers
  tryAttach(inp, camFwd, moveDir) {
    const G = this.G, venom = this.def.traversal === 'symbiote';
    const vh = tmp.set(this.vel.x, 0, this.vel.z); const sp = vh.length();
    const fwd = new THREE.Vector3();
    if (sp > 4) fwd.copy(vh).normalize().multiplyScalar(0.55); else fwd.copy(camFwd).setY(0).normalize().multiplyScalar(0.3);
    if (moveDir.lengthSq() > 0.01) fwd.addScaledVector(moveDir, 0.8);
    else fwd.addScaledVector(tmpN.copy(camFwd).setY(0).normalize(), 0.35);
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, UP);
    this.swingSide *= -1;
    const desired = this.pos.clone().addScaledVector(fwd, 20 + Math.min(sp, 40) * 0.35).addScaledVector(UP, 18 + Math.min(sp, 40) * 0.2).addScaledVector(right, this.swingSide * 6);
    let a = G.col.findAnchor(this.pos, desired, venom ? 85 : 72, 4);
    if (!a && this.pos.y > 10) a = desired; // high up: sky anchor fallback keeps flow going
    if (!a) return false;
    this.anchor = a; this.ropeLen = this.pos.distanceTo(a) * 0.92;
    this.state = venom ? 'pull' : 'swing'; this.stateT = 0; this.swingT = 0;
    if (!this.ai || this.pos.distanceTo(G.player.pos) < 80) G.fx?.burst(a, 10, venom ? 0x201830 : 0xffffff, 3, 0.35, 0.12, 4);
    if (sp < 12) this.vel.addScaledVector(fwd, 8);
    G.audio?.thwip(this.pos);
    return true;
  }
  release(jump) {
    const fwd = tmp.set(this.vel.x, 0, this.vel.z).normalize();
    const boost = 1 + this.mod('release');
    const apex = this.vel.y > -2 && this.vel.y < 10;
    this.vel.addScaledVector(fwd, 5 * boost).addScaledVector(UP, (jump ? 11 : 5) * boost);
    if (apex) { this.vel.addScaledVector(fwd, 5); this.G.hud?.style('PERFECT RELEASE', 25); }
    this.anchor = null; this.state = 'air'; this.stateT = 0; this.trickT = 1.2;
    this.webs.forEach(w => w.hide());
    if (jump || Math.random() < 0.35) { this.flipT = 0.6; this.flipAxis = Math.random() < 0.7 ? 0 : 1; }
  }
  startZip(point, normal, launch) {
    this.zipTarget = point.clone(); this.zipNormal = normal.clone(); this.state = 'zip'; this.stateT = 0; this.anchor = point.clone();
    this.G.audio?.thwip(this.pos, 1.3);
  }

  enterWall(n, box) {
    this.state = 'wall'; this.stateT = 0; this.wallN.copy(n); this.wallBox = box;
    const into = -this.vel.dot(n);
    const vy = Math.max(this.vel.y, 0) + Math.hypot(this.vel.x, this.vel.z) * 0.6;
    this.vel.set(0, Math.min(vy, 30), 0);
    this.anchor = null; this.webs.forEach(w => w.hide());
  }

  update(dt, inp, camYaw) {
    const G = this.G; this.t += dt; this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    for (const k in this.buffs) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) delete this.buffs[k]; }
    const s = this.stats, venom = this.def.traversal === 'symbiote';
    const ax = inp.moveAxis();
    const camFwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const camRight = new THREE.Vector3(-camFwd.z, 0, camFwd.x);
    const moveDir = new THREE.Vector3().addScaledVector(camFwd, ax.y).addScaledVector(camRight, ax.x);
    const moving = moveDir.lengthSq() > 0.01;
    const swingKey = inp.down('ShiftLeft', 'ShiftRight', 'Mouse2');
    const overclock = this.buffs.overclock ? 1.35 : 1;
    const busy = G.combat?.busy(this);

    // Zip / point launch: E when no combat target
    if (inp.hit('KeyE') && !busy && this.state !== 'zip' && !G.combat?.hasTarget(this)) {
      const cam = G.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
      const hit = G.col.raycast(cam.position, dir, 140);
      if (hit && hit.point.distanceTo(this.pos) > 4) {
        const p = hit.point.clone();
        if (hit.normal.y < 0.5 && hit.box.maxY - p.y < 10) { p.y = hit.box.maxY; hit.normal.set(0, 1, 0); p.addScaledVector(dir.setY(0).normalize(), 1.2); }
        this.startZip(p, hit.normal);
      }
    }

    switch (this.state) {
      case 'ground': {
        this.airTime = 0; this.glide = false;
        const sprint = swingKey && !busy;
        const target = moving && !busy ? (sprint ? s.sprint : s.run) * overclock : 0;
        const acc = busy ? 30 : 60;
        tmp.copy(moveDir).multiplyScalar(target);
        this.vel.x = THREE.MathUtils.damp(this.vel.x, tmp.x, acc / 10, dt);
        this.vel.z = THREE.MathUtils.damp(this.vel.z, tmp.z, acc / 10, dt);
        if (moving && !busy) this.yaw = dampAngle(this.yaw, Math.atan2(moveDir.x, moveDir.z), 12, dt);
        this.vel.y = 0;
        if (inp.hit('Space') && !busy) {
          this.vel.y = s.jump * (sprint ? 1.2 : 1) * (venom ? 1 : 1); this.state = 'air'; this.stateT = 0;
          if (sprint) this.vel.addScaledVector(moveDir, 4);
          G.audio?.whoosh(0.4);
        }
        // run into wall while sprinting -> wall run
        break;
      }
      case 'air': {
        this.airTime += dt;
        let g = GRAV;
        const dive = inp.down('ControlLeft', 'KeyC') && !this.airCombo;
        if (dive) { g = 55; this.vel.x *= 1 - dt * 0.3; this.vel.z *= 1 - dt * 0.3; }
        this.glide = !venom && inp.down('Space') && this.stateT > 0.35 && this.vel.y < 0 && !this.airCombo;
        if (this.airCombo) g = 4;
        this.vel.y -= g * dt;
        if (this.glide) {
          this.vel.y = Math.max(this.vel.y, -4.5);
          const hs = Math.max(20, Math.hypot(this.vel.x, this.vel.z));
          const d = moving ? moveDir : tmp.set(this.vel.x, 0, this.vel.z).normalize();
          this.vel.x = THREE.MathUtils.damp(this.vel.x, d.x * hs, 2, dt); this.vel.z = THREE.MathUtils.damp(this.vel.z, d.z * hs, 2, dt);
        }
        if (moving) { this.vel.addScaledVector(moveDir, 12 * s.air * dt); }
        const hs = Math.hypot(this.vel.x, this.vel.z); const cap = s.maxSwing * (1 + this.mod('maxSwing')) * overclock;
        if (hs > cap) { this.vel.x *= cap / hs; this.vel.z *= cap / hs; }
        this.vel.y = Math.max(this.vel.y, dive ? -90 : -60);
        if (hs > 2) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 6, dt);
        if (swingKey && !busy && (this.stateT > 0.12 || inp.hit('ShiftLeft', 'ShiftRight', 'Mouse2')) && !this.airCombo) this.tryAttach(inp, camFwd, moveDir);
        if (inp.hit('KeyT') && this.trickT > 0) { this.flipT = 0.6; this.flipAxis = (Math.random() * 3) | 0; this.trickT = 0.8; G.hud?.style(['CORKSCREW', 'BACKFLIP', 'TWISTER', 'SWAN DIVE'][(Math.random() * 4) | 0], 40); G.progress?.addXP(10); }
        break;
      }
      case 'swing': {
        this.swingT += dt;
        this.vel.y -= GRAV * dt;
        const rope = tmp.copy(this.anchor).sub(this.pos); const L = rope.length(); rope.divideScalar(L);
        // tangential pump
        const pump = (moving ? moveDir : tmpN.set(this.vel.x, 0, this.vel.z).normalize()).clone();
        pump.addScaledVector(rope, -pump.dot(rope));
        this.vel.addScaledVector(pump, 18 * s.pump * overclock * dt);
        if (this.vel.y < 0) this.vel.addScaledVector(tmpN.set(this.vel.x, 0, this.vel.z).normalize(), 7 * dt);
        this.pos.addScaledVector(this.vel, dt);
        // rope constraint
        const d = tmp.copy(this.pos).sub(this.anchor); let dl = d.length();
        if (this.pos.y < 3.5) this.ropeLen -= (3.5 - this.pos.y) * 3 * dt * 10;
        this.ropeLen = Math.max(this.ropeLen - dt * 2.5, 8);
        if (dl > this.ropeLen) {
          d.divideScalar(dl); this.pos.copy(this.anchor).addScaledVector(d, this.ropeLen);
          const radial = this.vel.dot(d); if (radial > 0) this.vel.addScaledVector(d, -radial);
        }
        const cap = s.maxSwing * (1 + this.mod('maxSwing')) * overclock; const sp = this.vel.length(); if (sp > cap) this.vel.multiplyScalar(cap / sp);
        this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
        if (inp.hit('Space')) { this.release(true); break; }
        if (!swingKey || this.pos.y > this.anchor.y - 1 || this.swingT > 4) { this.release(false); break; }
        break;
      }
      case 'pull': { // Venom tendril pull-leap
        const toA = tmp.copy(this.anchor).sub(this.pos); const dl = toA.length(); toA.divideScalar(dl);
        this.vel.lerp(toA.multiplyScalar(62 * overclock), 1 - Math.exp(-6 * dt));
        this.vel.y -= 6 * dt;
        if (this.stateT > 0.5 || dl < 10 || !swingKey) {
          this.vel.y += 8; this.anchor = null; this.state = 'air'; this.stateT = 0; this.webs.forEach(w => w.hide());
          G.audio?.whoosh(0.8);
        }
        break;
      }
      case 'zip': {
        const to = tmp.copy(this.zipTarget).sub(this.pos); const dl = to.length();
        const spd = 60 * (1 + this.mod('zip'));
        this.vel.copy(to).divideScalar(Math.max(dl, 0.001)).multiplyScalar(spd);
        if (dl < spd * dt + 0.5) {
          this.pos.copy(this.zipTarget); this.anchor = null; this.webs.forEach(w => w.hide());
          if (this.zipNormal.y > 0.5) { this.state = 'perch'; this.stateT = 0; this.vel.set(0, 0, 0); G.audio?.land(0.3); }
          else { this.enterWall(this.zipNormal, null); this.vel.set(0, 0, 0); }
        }
        break;
      }
      case 'perch': {
        this.vel.set(0, 0, 0);
        if (inp.hit('Space') || this.stateT > 0.05 && inp.hit('ShiftLeft', 'Mouse2')) {
          // point launch
          const f = moving ? moveDir : camFwd;
          this.vel.copy(f).multiplyScalar(24 * (1 + this.mod('zip') * 0.5)).setY(19);
          this.state = 'air'; this.stateT = 0; this.flipT = 0.6; this.trickT = 1; G.hud?.style('POINT LAUNCH', 30); G.audio?.whoosh(1);
        } else if (moving && this.stateT > 0.2) { this.state = 'ground'; }
        break;
      }
      case 'wall': {
        const n = this.wallN;
        const runUp = swingKey || venom;
        const up = ax.y, side = ax.x;
        const wallRight = tmp.crossVectors(UP, n).normalize(); // along wall
        const camSide = camRight.dot(wallRight) >= 0 ? 1 : -1;
        const vy = runUp ? Math.max(this.vel.y * 0.98, (venom ? 22 : 17) * (up >= 0 ? 1 : -1)) : up * 6;
        this.vel.copy(wallRight).multiplyScalar(side * camSide * (runUp ? 8 : 5));
        this.vel.y = vy;
        this.vel.addScaledVector(n, -2); // stick
        const yaw = Math.atan2(-n.x, -n.z); this.yaw = dampAngle(this.yaw, yaw, 10, dt);
        if (inp.hit('Space')) {
          this.vel.copy(n).multiplyScalar(14).addScaledVector(UP, 11).addScaledVector(camFwd, 6);
          this.state = 'air'; this.stateT = 0; this.flipT = 0.6; G.audio?.whoosh(0.6);
        }
        break;
      }
    }

    // Integrate (swing integrates itself)
    if (this.state !== 'swing' && this.state !== 'perch') this.pos.addScaledVector(this.vel, dt);

    // Collisions
    const wasWall = this.state === 'wall';
    const n = tmpN.set(0, 0, 0);
    const hitWall = G.col.resolve(this.pos, 0.45 * this.def.scale, 1.7 * this.def.scale, n);
    if (hitWall && n.lengthSq() > 0) {
      const into = -this.vel.dot(n);
      if ((this.state === 'air' || this.state === 'swing' || this.state === 'pull') && !this.airCombo && !busy) {
        const hsp = Math.hypot(this.vel.x, this.vel.z);
        if (hsp > 6 || this.state !== 'air') this.enterWall(n.clone(), null);
        else if (into > 0) this.vel.addScaledVector(n, into);
      } else if (this.state === 'ground' && swingKey && into > 3 && !busy) {
        this.enterWall(n.clone(), null); this.vel.y = 14;
      } else if (into > 0) this.vel.addScaledVector(n, into);
      if (this.state === 'wall') this.wallN.copy(n);
      this.touchWall = 0.15;
    }
    if (wasWall) {
      this.touchWall = (this.touchWall || 0) - dt;
      if (!hitWall) {
        // probe: are we still against the wall?
        const probe = this.pos.clone().addScaledVector(this.wallN, -0.8);
        const test = probe.clone(); const nn = new THREE.Vector3();
        const still = G.col.resolve(test, 0.45 * this.def.scale, 0.5, nn);
        if (!still) {
          // reached top or edge: vault
          if (this.vel.y > 2) { this.vel.set(-this.wallN.x * 6, 12, -this.wallN.z * 6); this.flipT = 0.6; G.hud?.style('WALL VAULT', 15); }
          this.state = 'air'; this.stateT = 0;
        } else { this.pos.addScaledVector(this.wallN, -0.02); }
      }
    }

    // Ground
    const gh = this.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= gh + 0.01 && this.vel.y <= 0.01 && this.state !== 'zip') {
      if (gh < -1) { // water: splash back towards land
        this.pos.y = gh; G.fx?.splash(this.pos);
        const toC = tmp.set(-this.pos.x, 0, -this.pos.z).normalize();
        this.vel.copy(toC).multiplyScalar(25).setY(24); this.state = 'air'; this.stateT = 0; G.hud?.notify('Splash! Web-yanked back to shore.');
      } else {
        const impact = -this.vel.y;
        this.pos.y = gh;
        if (this.state !== 'ground' && this.state !== 'perch') {
          if (this.state === 'wall') { /* walked down the wall */ }
          this.state = 'ground'; this.stateT = 0; this.airCombo = false;
          if (impact > 22) { this.landT = 0.45; G.cam?.shake(Math.min(impact / 60, 0.8)); G.audio?.land(1); G.fx?.dust(this.pos, 20); G.combat?.landingImpact(this, impact); }
          else if (impact > 8) { G.audio?.land(0.4); }
          this.webs.forEach(w => w.hide()); this.anchor = null;
        }
        this.lastGround.copy(this.pos);
      }
    } else if (this.state === 'ground' && this.pos.y > gh + 0.6) { this.state = 'air'; this.stateT = 0; }
    else if (this.state === 'ground') this.pos.y = gh;

    this.speed = this.vel.length();
    this.flipT = Math.max(0, this.flipT - dt); this.trickT = Math.max(0, this.trickT - dt); this.landT = Math.max(0, this.landT - dt);
    this.animate(dt, inp);
  }

  animate(dt, inp) {
    const r = this.rig, t = this.t; let pose, rate = 12;
    const U = new THREE.Vector3(0, 1, 0), F = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const act = this.action;
    if (act && act.pose) { pose = act.pose(act.t / act.dur); rate = 22; }
    else switch (this.state) {
      case 'ground': {
        const hs = Math.hypot(this.vel.x, this.vel.z);
        if (this.landT > 0) pose = Poses.heroIdle(t);
        else if (hs > 0.5) { this.runPhase = (this.runPhase || 0) + dt * (4 + hs * 0.55); pose = Poses.run(this.runPhase, Math.min(1.1, 0.4 + hs / 14)); }
        else pose = this.def.id === 'venom' ? Poses.heroIdle(t) : Poses.idle(t);
        break;
      }
      case 'air':
        if (this.flipT > 0) { pose = Poses.flip(t); rate = 20; }
        else if (inp.down('ControlLeft', 'KeyC')) { pose = Poses.dive(t); F.copy(this.vel).normalize(); U.set(0, 1, 0).addScaledVector(F, -F.dot(U)).normalize(); if (U.lengthSq() < 0.1) U.set(0, 0, 1); }
        else if (this.glide) { pose = Poses.fall(t * 0.3); pose.shL = [0, 0, 1.5]; pose.shR = [0, 0, -1.5]; pose.spine = [0.4, 0, 0]; }
        else if (this.vel.y > 3) pose = Poses.jump(t);
        else pose = Poses.fall(t);
        break;
      case 'swing': case 'pull': {
        const rope = new THREE.Vector3().subVectors(this.anchor, this.pos).normalize();
        U.copy(rope).lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize();
        F.set(this.vel.x, this.vel.y * 0.3, this.vel.z).normalize(); F.addScaledVector(U, -F.dot(U)).normalize();
        const phase = THREE.MathUtils.clamp(this.vel.y / 20, -1, 1) * 0.5 + 0.5;
        pose = Poses.swing(this.swingSide, t, phase); rate = 10;
        const hp = this.handPos(this.swingSide);
        const extend = Math.min(1, this.stateT / 0.1);
        this.webs[0].set(hp, this.anchor, this.state === 'pull' ? 0 : Math.max(0, 0.6 - this.stateT * 3), extend);
        break;
      }
      case 'zip': { pose = Poses.webShoot(1); pose.shR = [-2.8, 0, -0.2]; pose.shL = [-2.8, 0, 0.2]; F.copy(this.vel).normalize(); U.set(0, 1, 0).addScaledVector(F, -F.dot(U)); if (U.lengthSq() < 0.01) U.set(0, 0, 1); U.normalize();
        this.webs[0].set(this.handPos(1), this.zipTarget, 0, Math.min(1, this.stateT / 0.08)); this.webs[1].set(this.handPos(-1), this.zipTarget, 0, Math.min(1, this.stateT / 0.08)); break; }
      case 'perch': pose = Poses.perch(t); break;
      case 'wall': {
        U.copy(this.wallN); F.set(0, 1, 0);
        if (Math.abs(this.vel.y) < 1 && Math.hypot(this.vel.x, this.vel.z) > 1) { F.set(this.vel.x, 0, this.vel.z).normalize(); }
        this.wallPhase = (this.wallPhase || 0) + dt * (2 + this.vel.length() * 0.5);
        pose = Poses.wall(this.wallPhase);
        break;
      }
    }
    if (this.hurtT > 0) { this.hurtT -= dt; pose = Poses.hurt(); }
    if (this.dead) pose = Poses.down();
    r.pose(pose, dt, rate); r.tick(this.t);
    // body orientation from basis
    // lean into turns (yaw rate) for weight and flow
    let dy = this.yaw - (this.prevYaw ?? this.yaw); while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.prevYaw = this.yaw; this.lean = THREE.MathUtils.damp(this.lean || 0, THREE.MathUtils.clamp(-dy / Math.max(dt, 1e-3) * 0.06 * Math.min(1, this.speed / 12), -0.55, 0.55), 6, dt);
    if (this.state === 'ground' || this.state === 'air' || this.state === 'swing') U.applyAxisAngle(F.clone().normalize(), this.lean);
    const Fn = F.clone().addScaledVector(U, -F.dot(U)).normalize();
    if (Fn.lengthSq() < 0.5) Fn.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const X = new THREE.Vector3().crossVectors(U, Fn).normalize();
    const m = new THREE.Matrix4().makeBasis(X, U, Fn);
    const target = new THREE.Quaternion().setFromRotationMatrix(m);
    if (this.flipT > 0) {
      const a = (1 - this.flipT / 0.6) * Math.PI * 2;
      const ax = this.flipAxis === 0 ? new THREE.Vector3(1, 0, 0) : this.flipAxis === 1 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      target.multiply(new THREE.Quaternion().setFromAxisAngle(ax, this.flipAxis === 0 ? -a : a));
      this.quat.copy(target);
    } else this.quat.slerp(target, 1 - Math.exp(-14 * dt));
    r.root.quaternion.copy(this.quat);
    // pivot around the body's center when rotated so wall/swing looks right
    const cOff = new THREE.Vector3(0, 0.95 * this.def.scale, 0);
    const rotated = cOff.clone().applyQuaternion(this.quat);
    r.root.position.copy(this.pos).add(cOff).sub(rotated);
    if (this.state === 'wall') r.root.position.addScaledVector(this.wallN, -0.2);
    if (this.state !== 'swing' && this.state !== 'pull' && this.state !== 'zip' && !(this.action && this.action.web)) this.webs.forEach(w => w.hide());
    if (this.state === 'swing' || this.state === 'pull') this.webs[1].hide();
  }
}
export function dampAngle(a, b, k, dt) {
  let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-k * dt));
}
