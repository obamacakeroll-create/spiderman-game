import * as THREE from 'three';
import './world/atmosphere.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { CameraRig } from './core/cameraRig.js';
import { Particles } from './core/particles.js';
import { createPost } from './core/post.js';
import { Settings, ACTIONS, renderSettings } from './core/settings.js';
import { CollisionWorld } from './world/collision.js';
import { buildCity, LANDMARKS } from './world/city.js';
import { SkySystem } from './world/sky.js';
import { Traffic } from './world/traffic.js';
import { Crowd } from './world/crowd.js';
import { Rivers } from './world/water.js';
import { Hero } from './actors/hero.js';
import { CompanionAI } from './actors/companion.js';
import { Combat } from './gameplay/combat.js';
import { Missions } from './gameplay/missions.js';
import { Activities } from './gameplay/activities.js';
import { Progression } from './gameplay/progression.js';
import { HUD, CONTROLS_HTML } from './ui/hud.js';

const $ = id => document.getElementById(id);
const G = window.G = {};
G.settings = new Settings();
const S = G.settings.s;

// ---------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 4500);
Object.assign(G, { renderer, scene, camera });

G.time = {
  now: 0, scale: 1, hs: 0, sm: 0, smScale: 1,
  hitstop(t) { this.hs = Math.max(this.hs, t); },
  slowmo(t, s) { this.sm = Math.max(this.sm, t); this.smScale = s; },
  step(raw) { if (this.hs > 0) { this.hs -= raw; this.scale = 0.04; } else if (this.sm > 0) { this.sm -= raw; this.scale = this.smScale; } else this.scale = THREE.MathUtils.damp(this.scale, 1, 8, raw); const dt = raw * this.scale; this.now += dt; return dt; },
};
G.diff = 1;

G.col = new CollisionWorld();
G.input = new Input(renderer.domElement);
G.audio = new Audio();
G.fx = new Particles(scene);

const loadMsg = (t, pct) => { $('load-text').textContent = t; $('load-fill').style.width = pct + '%'; };
const yieldFrame = () => new Promise(r => setTimeout(r, 16));

async function init() {
  loadMsg('Raising Manhattan…', 5); await yieldFrame();
  G.city = buildCity(scene, G.col);
  loadMsg('Painting the sky…', 30); await yieldFrame();
  G.sky = new SkySystem(scene, renderer);
  G.sky.onThunder = () => { G.audio.thunder(); G.flash(0.25); };
  G.rivers = new Rivers(scene, G.city);
  loadMsg('Starting traffic…', 40); await yieldFrame();
  G.traffic = new Traffic(scene);
  loadMsg('Sculpting New Yorkers…', 50); await yieldFrame();
  G.crowd = new Crowd(scene, G.city.blocks);
  G.camRig = new CameraRig(camera, G.col);
  G.cam = G.camRig;
  G.progress = new Progression(G);
  G.hud = new HUD(G);
  G.combat = new Combat(G);
  loadMsg('Suiting up the Juma brothers…', 65); await yieldFrame();
  G.heroes = [];
  for (const id of ['ali', 'majed', 'venom']) { G.heroes.push(new Hero(G, id)); await yieldFrame(); }
  G.ali = G.heroes[0]; G.majed = G.heroes[1]; G.venom = G.heroes[2];
  G.companions = { ali: new CompanionAI(G, G.ali), majed: new CompanionAI(G, G.majed) };
  loadMsg('Recruiting the Warden\'s army…', 85); await yieldFrame();
  // warm up enemy body geometry caches so first fights don't hitch
  for (const t of ['thug', 'brute', 'carapace']) { const e = G.combat.spawn(t, new THREE.Vector3(0, -100, 0)); e.dispose(); }
  G.combat.enemies.length = 0;
  G.missions = new Missions(G);
  G.activities = new Activities(G);
  G.camFwd = new THREE.Vector3(0, 0, -1);
  G.player = G.ali;
  const start = G.missions.roofNear(LANDMARKS.timesSquare.clone().add(new THREE.Vector3(0, 0, 120)), 30, 90);
  G.ali.teleport(start.clone().setY(start.y + 0.5));
  G.majed.teleport(start.clone().add(new THREE.Vector3(60, 20, 40)));
  G.venom.setVisible(false);
  G.camRig.target.copy(G.ali.pos);
  loadMsg('Compiling shaders…', 95); await yieldFrame();
  applySettings('*');
  G.venom.setVisible(true); G.venom.pos.copy(G.ali.pos); G.venom.animate(0.016, NULL_INPUT);
  try { renderer.compile(scene, camera); } catch (e) { }
  G.venom.setVisible(false);
}

