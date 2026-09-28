import * as THREE from 'three';

export class CameraRig {
  constructor(camera, col) {
    this.cam = camera; this.col = col;
    this.yaw = 0; this.pitch = -0.15; this.dist = 6;
    this.target = new THREE.Vector3(); this.pos = new THREE.Vector3(0, 30, 30);
    this.shakeAmt = 0; this.fov = 65; this.roll = 0;
    this.cine = null; // {update(dt) -> {pos, look, fov}}
    this.lock = null; // combat focus point
    this.baseFov = 64; this.shakeMul = 1; this.auto = true; this.photo = null;
  }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a * this.shakeMul); }
  input(dx, dy, sens = 0.0024) {
    this.yaw -= dx * sens; this.pitch -= dy * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.35, 1.0);
  }
  update(dt, hero, rawDt) {
    if (this.cine) {
      const c = this.cine.update(rawDt);
      if (c) { this.cam.position.copy(c.pos); this.cam.lookAt(c.look); this.cam.fov = THREE.MathUtils.damp(this.cam.fov, c.fov || 55, 4, rawDt); this.cam.updateProjectionMatrix(); this.pos.copy(c.pos); this.target.copy(c.look); return; }
      this.cine = null;
    }
    const sp = hero.speed;
    const swinging = hero.state === 'swing' || hero.state === 'pull';
    const want = hero.center.clone();
    if (hero.state === 'wall') want.addScaledVector(hero.wallN, 1.2);
    this.target.lerp(want, 1 - Math.exp(-(swinging ? 10 : 14) * rawDt));
    // auto-follow yaw behind velocity when moving fast and no mouse input recently
    this.idle = (this.idle || 0) + rawDt;
    if (this.auto && this.idle > 1.2 && sp > 12 && hero.state !== 'wall') {
      const vy = Math.atan2(-hero.vel.x, -hero.vel.z);
      let d = vy - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      this.yaw += d * (1 - Math.exp(-1.2 * rawDt));
    }
    const baseD = (hero.def.id === 'venom' ? 8 : 5.5) + Math.min(sp, 60) * 0.06 + (swinging ? 1.5 : 0);
    this.dist = THREE.MathUtils.damp(this.dist, this.lock ? baseD + 2.5 : baseD, 3, rawDt);
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const look = this.target.clone().add(new THREE.Vector3(0, 0.5, 0));
    let d = this.dist;
    const hit = this.col.raycast(look, off, d + 0.5);
    if (hit) d = Math.max(1.2, hit.dist - 0.5);
    const desired = look.clone().addScaledVector(off, d);
    // shoulder offset
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    desired.addScaledVector(right, 0.6);
    if (desired.y < 0.6) desired.y = 0.6;
    this.pos.copy(desired);
    this.cam.position.copy(this.pos);
    // shake
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * this.shakeAmt * 0.6;
      this.cam.position.x += (Math.random() - .5) * s; this.cam.position.y += (Math.random() - .5) * s; this.cam.position.z += (Math.random() - .5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - rawDt * 2.5);
    }
    this.cam.lookAt(look.addScaledVector(right, 0.6));
    const vdir = hero.vel.clone(); const lateral = vdir.dot(right);
    this.roll = THREE.MathUtils.damp(this.roll, swinging ? -lateral * 0.006 : 0, 3, rawDt);
    this.cam.rotateZ(this.roll);
    const fov = this.baseFov + Math.min(Math.max(sp - 10, 0), 50) * 0.45 + (hero.buffs.overclock ? 6 : 0);
    this.cam.fov = THREE.MathUtils.damp(this.cam.fov, fov, 4, rawDt); this.cam.updateProjectionMatrix();
  }
}
