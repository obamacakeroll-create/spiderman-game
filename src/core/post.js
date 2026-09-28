import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';

const CinemaShader = {
  uniforms: { tDiffuse: { value: null }, grain: { value: 1 }, filterMode: { value: 0 }, speed: { value: 0 }, letterbox: { value: 0 }, time: { value: 0 }, damage: { value: 0 }, slowmo: { value: 0 }, tint: { value: new THREE.Color(0, 0, 0) }, tintAmt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float speed, letterbox, time, damage, slowmo, tintAmt, grain, filterMode; uniform vec3 tint; varying vec2 vUv;
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
    // grade: gentle S-curve, teal shadows / warm highlights
    float l = dot(col, vec3(0.299,0.587,0.114));
    col = mix(col, col * vec3(0.92, 1.0, 1.08), (1.0 - smoothstep(0.0, 0.45, l)) * 0.5);
    col = mix(col, col * vec3(1.06, 1.0, 0.93), smoothstep(0.55, 1.0, l) * 0.5);
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
    l = dot(col, vec3(0.299,0.587,0.114));
    col = mix(vec3(l), col, 1.1 - slowmo*0.55);
    col = mix(col, col*vec3(0.75,0.9,1.25), slowmo*0.5);
    col = mix(col, tint, tintAmt);
    if (filterMode > 0.5 && filterMode < 1.5) { float g = dot(col, vec3(0.3,0.59,0.11)); col = vec3(smoothstep(0.03, 0.9, g)); }
    else if (filterMode > 1.5 && filterMode < 2.5) { col = col * vec3(1.12, 0.96, 0.74) + vec3(0.035, 0.02, 0.0); }
    else if (filterMode > 2.5 && filterMode < 3.5) { col = col * vec3(0.78, 0.95, 1.2); }
    else if (filterMode > 3.5) { col = floor(col * 6.0 + 0.5) / 6.0; float e = length(fwidth(col)); col *= 1.0 - smoothstep(0.08, 0.2, e); }
    col *= 1.0 - smoothstep(0.45, 0.95, r) * (0.55 + damage*0.4);
    col = mix(col, col*vec3(1.4,0.3,0.3), damage * smoothstep(0.25,0.8,r));
    col += (h(vUv*time) - 0.5) * 0.03 * grain;
    float lb = letterbox * 0.12;
    if (vUv.y < lb || vUv.y > 1.0 - lb) col = vec3(0.0);
    gl_FragColor = vec4(col, 1.0);
  }`,
};

export function createPost(renderer, scene, camera, opts = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType }));
  let scenePass;
  if (opts.ao) {
    scenePass = new N8AOPass(scene, camera, size.x, size.y);
    scenePass.configuration.aoRadius = 3.0; scenePass.configuration.distanceFalloff = 1.2; scenePass.configuration.intensity = 3.2;
    scenePass.configuration.halfRes = true; scenePass.configuration.gammaCorrection = false;
    scenePass.setQualityMode(opts.aoQuality || 'Medium');
  } else scenePass = new RenderPass(scene, camera);
  composer.addPass(scenePass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), opts.bloomStrength ?? 0.55, 0.6, 0.85);
  bloom.enabled = opts.bloom !== false;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let smaa = null;
  if (opts.aa === 'smaa') { smaa = new SMAAPass(size.x, size.y); composer.addPass(smaa); }
  const cinema = new ShaderPass(CinemaShader); composer.addPass(cinema);
  return { composer, bloom, cinema, scenePass, u: cinema.uniforms, resize(w, h) { const s2 = renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setSize(w, h); bloom.resolution.set(s2.x / 2, s2.y / 2); scenePass.setSize?.(s2.x, s2.y); }, dispose() { composer.dispose(); } };
}