// ---------- settings application
let postKey = '';
function applySettings(k) {
  const all = k === '*' || k === 'preset';
  if (all || k === 'renderScale') { renderer.setPixelRatio(Math.max(0.35, Math.min(devicePixelRatio, 2) * S.renderScale)); renderer.setSize(innerWidth, innerHeight); }
  if (all || k === 'shadows') {
    const was = renderer.shadowMap.enabled; renderer.shadowMap.enabled = S.shadows !== 'off';
    const sz = { low: 1024, medium: 2048, high: 4096 }[S.shadows] || 1024;
    const sh = G.sky.sun.shadow; if (sh.mapSize.x !== sz) { sh.mapSize.set(sz, sz); sh.map?.dispose(); sh.map = null; }
    const c = sh.camera; const ext = S.shadows === 'high' ? 160 : 120; c.left = c.bottom = -ext; c.right = c.top = ext; c.updateProjectionMatrix();
    if (was !== renderer.shadowMap.enabled) scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
  }
  const pk = `${S.ao}-${S.aa}`;
  if (pk !== postKey || !G.post) { G.post?.dispose(); G.post = createPost(renderer, scene, camera, { ao: S.ao, aa: S.aa, bloom: S.bloom, bloomStrength: S.bloomStrength, aoQuality: S.preset === 'ultra' ? 'High' : 'Medium' }); postKey = pk; G.post.resize(innerWidth, innerHeight); }
  G.post.bloom.enabled = S.bloom; G.post.bloom.strength = S.bloomStrength;
  G.post.u.grain.value = S.filmGrain ? 1 : 0;
  G.sky.cloudsOn = S.clouds;
  G.rivers.set(S.water);
  G.city.lampPools.visible = S.lampPools;
  G.sky.fogMul = S.viewDistance; camera.far = 1600 + 2600 * S.viewDistance; camera.updateProjectionMatrix();
  G.crowd.density = S.crowd; G.traffic.setDensity(S.traffic);
  renderer.toneMappingExposure = 0.92 * S.exposure;
  $('fps').style.display = S.fpsCounter ? 'block' : 'none';
  G.camRig.baseFov = S.fov; G.camRig.shakeMul = S.shake; G.camRig.auto = S.autoCamera;
  G.diff = { easy: 0.55, normal: 1, hard: 1.6 }[S.difficulty];
  G.hud.subsOn = S.subtitles; G.hud.markerMode = S.markers;
  document.documentElement.style.setProperty('--hud-scale', S.hudScale);
  G.sky.speed = S.dayLength ? 24 / (S.dayLength * 60) : 0;
  G.audio.setVolumes({ master: S.master, music: S.music, sfx: S.sfx, voice: S.voice });
  G.input.setBinds(S.binds, ACTIONS);
}
G.settings.onChange(k => applySettings(k));

G.say = (spk, text, dur = 3) => G.hud.say(spk, text, dur);
G.flash = (a = 0.3) => { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); };
G.onHeroDown = (h) => {
  h.dead = true; G.hud.notify(`${h.def.name} is down!`, true); G.time.slowmo(1.2, 0.2);
  setTimeout(() => {
    h.dead = false; h.hp = h.maxHp; h.invuln = 2; h.focus = 0;
    G.combat.clear('crime'); G.activities.crime = null; G.activities.crimeTimer = 20;
    if (G.missions.current) {
      const cp = G.missions.checkpointPos || h.pos; const r = G.missions.roofNear(cp, 10, 120);
      h.teleport(r.setY(r.y + 1)); G.missions.restartStep();
    } else { const r = G.missions.roofNear(h.pos, 10, 120); h.teleport(r.setY(r.y + 1)); }
    G.flash(0.6);
  }, 1600);
};

