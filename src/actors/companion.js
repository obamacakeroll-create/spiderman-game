import * as THREE from 'three';
import { VirtualInput } from '../core/input.js';

// AI driver for the non-controlled brother: roams the city by swinging, jumps into nearby fights.
export class CompanionAI {
  constructor(G, hero) { this.G = G; this.h = hero; hero.vin = new VirtualInput(); hero.ai = true; this.t = 0; this.wp = null; this.holdT = 0; this.phase = 'swing'; this.atkT = 0; this.stuck = 0; }
  pickWaypoint() {
    const G = this.G, p = G.player.pos;
    // roam within a few blocks of the player so switching is snappy but they feel independent
    const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 180;
    this.wp = new THREE.Vector3(THREE.MathUtils.clamp(p.x + Math.cos(a) * r, -480, 480), 30, THREE.MathUtils.clamp(p.z + Math.sin(a) * r, -1080, 880));
  }
  update(dt) {
    const G = this.G, h = this.h, vin = h.vin; this.t += dt;
    vin.endFrame();
    // Far away: simulate cheaply off-screen
    const dp = h.pos.distanceTo(G.player.pos);
    if (dp > 450) {
      h.setVisible(false);
      if (!this.wp || h.pos.distanceTo(this.wp) < 20) this.pickWaypoint();
      const to = this.wp.clone().sub(h.pos); to.y = 0; h.pos.addScaledVector(to.normalize(), 30 * dt); h.pos.y = 40;
      return 0;
    }
    if (!h.rig.root.visible) { h.setVisible(true); h.state = 'air'; h.vel.set(0, 5, 0); }
    // fight nearby enemies
    const foe = G.combat.enemies.filter(e => e.alive && e.pos.distanceTo(h.pos) < 45).sort((a, b) => a.pos.distanceTo(h.pos) - b.pos.distanceTo(h.pos))[0];
    let yaw;
    if (foe) {
      const d = foe.pos.distanceTo(h.pos);
      yaw = Math.atan2(-(foe.pos.x - h.pos.x), -(foe.pos.z - h.pos.z));
      vin.axis = d > 3 ? { x: 0, y: 1 } : { x: 0, y: 0 };
      vin.set('ShiftLeft', d > 20 && h.state !== 'ground');
      if (h.state === 'ground' && d > 12 && Math.random() < dt * 2) vin.set('Space', true); else vin.set('Space', false);
      this.atkT -= dt;
      if (d < 14 && this.atkT <= 0) { vin.set('Mouse0', true); this.atkT = 0.28 + Math.random() * 0.2; } else vin.set('Mouse0', false);
      const threat = G.combat.enemies.find(e => e.alive && e.state === 'windup' && e.attackTarget === h && e.attackAt - G.time.now < 0.3);
      vin.set('KeyF', !!threat && Math.random() < 0.7);
      if (Math.random() < dt * 0.3) vin.set('Digit' + (1 + ((Math.random() * 3) | 0)), true); else ['Digit1', 'Digit2', 'Digit3'].forEach(k => vin.set(k, false));
      if (h.focus >= 33 && Math.random() < dt) vin.set('KeyX', true); else vin.set('KeyX', false);
    } else {
      vin.set('Mouse0', false); vin.set('KeyF', false); vin.set('KeyX', false);
      if (!this.wp || h.pos.distanceTo(this.wp) < 40) this.pickWaypoint();
      yaw = Math.atan2(-(this.wp.x - h.pos.x), -(this.wp.z - h.pos.z));
      vin.axis = { x: 0, y: 1 };
      if (h.state === 'ground' || h.state === 'perch') { vin.set('Space', !vin.down('Space')); vin.set('ShiftLeft', true); }
      else if (h.state === 'wall') { vin.set('ShiftLeft', true); }
      else {
        vin.set('Space', false);
        this.holdT -= dt;
        if (this.holdT <= 0) { this.phase = this.phase === 'swing' ? 'fly' : 'swing'; this.holdT = this.phase === 'swing' ? 0.9 + Math.random() * 0.8 : 0.25 + Math.random() * 0.3; }
        vin.set('ShiftLeft', this.phase === 'swing' || h.pos.y < 12);
      }
    }
    // unstick
    if (h.speed < 1 && !foe) { this.stuck += dt; if (this.stuck > 3) { h.vel.set(0, 25, 0); h.state = 'air'; this.stuck = 0; } } else this.stuck = 0;
    return yaw;
  }
}
