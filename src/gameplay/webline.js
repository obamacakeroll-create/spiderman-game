import * as THREE from 'three';

// A web strand rendered as a chain of thin cylinders along a sagging curve.
const SEG = 14;
const geo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
export class WebLine {
  constructor(scene, color = 0xf2f4f8, thick = 0.035, emissive = 0x000000) {
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive, emissiveIntensity: emissive ? 2 : 0 }), SEG);
    this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
    this.thick = thick; this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.sag = 0; this.extend = 1;
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  set(a, b, sag = 0, extend = 1) { this.a.copy(a); this.b.copy(b); this.sag = sag; this.extend = extend; this.mesh.visible = true; this.update(); }
  hide() { this.mesh.visible = false; }
  point(t, out) {
    out.lerpVectors(this.a, this.b, t);
    out.y -= Math.sin(t * Math.PI) * this.sag;
    return out;
  }
  update() {
    const m = this._m, p = this._p, q = this._q;
    for (let i = 0; i < SEG; i++) {
      const t0 = (i / SEG) * this.extend, t1 = ((i + 1) / SEG) * this.extend;
      this.point(t0, p); this.point(t1, q);
      const len = p.distanceTo(q);
      m.lookAt(p, q, this._up); // orients -Z toward q... compose manually
      const dir = q.clone().sub(p).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      m.compose(p, quat, new THREE.Vector3(this.thick, this.thick, len));
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