// ---------- hero switching with a cinematic fly-over
G.switchTo = (id, instant = false) => {
  const from = G.player; if (from.id === id || G.switching) return;
  const to = G.heroes.find(h => h.id === id);
  if (id === 'venom') { to.teleport(G.majed.pos.clone().setY(G.majed.pos.y + 1)); G.majed.setVisible(false); to.setVisible(true); G.fx.goo(to.center, 40); }
  if (from.id === 'venom' && id !== 'venom') { G.majed.teleport(from.pos.clone().setY(from.pos.y + 1)); G.majed.setVisible(true); from.setVisible(false); if (id === 'ali' && !G.ali.rig.root.visible) G.ali.setVisible(true); }
  if (id === 'majed' && from.id !== 'venom' && !G.majed.rig.root.visible) G.majed.setVisible(true);
  if (to.pos.distanceTo(from.pos) > 420) { const r = G.missions.roofNear(from.pos.clone().add(new THREE.Vector3(150, 0, -150)), 20, 120); to.teleport(r.setY(r.y + 1)); to.setVisible(true); }
  const finish = () => {
    G.player = to; to.ai = false; if (from.id !== 'venom') from.ai = true;
    G.hud.setHero(to); G.switching = false; G.camRig.yaw = Math.atan2(-Math.sin(to.yaw), -Math.cos(to.yaw)) + Math.PI;
    if (!instant) G.say(to.id, to.def.lines.switchIn[(Math.random() * to.def.lines.switchIn.length) | 0], 2);
    G.progress.s.hero = to.id;
  };
  if (instant) { finish(); return; }
  G.switching = true; G.audio.whoosh(1.2);
  const p0 = camera.position.clone(); let t = 0; const D = 1.7;
  document.body.classList.add('cine');
  G.camRig.cine = { update: (dt) => {
    t += dt; const k = Math.min(1, t / D); const e = k * k * (3 - 2 * k);
    const end = to.center.clone().add(new THREE.Vector3(Math.sin(G.camRig.yaw) * 7, 2.5, Math.cos(G.camRig.yaw) * 7));
    const mid = p0.clone().lerp(end, 0.5); mid.y = Math.max(p0.y, end.y) + 60 + p0.distanceTo(end) * 0.15;
    const a = p0.clone().lerp(mid, e), b = mid.clone().lerp(end, e); const pos = a.lerp(b, e);
    const look = from.center.clone().lerp(to.center, THREE.MathUtils.smoothstep(k, 0.15, 0.7));
    if (k >= 1) { document.body.classList.remove('cine'); finish(); return null; }
    return { pos, look, fov: 70 - Math.sin(k * Math.PI) * 10 };
  } };
  G.time.slowmo(D, 0.35);
};

// ---------- photo mode
const photo = { on: false, yaw: 0, pitch: -0.1, dist: 5, filter: 0, height: 0 };
const FILTERS = ['Natural', 'Noir', 'Golden Film', 'Cold Steel', 'Comic'];
function togglePhoto() {
  photo.on = !photo.on;
  document.body.classList.toggle('photo', photo.on);
  if (photo.on) {
    photo.yaw = G.camRig.yaw; photo.pitch = G.camRig.pitch; photo.dist = 4.5; photo.height = 0;
    G.camRig.cine = { update: () => {
      const c = G.player.center.clone().add(new THREE.Vector3(0, photo.height, 0));
      const off = new THREE.Vector3(Math.sin(photo.yaw) * Math.cos(photo.pitch), -Math.sin(photo.pitch), Math.cos(photo.yaw) * Math.cos(photo.pitch));
      return { pos: c.clone().addScaledVector(off, photo.dist), look: c, fov: photo.fov || 50 };
    } };
    photoHint();
  } else { G.camRig.cine = null; G.post.u.filterMode.value = 0; }
}
function photoHint() { $('photo-hint').innerHTML = `PHOTO MODE · Mouse orbit · Wheel zoom · W/S height · F filter: <b>${FILTERS[photo.filter]}</b> · H hide this · P exit`; }
addEventListener('wheel', e => { if (photo.on) photo.dist = THREE.MathUtils.clamp(photo.dist + e.deltaY * 0.004, 1.2, 30); });

