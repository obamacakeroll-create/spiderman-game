import * as THREE from 'three';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { CameraRig } from './core/cameraRig.js';
import { Particles } from './core/particles.js';
import { createPost } from './core/post.js';
import { CollisionWorld } from './world/collision.js';
import { buildCity, LANDMARKS } from './world/city.js';
import { SkySystem } from './world/sky.js';
import { Traffic } from './world/traffic.js';
import { Crowd } from './world/crowd.js';
import { Hero } from './actors/hero.js';
import { CompanionAI } from './actors/companion.js';
import { Combat } from './gameplay/combat.js';
import { Missions } from './gameplay/missions.js';
import { Activities } from './gameplay/activities.js';
import { Progression } from './gameplay/progression.js';
import { HUD, CONTROLS_HTML } from './ui/hud.js';

const $ = id => document.getElementById(id);
const G = window.G = {};

// ---------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 6000);
Object.assign(G, { renderer, scene, camera });

G.time = {
  now: 0, scale: 1, hs: 0, sm: 0, smScale: 1,
  hitstop(t) { this.hs = Math.max(this.hs, t); },
  slowmo(t, s) { this.sm = Math.max(this.sm, t); this.smScale = s; },
  step(raw) { if (this.hs > 0) { this.hs -= raw; this.scale = 0.04; } else if (this.sm > 0) { this.sm -= raw; this.scale = this.smScale; } else this.scale = THREE.MathUtils.damp(this.scale, 1, 8, raw); const dt = raw * this.scale; this.now += dt; return dt; },
};

G.col = new CollisionWorld();
G.input = new Input(renderer.domElement);
G.audio = new Audio();
G.fx = new Particles(scene);

function init() {
  G.city = buildCity(scene, G.col);
  G.sky = new SkySystem(scene, renderer);
  G.traffic = new Traffic(scene);
  G.crowd = new Crowd(scene, G.city.blocks);
  G.camRig = new CameraRig(camera, G.col);
  G.cam = G.camRig;
  G.post = createPost(renderer, scene, camera);
  G.progress = new Progression(G);
  G.hud = new HUD(G);
  G.combat = new Combat(G);
  G.heroes = ['ali', 'majed', 'venom'].map(id => new Hero(G, id));
  G.ali = G.heroes[0]; G.majed = G.heroes[1]; G.venom = G.heroes[2];
  G.companions = { ali: new CompanionAI(G, G.ali), majed: new CompanionAI(G, G.majed) };
  G.missions = new Missions(G);
  G.activities = new Activities(G);
  G.camFwd = new THREE.Vector3(0, 0, -1);
  G.player = G.ali;
  const start = G.missions.roofNear(LANDMARKS.timesSquare.clone().add(new THREE.Vector3(0, 0, 120)), 30, 90);
  G.ali.teleport(start.clone().setY(start.y + 0.5));
  G.majed.teleport(start.clone().add(new THREE.Vector3(60, 20, 40)));
  G.venom.setVisible(false);
  G.camRig.target.copy(G.ali.pos);
}

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
  let to = G.heroes.find(h => h.id === id);
  if (id === 'venom') { to.teleport(G.majed.pos.clone().setY(G.majed.pos.y + 1)); G.majed.setVisible(false); to.setVisible(true); }
  if (from.id === 'venom' && id !== 'venom') { G.majed.teleport(from.pos.clone().setY(from.pos.y + 1)); G.majed.setVisible(true); from.setVisible(false); if (id === 'ali' && !G.ali.rig.root.visible) { G.ali.setVisible(true); } }
  if (id === 'majed' && from.id !== 'venom' && !G.majed.rig.root.visible) G.majed.setVisible(true);
  // keep the other brother in plausible range so the fly-over reads as the same city
  if (to.pos.distanceTo(from.pos) > 420) { const r = G.missions.roofNear(from.pos.clone().add(new THREE.Vector3(150, 0, -150)), 20, 120); to.teleport(r.setY(r.y + 1)); to.setVisible(true); }
  const finish = () => {
    G.player = to; to.ai = false; if (from.id !== 'venom') from.ai = true;
    G.hud.setHero(to); G.switching = false; G.camRig.yaw = Math.atan2(-Math.sin(to.yaw), -Math.cos(to.yaw)) + Math.PI;
    if (!instant) G.say(to.id, to.def.lines.switchIn[(Math.random() * to.def.lines.switchIn.length) | 0], 2);
    G.progress.s.hero = to.id;
  };
  if (instant) { if (from.id !== 'venom' && id === 'venom') {} finish(); return; }
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

// ---------- title / pause flow
let state = 'loading';
function beginPlay() {
  $('title').classList.add('hidden'); G.hud.show(true); state = 'play'; G.audio.init(); G.input.lock();
  G.hud.setHero(G.player); G.activities.refreshMarkers();
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
$('btn-controls').onclick = () => { $('pause').classList.remove('hidden'); $('tab-body').innerHTML = CONTROLS_HTML; };
$('btn-resume').onclick = () => resume();
$('btn-weather').onclick = () => { G.sky.weather = G.sky.weather === 'rain' ? 'clear' : 'rain'; G.sky.weatherTimer = 200; };
$('btn-time').onclick = () => { G.sky.time = (G.sky.time + 3) % 24; };
function pause() { if (state !== 'play') return; state = 'pause'; G.hud.openPause('map'); }
function resume() { if (state === 'title') { $('pause').classList.add('hidden'); return; } G.hud.closePause(); state = 'play'; G.input.lock(); }
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state === 'play') pause(); });
renderer.domElement.addEventListener('click', () => { if (state === 'play') G.input.lock(); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); G.post?.resize(innerWidth, innerHeight); });

