import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';

// Planar-reflection rivers (toggled by the "Water reflections" setting).
export class Rivers {
  constructor(scene, city) {
    this.city = city; this.scene = scene; this.water = null;
  }
  set(on) {
    if (on && !this.water) {
      const n = this.city.T.waterN.clone(); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.needsUpdate = true;
      this.water = new Water(new THREE.PlaneGeometry(4000, 4000), { textureWidth: 512, textureHeight: 512, waterNormals: n, sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x0a2233, distortionScale: 2.2, fog: true, alpha: 1 });
      this.water.rotation.x = -Math.PI / 2; this.water.position.y = -1.55;
      this.water.material.uniforms.size.value = 6;
      this.scene.add(this.water);
    }
    if (this.water) this.water.visible = on;
    this.city.river.visible = !on;
  }
  update(dt, sunDir, sunCol) {
    if (!this.water || !this.water.visible) return;
    const u = this.water.material.uniforms; u.time.value += dt * 0.6; u.sunDirection.value.copy(sunDir); u.sunColor.value.copy(sunCol);
  }
}