// ---------- title / pause flow
let state = 'loading';
function beginPlay() {
  $('title').classList.add('hidden'); $('pause').classList.add('hidden'); G.hud.show(true); state = 'play'; G.audio.init(); G.audio.setVolumes({}); G.input.lock();
  G.hud.setHero(G.player); G.activities.refreshMarkers();
  if (S.hints && !G.progress.s.hintsShown) { G.progress.s.hintsShown = true; G.hud.runHints(); }
}
function newGame(free) {
  G.progress.reset();
  if (free) { Object.assign(G.progress.s, { freeRoam: true, level: 10, sp: 10, venomUnlocked: true, mission: G.missions.list.length }); G.progress.save(); }
  beginPlay();
  if (free) { G.missions.start(G.missions.list.length); G.hud.notify('FREE ROAM — everything unlocked. V for Venom, TAB to switch.', true); }
  else G.missions.start(0);
}
$('btn-new').onclick = () => newGame(false);
$('btn-free').onclick = () => newGame(true);
$('btn-continue').onclick = () => {
  G.progress.load(); const s = G.progress.s;
  for (const h of G.heroes) h.setSuit(s.suits[h.id] || h.def.suit);
  beginPlay(); G.missions.start(s.mission, s.step || 0);
};
$('btn-settings').onclick = () => { $('pause').classList.remove('hidden'); $('pause').classList.add('from-title'); G.hud.openPause('settings'); };
$('btn-controls').onclick = () => { $('pause').classList.remove('hidden'); $('pause').classList.add('from-title'); G.hud.openPause('controls'); };
$('btn-resume').onclick = () => resume();
$('btn-weather').onclick = () => { G.sky.weather = G.sky.weather === 'rain' ? 'clear' : 'rain'; G.sky.weatherTimer = 200; };
$('btn-time').onclick = () => { G.sky.time = (G.sky.time + 3) % 24; };
G.renderSettings = (el, tab) => renderSettings(el, G.settings, tab);
G.resume = () => resume();
function pause() { if (state !== 'play') return; state = 'pause'; G.hud.openPause('map'); }
function resume() {
  if (state === 'title') { $('pause').classList.add('hidden'); $('pause').classList.remove('from-title'); return; }
  G.hud.closePause(); state = 'play'; G.input.lock();
}
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state === 'play' && !photo.on) pause(); });
renderer.domElement.addEventListener('click', () => { if (state === 'play') G.input.lock(); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); G.post?.resize(innerWidth, innerHeight); });

