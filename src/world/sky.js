import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

// Day/night cycle, weather (rain), sun/moon light that follows the player for shadows.
export class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.time = 18.2; // hours, start in golden hour
    this.speed = 24 / (24 * 60); // 1 game hour per real minute
    this.sky = new Sky(); this.sky.scale.setScalar(10000); scene.add(this.sky);
    const u = this.sky.material.uniforms; u.turbidity.value = 7; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.82;
    this.envScene = new THREE.Scene(); this.envSky = new Sky(); this.envSky.scale.setScalar(1000); this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sun = new THREE.DirectionalLight(0xfff0dd, 3);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera; c.left = c.bottom = -120; c.right = c.top = 120; c.near = 1; c.far = 900;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbdd4ff, 0x40362c, 0.8); scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0x9fb3c8, 0.0011);
    this.sunDir = new THREE.Vector3();
    this.envTimer = 0; this.night = 0;
    // stars
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05; v.multiplyScalar(4000); sp.push(v.x, v.y, v.z); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
    scene.add(this.stars);
    // moon
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
    scene.add(this.moon);
    // rain
    this.weather = 'clear'; this.rainAmt = 0; this.weatherTimer = 120;
    const N = 5000, rp = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (Math.random() - .5) * 120, y = Math.random() * 80, z = (Math.random() - .5) * 120; rp.set([x, y, z, x + 0.1, y - 1.4, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaabbd0, transparent: true, opacity: 0 }));
    this.rain.frustumCulled = false; scene.add(this.rain);
    this.update(0, new THREE.Vector3(), true);
  }
  setWeather(w) { this.weather = w; }
  update(dt, focus, forceEnv = false) {
    this.time = (this.time + dt * this.speed) % 24;
    const h = this.time;
    const ang = (h - 6) / 24 * Math.PI * 2; // sunrise at 6
    const elev = Math.sin(ang), az = Math.cos(ang);
    this.sunDir.set(az * 0.8, elev, -0.45).normalize();
    const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.2);
    this.night = 1 - THREE.MathUtils.smoothstep(elev, -0.25, 0.05);
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir); this.envSky.material.uniforms.sunPosition.value.copy(this.sunDir);
    const ru = 0.6 + day * 1.2 + this.rainAmt * 2; u.rayleigh.value = ru; this.envSky.material.uniforms.rayleigh.value = ru;
    u.turbidity.value = 6 + this.rainAmt * 12;
    // sun or moon drives the key light
    const lightDir = elev > -0.05 ? this.sunDir : this.sunDir.clone().negate().setY(Math.abs(this.sunDir.y) + 0.35).normalize();
    const warm = THREE.MathUtils.smoothstep(elev, 0.0, 0.35);
    this.sun.color.setRGB(1, 0.62 + warm * 0.33, 0.4 + warm * 0.5);
    if (elev <= -0.05) this.sun.color.setRGB(0.55, 0.65, 1);
    this.sun.intensity = (elev > -0.05 ? 3.2 * THREE.MathUtils.smoothstep(elev, -0.05, 0.15) : 0.35) * (1 - this.rainAmt * 0.6);
    this.sun.position.copy(focus).addScaledVector(lightDir, 400);
    this.sun.target.position.copy(focus);
    this.hemi.intensity = 0.25 + day * 0.75;
    this.hemi.color.setRGB(0.55 + day * 0.2, 0.62 + day * 0.2, 0.9);
    const fogDay = new THREE.Color(0xa9b9cc), fogDusk = new THREE.Color(0xd49a78), fogNight = new THREE.Color(0x0b1220), fogRain = new THREE.Color(0x6b7480);
    const dusk = Math.max(0, 1 - Math.abs(elev) * 5) * (1 - this.night);
    const fc = fogNight.clone().lerp(fogDay, day).lerp(fogDusk, dusk * 0.7).lerp(fogRain, this.rainAmt * 0.6 * day);
    this.scene.fog.color.copy(fc); this.scene.fog.density = 0.0009 + this.rainAmt * 0.0016 + this.night * 0.0002;
    this.stars.material.opacity = this.night * (1 - this.rainAmt);
    this.stars.position.copy(focus);
    this.moon.position.copy(focus).addScaledVector(this.sunDir.clone().negate().setY(Math.abs(this.sunDir.y) * 0.8 + 0.3).normalize(), 3500);
    this.moon.visible = this.night > 0.3;
    // weather
    this.weatherTimer -= dt;
    if (this.weatherTimer < 0) { this.weatherTimer = 90 + Math.random() * 120; this.weather = Math.random() < 0.3 ? 'rain' : 'clear'; }
    this.rainAmt = THREE.MathUtils.damp(this.rainAmt, this.weather === 'rain' ? 1 : 0, 0.3, dt);
    this.rain.material.opacity = this.rainAmt * 0.45; this.rain.visible = this.rainAmt > 0.02;
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position, a = p.array;
      for (let i = 0; i < a.length; i += 6) {
        a[i + 1] -= 60 * dt; a[i + 4] -= 60 * dt;
        if (a[i + 1] < -10) { a[i + 1] += 80; a[i + 4] += 80; }
      }
      p.needsUpdate = true; this.rain.position.set(focus.x, focus.y - 30, focus.z);
    }
    this.envTimer -= dt;
    if (this.envTimer < 0 || forceEnv) {
      this.envTimer = 4;
      const old = this.envRT; this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
      this.scene.environment = this.envRT.texture; this.scene.environmentIntensity = 0.25 + day * 0.85;
      old?.dispose();
    }
  }
}
