import * as THREE from 'three';

// Pooled additive particle system for sparks, dust, electricity, symbiote goo, speed streaks.
export class Particles {
  constructor(scene, max = 3000) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.size = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.alpha = new Float32Array(max); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize = size * 300.0 / -mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; gl_FragColor=vec4(vC*vA*(1.0-d*2.0)*2.0, 1.0); }`,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; scene.add(this.points);
    this.geo = g; this.c = new THREE.Color();
  }
  emit(p, v, color, life, size, grav = 0) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.c.set(color); this.col.set([this.c.r, this.c.g, this.c.b], i * 3);
    this.life[i] = this.maxLife[i] = life; this.size[i] = size; this.grav[i] = grav;
  }
  burst(p, n, color, speed = 8, life = 0.5, size = 0.15, grav = 10) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.randomDirection().multiplyScalar(speed * (0.3 + Math.random())); this.emit(p, v, color, life * (0.5 + Math.random()), size * (0.5 + Math.random()), grav); }
  }
  sparks(p, color = 0xffd080) { this.burst(p, 22, color, 12, 0.35, 0.1, 18); this.burst(p, 4, 0xffffff, 3, 0.12, 0.6, 0); }
  dust(p, n = 12) { const q = p.clone(); q.y += 0.3; this.burst(q, n, 0x8a8070, 6, 0.8, 0.5, -1); }
  splash(p) { this.burst(p.clone().setY(0), 40, 0x9ac0e0, 12, 0.9, 0.3, 20); }
  electric(a, b, color = 0x40e8ff) { const v = new THREE.Vector3(); const zero = new THREE.Vector3(); for (let i = 0; i <= 16; i++) { v.lerpVectors(a, b, i / 16); v.x += (Math.random() - .5) * 0.7; v.y += (Math.random() - .5) * 0.7; v.z += (Math.random() - .5) * 0.7; this.emit(v, zero, color, 0.18, 0.3, 0); } }
  goo(p, n = 16) { this.burst(p, n, 0x3a2a70, 7, 0.6, 0.25, 14); }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
    }
    // compact occasionally
    while (this.n > 0 && this.life[this.n - 1] <= 0) this.n--;
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
}
