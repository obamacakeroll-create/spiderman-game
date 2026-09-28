import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const CinemaShader = {
  uniforms: { tDiffuse: { value: null }, speed: { value: 0 }, letterbox: { value: 0 }, time: { value: 0 }, damage: { value: 0 }, slowmo: { value: 0 }, tint: { value: new THREE.Color(0, 0, 0) }, tintAmt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float speed, letterbox, time, damage, slowmo, tintAmt; uniform vec3 tint; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec2 c = vUv - 0.5; float r = length(c);
    // radial speed blur + chromatic aberration at speed
    vec3 col = vec3(0.0); float amt = speed * 0.035 * r;
    for (int i=0;i<6;i++){ float f = float(i)/5.0; vec2 uv = vUv - c * amt * f; col += texture2D(tDiffuse, uv).rgb; }
    col /= 6.0;
    float ca = 0.0015 + speed*0.004*r + damage*0.01;
    col.r = mix(col.r, texture2D(tDiffuse, vUv - c*ca).r, 0.8);
    col.b = mix(col.b, texture2D(tDiffuse, vUv + c*ca).b, 0.8);
    // grade
    float l = dot(col, vec3(0.299,0.587,0.114));
    col = mix(vec3(l), col, 1.08 - slowmo*0.55);
    col = mix(col, col*vec3(0.75,0.9,1.25), slowmo*0.5);
    col = mix(col, tint, tintAmt);
    col *= 1.0 - smoothstep(0.45, 0.95, r) * (0.55 + damage*0.4);
    col = mix(col, col*vec3(1.4,0.3,0.3), damage * smoothstep(0.25,0.8,r));
    col += (h(vUv*time) - 0.5) * 0.025;
    float lb = letterbox * 0.12;
    if (vUv.y < lb || vUv.y > 1.0 - lb) col = vec3(0.0);
    gl_FragColor = vec4(col, 1.0);
  }`,
};

export function createPost(renderer, scene, camera) {
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const size = renderer.getSize(new THREE.Vector2());
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.6, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const cinema = new ShaderPass(CinemaShader); composer.addPass(cinema);
  return { composer, bloom, cinema, u: cinema.uniforms, resize(w, h) { composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); } };
}