// ---------- main loop
const clock = new THREE.Clock();
let titleT = 0, fpsT = 0, frames = 0, steamT = 0;
let noRender = false;
G.__tick = (n = 1, dt = 1 / 30) => { noRender = true; for (let i = 0; i < n; i++) step(dt, dt); noRender = false; };
function frame() {
  requestAnimationFrame(frame);
  const real = Math.min(clock.getDelta(), 0.25), raw = Math.min(real, 0.05);
  step(real, raw);
}
function render() { if (!noRender) G.post.composer.render(); }
function step(real, raw) {
  const inp = G.input; inp.pollPad();
  frames++; fpsT += real; if (fpsT > 0.5) { window.__fps = frames / fpsT; $('fps').textContent = Math.round(window.__fps) + ' FPS'; frames = 0; fpsT = 0; }
  if (state === 'title' || state === 'loading') {
    titleT += raw * 0.03;
    if (state === 'loading' || !G.titleInit) { G.titleInit = true; G.sky.time = 18.1; }
    const c = LANDMARKS.empire; camera.position.set(c.x + Math.cos(titleT) * 420, 250 + Math.sin(titleT * 2) * 30, c.z + Math.sin(titleT) * 420); camera.lookAt(c.x - Math.cos(titleT) * 60, 170, c.z - Math.sin(titleT) * 60);
    camera.fov = 55; camera.updateProjectionMatrix();
    G.sky.camPos = camera.position; G.sky.update(0, camera.position); G.city.update(performance.now() / 1000, G.sky.night, G.sky.rainAmt);
    G.rivers.update(raw, G.sky.sunDir, G.sky.sun.color);
    G.traffic.update(raw, camera.position, null, G.city.signalPhase); G.post.u.letterbox.value = 0; render(); inp.endFrame(); return;
  }
  if (state === 'pause') { if (inp.hit('Escape')) resume(); inp.endFrame(); return; }
  if (inp.hit('KeyP') && !G.switching && !G.cinematic) togglePhoto();
  if (photo.on) {
    photo.yaw -= inp.mouseDX * 0.003 * S.sensitivity; photo.pitch = THREE.MathUtils.clamp(photo.pitch - inp.mouseDY * 0.003 * S.sensitivity, -1.4, 1.4);
    if (inp.down('KeyW')) photo.height += real * 1.5; if (inp.down('KeyS')) photo.height -= real * 1.5;
    if (inp.hit('KeyF')) { photo.filter = (photo.filter + 1) % FILTERS.length; G.post.u.filterMode.value = photo.filter; photoHint(); }
    if (inp.hit('KeyH')) $('photo-hint').classList.toggle('hidden');
    if (inp.hit('Escape')) togglePhoto();
    G.camRig.update(0, G.player, real); G.sky.camPos = camera.position; G.sky.update(0, G.player.pos); render(); inp.endFrame(); return;
  }
  const dt = G.time.step(raw);
  if (inp.hit('Escape')) { G.input.unlock(); pause(); }
  G.camRig.input(inp.mouseDX * S.sensitivity, inp.mouseDY * S.sensitivity * (S.invertY ? -1 : 1)); if (inp.mouseDX || inp.mouseDY) G.camRig.idle = 0;
  G.camFwd.set(-Math.sin(G.camRig.yaw), 0, -Math.cos(G.camRig.yaw));
  const P = G.player;
  if (!G.switching && !G.cinematic) {
    const inMissionLock = G.missions.current && G.missions.current.id === 'm7';
    if (inp.hit('Tab') && !inMissionLock) G.switchTo(P.id === 'ali' ? 'majed' : 'ali');
    if (inp.hit('KeyV') && (G.progress.s.venomUnlocked || G.missions.current?.id === 'm7')) G.switchTo(P.id === 'venom' ? 'majed' : 'venom');
  }
  const pin = G.cinematic || G.switching ? NULL_INPUT : inp;
  P.update(dt, pin, G.camRig.yaw);
  for (const h of [G.ali, G.majed]) if (h !== P && !(h === G.majed && P === G.venom)) { const yaw = G.companions[h.id].update(dt); if (h.rig.root.visible) h.update(dt, h.vin, yaw); }
  G.combat.update(dt, G.heroes.filter(h => h.rig.root.visible), P, pin);
  G.missions.update(dt); G.activities.update(dt);
  const danger = G.combat.enemies.filter(e => e.alive && e.state !== 'idle').slice(0, 6).map(e => e.pos);
  G.traffic.update(dt, P.pos, danger[0], G.city.signalPhase, G.audio);
  const cheer = G.crowd.update(dt, P.pos, danger, P.state === 'ground' && P.speed < 3);
  if (cheer > 3 && Math.random() < dt * 0.15) G.say('civ', ['It\'s Spider-Man!', 'Can I get a selfie?!', 'Juma brothers rule!', 'Thanks for saving my block!'][(Math.random() * 4) | 0], 2);
  G.sky.camPos = camera.position; G.sky.update(dt, P.pos); G.city.update(G.time.now, G.sky.night, G.sky.rainAmt);
  G.rivers.update(dt, G.sky.sunDir, G.sky.sun.color);
  G.camRig.update(dt, P, real);
  // ambient effects: steam vents, speed streaks, overclock sparks, footsteps
  steamT -= dt;
  if (steamT <= 0) { steamT = 0.06; for (const v of G.city.steamVents) if (v.distanceTo(P.pos) < 140) G.fx.emit(v.clone().add(new THREE.Vector3((Math.random() - .5) * 0.4, 0, (Math.random() - .5) * 0.4)), new THREE.Vector3((Math.random() - .5) * 0.6, 2.2 + Math.random(), (Math.random() - .5) * 0.6), 0x5a5c60, 2.4, 1.2 + Math.random() * 0.8, -0.3); }
  if (S.motionFx && P.speed > 28) for (let i = 0; i < 3; i++) G.fx.emit(P.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 14, (Math.random() - .5) * 8 + 2, (Math.random() - .5) * 14)).addScaledVector(P.vel, 0.25), new THREE.Vector3(), 0x9fb8d8, 0.3, 0.08, 0);
  if (P.buffs.overclock && Math.random() < 0.6) G.fx.emit(P.center, new THREE.Vector3((Math.random() - .5) * 2, 1, (Math.random() - .5) * 2), 0x40e8ff, 0.4, 0.2, 0);
  if (P.state === 'ground' && P.speed > 2) { P.stepT = (P.stepT || 0) - dt * P.speed; if (P.stepT < 0) { P.stepT = 2.2; G.audio.step(P.def.id === 'venom' ? 0.6 : 0.25); } }
  G.fx.update(dt);
  const u = G.post.u; u.time.value += raw; u.speed.value = S.motionFx ? THREE.MathUtils.damp(u.speed.value, Math.max(0, (P.speed - 20) / 40), 4, raw) : 0;
  u.letterbox.value = 0; u.slowmo.value = THREE.MathUtils.damp(u.slowmo.value, G.time.scale < 0.6 ? 1 : 0, 10, raw);
  G.audio.setWind(P.speed);
  G.hud.update(raw, P);
  render();
  inp.endFrame();
}
const NULL_INPUT = { down: () => false, hit: () => false, up: () => false, moveAxis: () => ({ x: 0, y: 0 }) };

init().then(() => {
  $('loading').classList.add('hidden');
  state = 'title';
  if (!G.progress.hasSave()) $('btn-continue').style.display = 'none';
  frame();
}).catch(e => { console.error(e); loadMsg('Error: ' + e.message, 100); });