// ---------- main loop
const clock = new THREE.Clock();
let titleT = 0, fpsT = 0, frames = 0;
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 0.05);
  const inp = G.input; inp.pollPad();
  if (state === 'title' || state === 'loading') {
    titleT += raw * 0.04;
    const c = LANDMARKS.empire; camera.position.set(c.x + Math.cos(titleT) * 260, 150 + Math.sin(titleT * 2) * 20, c.z + Math.sin(titleT) * 260); camera.lookAt(c.x, 120, c.z);
    camera.fov = 55; camera.updateProjectionMatrix();
    G.sky.update(raw, camera.position); G.city.update(performance.now() / 1000, G.sky.night);
    G.traffic.update(raw, camera.position); G.post.u.letterbox.value = 0; G.post.composer.render(); inp.endFrame(); return;
  }
  if (state === 'pause') { if (inp.hit('Escape')) resume(); inp.endFrame(); return; }
  const dt = G.time.step(raw);
  if (inp.hit('Escape')) { G.input.unlock(); pause(); }
  G.camRig.input(inp.mouseDX, inp.mouseDY); if (inp.mouseDX || inp.mouseDY) G.camRig.idle = 0;
  G.camFwd.set(-Math.sin(G.camRig.yaw), 0, -Math.cos(G.camRig.yaw));
  const P = G.player;
  if (!G.switching && !G.cinematic) {
    const inMissionLock = G.missions.current && G.missions.step?.type === 'boss' && G.missions.current.id === 'm7';
    if (inp.hit('Tab') && !inMissionLock) G.switchTo(P.id === 'ali' ? 'majed' : 'ali');
    if (inp.hit('KeyV') && (G.progress.s.venomUnlocked || G.missions.current?.id === 'm7')) G.switchTo(P.id === 'venom' ? 'majed' : 'venom');
  }
  const pin = G.cinematic || G.switching ? NULL_INPUT : inp;
  P.update(dt, pin, G.camRig.yaw);
  for (const h of [G.ali, G.majed]) if (h !== P && !(h === G.majed && P === G.venom)) { const yaw = G.companions[h.id].update(dt); if (h.rig.root.visible) h.update(dt, h.vin, yaw); }
  G.combat.update(dt, G.heroes.filter(h => h.rig.root.visible), P, pin);
  G.missions.update(dt); G.activities.update(dt);
  const danger = G.combat.enemies.filter(e => e.alive && e.state !== 'idle').slice(0, 6).map(e => e.pos);
  G.traffic.update(dt, P.pos, danger[0]);
  const cheer = G.crowd.update(dt, P.pos, danger, P.state === 'ground' && P.speed < 3);
  if (cheer > 3 && Math.random() < dt * 0.15) G.say('civ', ['It\'s Spider-Man!', 'Can I get a selfie?!', 'Juma brothers rule!', 'Thanks for saving my block!'][(Math.random() * 4) | 0], 2);
  G.sky.update(dt, P.pos); G.city.update(G.time.now, G.sky.night);
  G.camRig.update(dt, P, raw);
  // speed streaks
  if (P.speed > 28) for (let i = 0; i < 3; i++) G.fx.emit(P.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 14, (Math.random() - .5) * 8 + 2, (Math.random() - .5) * 14)).addScaledVector(P.vel, 0.25), new THREE.Vector3(), 0x9fb8d8, 0.3, 0.08, 0);
  if (P.buffs.overclock && Math.random() < 0.6) G.fx.emit(P.center, new THREE.Vector3((Math.random() - .5) * 2, 1, (Math.random() - .5) * 2), 0x40e8ff, 0.4, 0.2, 0);
  G.fx.update(dt);
  const u = G.post.u; u.time.value += raw; u.speed.value = THREE.MathUtils.damp(u.speed.value, Math.max(0, (P.speed - 20) / 40), 4, raw);
  u.letterbox.value = 0; u.slowmo.value = THREE.MathUtils.damp(u.slowmo.value, G.time.scale < 0.6 ? 1 : 0, 10, raw);
  G.audio.setWind(P.speed);
  G.hud.update(raw, P);
  G.post.composer.render();
  inp.endFrame();
  frames++; fpsT += raw; if (fpsT > 1) { window.__fps = frames / fpsT; frames = 0; fpsT = 0; }
}
const NULL_INPUT = { down: () => false, hit: () => false, up: () => false, moveAxis: () => ({ x: 0, y: 0 }) };

setTimeout(() => {
  init();
  $('loading').classList.add('hidden');
  state = 'title';
  if (!G.progress.hasSave()) $('btn-continue').style.display = 'none';
  frame();
}, 50);
