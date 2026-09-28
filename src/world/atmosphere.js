import * as THREE from 'three';

// Global height fog: dense haze in the street canyons that thins out with altitude.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth; varying vec3 vFogWorld;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
vec4 fogWP = vec4( position, 1.0 );
#ifdef USE_INSTANCING
fogWP = instanceMatrix * fogWP;
#endif
vFogWorld = ( modelMatrix * fogWP ).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogWorld;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fDist = length( vFogWorld - cameraPosition );
float fk = 0.016; float h0 = max( cameraPosition.y, 0.0 ), h1 = max( vFogWorld.y, 0.0 ); float fdh = h1 - h0;
float hf = abs( fdh ) > 0.05 ? ( exp( -fk * h0 ) - exp( -fk * h1 ) ) / ( fk * fdh ) : exp( -fk * h0 );
hf = max( hf * 2.4, 0.22 );
float fogFactor = 1.0 - exp( - fogDensity * fDist * hf );
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor, 0.0, 1.0 ) );
#endif`;

// Procedural cloud dome (fbm), lit by the sun, drifting with the wind.
export class Clouds {
  constructor(scene) {
    this.u = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.9, 0.8) }, uSky: { value: new THREE.Color(0.6, 0.7, 0.8) }, uCover: { value: 0.45 }, uDark: { value: 0 }, uNight: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`,
      fragmentShader: `uniform float uTime, uCover, uDark, uNight; uniform vec3 uSun, uSunCol, uSky; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5, s=0.; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); if (d.y < 0.01) discard;
        vec2 uv = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime*0.006, uTime*0.003);
        float base = fbm(uv);
        float det = fbm(uv*3.1 - uTime*0.01);
        float dens = smoothstep(uCover, uCover + 0.28, base*0.8 + det*0.35);
        // lighting: sample towards the sun for self-shadowing
        vec2 sOff = normalize(uSun.xz + 1e-4) * 0.06;
        float toward = fbm(uv + sOff);
        float shade = clamp(1.0 - (toward - base) * 3.0, 0.25, 1.2);
        float sunAmt = pow(max(dot(d, normalize(uSun)), 0.0), 6.0);
        vec3 lit = mix(uSky * 0.9, uSunCol * 1.25, 0.55) * shade + uSunCol * sunAmt * 0.7;
        lit = mix(lit, vec3(0.35,0.38,0.42) * (0.4 + shade*0.4), uDark);
        lit = mix(lit, vec3(0.05,0.06,0.09) + uSunCol*0.05, uNight);
        float horizon = smoothstep(0.01, 0.2, d.y);
        gl_FragColor = vec4(lit, dens * horizon * 0.92);
      }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    this.mesh.renderOrder = -1; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(dt, cam, sunDir, sunCol, skyCol, rain, night) {
    this.u.uTime.value += dt;
    this.mesh.position.copy(cam);
    this.u.uSun.value.copy(sunDir); this.u.uSunCol.value.copy(sunCol); this.u.uSky.value.copy(skyCol);
    this.u.uCover.value = 0.52 - rain * 0.3; this.u.uDark.value = rain * 0.8; this.u.uNight.value = night;
  }
}
