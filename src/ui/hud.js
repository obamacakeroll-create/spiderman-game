import * as THREE from 'three';
import { AVES, STREETS, ISLAND, PARK, LANDMARKS } from '../world/city.js';
import { SKILL_TREES, HERO_DEFS } from '../actors/heroes.js';
import { SUITS } from '../actors/rig.js';

const $ = id => document.getElementById(id);
export class HUD {
  constructor(G) {
    this.G = G; this.styleT = 0; this.subQueue = []; this.subT = 0; this.markers = new Map();
    this.mm = $('minimap').getContext('2d');
    // pre-render map
    const S = 4; const W = (ISLAND.maxX - ISLAND.minX + 200) / S, H = (ISLAND.maxZ - ISLAND.minZ + 200) / S;
    this.mapC = document.createElement('canvas'); this.mapC.width = W; this.mapC.height = H; this.mapS = S;
    this.mapOx = ISLAND.minX - 100; this.mapOz = ISLAND.minZ - 100;
    const g = this.mapC.getContext('2d');
    g.fillStyle = '#0d2233'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b2f36'; g.fillRect((ISLAND.minX - this.mapOx) / S, (ISLAND.minZ - this.mapOz) / S, (ISLAND.maxX - ISLAND.minX) / S, (ISLAND.maxZ - ISLAND.minZ) / S);
    for (const b of G.city.blocks) { g.fillStyle = b.type === 'park' ? '#27502c' : b.type === 'plaza' ? '#5a4a20' : '#4b525c'; g.fillRect((b.minX - this.mapOx) / S, (b.minZ - this.mapOz) / S, (b.maxX - b.minX) / S, (b.maxZ - b.minZ) / S); }
    for (const b of G.city.buildings) if (b.h > 120) { g.fillStyle = '#687280'; g.fillRect((b.minX - this.mapOx) / S, (b.minZ - this.mapOz) / S, (b.maxX - b.minX) / S, (b.maxZ - b.minZ) / S); }
    g.fillStyle = '#6a6258'; g.fillRect((520 - this.mapOx) / S, (LANDMARKS.bridge.z - 13 - this.mapOz) / S, 520 / S, 26 / S);
    this.hpGhost = 1;
  }
  show(v) { $('hud').classList.toggle('hidden', !v); }
  setHero(h) {
    document.documentElement.style.setProperty('--hero', h.def.color);
    $('hero-name').textContent = h.def.name.toUpperCase(); $('hero-title').textContent = (h.id === 'venom' ? 'THE HUNGER' : SUITS[h.suitId].name).toUpperCase();
    $('abilities').innerHTML = h.def.abilities.map((a, i) => `<div class="ab" id="ab${i}"><b>${a.key}</b>${a.name}<div class="cd"></div></div>`).join('') + (h.id === 'venom' ? '' : '<div class="ab" id="ab-q"><b>Q</b>Web<br>Shot</div>');
    $('switch-hint').textContent = this.G.progress.s.venomUnlocked ? 'TAB · SWITCH BROTHER   V · VENOM' : 'TAB · SWITCH BROTHER';
  }
  notify(text, big = false) {
    const el = document.createElement('div'); el.className = 'note' + (big ? ' big' : ''); el.textContent = text;
    $('notify').appendChild(el); setTimeout(() => el.remove(), big ? 4500 : 3000);
    while ($('notify').children.length > 5) $('notify').firstChild.remove();
  }
  style(text, xp = 0) {
    const el = $('style-pop'); el.textContent = text + (xp ? `  +${xp}` : ''); el.classList.add('show'); this.styleT = 1.1;
    if (xp) this.G.progress.addXP(xp);
  }
  prompt(t) { const el = $('prompt'); if (t) { el.textContent = t; el.classList.add('show'); } else el.classList.remove('show'); }
  damage() { this.G.post.u.damage.value = 1; }
  // Subtitle queue: [speaker, text, dur]
  say(speaker, text, dur = 3) { this.subQueue.push([speaker, text, dur]); }
  clearSubs() { this.subQueue.length = 0; this.subT = 0; $('subtitle').classList.remove('show'); }
  get talking() { return this.subT > 0 || this.subQueue.length > 0; }
  objective(mission, text) { $('obj-mission').textContent = mission || ''; $('obj-text').textContent = text || ''; }
  boss(e) { const b = $('boss'); if (!e || !e.alive) { b.style.display = 'none'; return; } b.style.display = 'block'; $('boss-name').textContent = e.a.boss; $('boss-fill').style.width = (e.hp / e.maxHp * 100) + '%'; }
  setMarker(id, pos, cls, label) { if (!pos) { const m = this.markers.get(id); if (m) { m.el.remove(); this.markers.delete(id); } return; } let m = this.markers.get(id); if (!m) { const el = document.createElement('div'); el.className = 'marker ' + cls; el.innerHTML = `<div class="dia"></div><span></span>`; $('marker-layer').appendChild(el); m = { el }; this.markers.set(id, m); } m.pos = pos; m.cls = cls; m.label = label; }
  clearMarkers(prefix) { for (const [id, m] of this.markers) if (!prefix || id.startsWith(prefix)) { m.el.remove(); this.markers.delete(id); } }
  update(dt, h) {
    const G = this.G;
    $('hp-fill').style.width = (h.hp / h.maxHp * 100) + '%';
    this.hpGhost = Math.max(h.hp / h.maxHp, this.hpGhost - dt * 0.3); $('hp-ghost').style.width = (this.hpGhost * 100) + '%';
    $('focus-fill').style.width = h.focus + '%';
    h.def.abilities.forEach((a, i) => { const el = $('ab' + i); if (!el) return; const cd = h.cooldowns[a.id] || 0; const unl = G.progress.abilityUnlocked(h.id, i); el.classList.toggle('ready', cd <= 0 && unl); el.style.opacity = unl ? 1 : 0.35; el.querySelector('.cd').style.height = (cd / a.cd * 100) + '%'; });
    const s = G.progress.s; $('lvl').textContent = 'LV ' + s.level; $('xp-fill').style.width = (s.xp / G.progress.xpFor(s.level) * 100) + '%'; $('sp-count').textContent = s.sp ? s.sp + ' SP' : '';
    const c = G.combat; const ce = $('combo'); ce.style.opacity = c.combo > 1 ? 1 : 0; $('combo-n').textContent = c.combo;
    this.styleT -= dt; if (this.styleT <= 0) $('style-pop').classList.remove('show');
    $('speedo').textContent = h.speed > 15 ? Math.round(h.speed * 3.6) + ' KM/H' : '';
    // subtitles
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) $('subtitle').classList.remove('show'); }
    if (this.subT <= 0 && this.subQueue.length) {
      const [sp, text, dur] = this.subQueue.shift(); this.subT = dur;
      const names = { ali: ['ALI', '#18e0ff'], majed: ['MAJED', '#ff5a5a'], venom: ['VENOM', '#b08cff'], warden: ['THE WARDEN', '#ffc040'], carapace: ['CARAPACE', '#ff8a30'], mj: ['MAYA (RADIO)', '#ffd34d'], news: ['J-NEWS', '#9fd3ff'], cop: ['CAPT. REYES', '#9ab0ff'], civ: ['CIVILIAN', '#ddd'], symbiote: ['???', '#b08cff'] };
      const n = names[sp] || [sp, '#fff'];
      $('sub-name').textContent = n[0]; $('sub-text').textContent = text; $('subtitle').style.setProperty('--spk', n[1]); $('subtitle').classList.add('show');
      G.audio.voice(sp);
    }
    // markers
    const cam = G.camera; const v = new THREE.Vector3();
    for (const [id, m] of this.markers) {
      v.copy(m.pos); v.y += 3; const d = h.pos.distanceTo(m.pos);
      v.project(cam);
      const behind = v.z > 1;
      let x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
      if (behind) { x = innerWidth - x; y = innerHeight - 40; }
      x = Math.min(Math.max(x, 40), innerWidth - 40); y = Math.min(Math.max(y, 60), innerHeight - 40);
      m.el.style.left = x + 'px'; m.el.style.top = y + 'px';
      m.el.querySelector('span').textContent = `${m.label || ''} ${Math.round(d)}m`;
      m.el.style.opacity = d > 900 && m.cls !== 'mission' ? 0 : 1;
    }
    const pm = G.post.u; pm.damage.value = Math.max(0, pm.damage.value - dt * 1.8);
    this.drawMinimap(h);
  }
  drawMinimap(h) {
    const g = this.mm, W = 220, S = this.mapS, G = this.G;
    g.save(); g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, 7); g.clip();
    g.fillStyle = '#0d2233'; g.fillRect(0, 0, W, W);
    g.translate(W / 2, W / 2); g.rotate(G.camRig.yaw);
    const zoom = 1.0;
    g.scale(zoom, zoom);
    g.drawImage(this.mapC, -(h.pos.x - this.mapOx) / S, -(h.pos.z - this.mapOz) / S);
    const dot = (p, col, r = 4) => { g.fillStyle = col; g.beginPath(); g.arc((p.x - h.pos.x) / S, (p.z - h.pos.z) / S, r, 0, 7); g.fill(); };
    for (const [, m] of this.markers) { const col = { mission: '#ffd34d', crime: '#ff4040', collect: '#6fe3ff', challenge: '#7dff8a', base: '#ff9a3a' }[m.cls] || '#fff'; const dx = (m.pos.x - h.pos.x) / S, dz = (m.pos.z - h.pos.z) / S; const l = Math.hypot(dx, dz), lim = W / 2 - 8; const k = l > lim ? lim / l : 1; g.fillStyle = col; g.beginPath(); g.arc(dx * k, dz * k, m.cls === 'mission' ? 5 : 3.5, 0, 7); g.fill(); }
    for (const e of G.combat.enemies) if (e.alive) dot(e.pos, e.a.boss ? '#ff00aa' : '#ff3030', e.a.boss ? 5 : 2.5);
    for (const o of G.heroes) if (o !== h && o.rig.root.visible) dot(o.pos, o.def.color, 5);
    g.restore();
    // player arrow (map rotated to camera, so arrow uses hero yaw relative to camera)
    g.save(); g.translate(W / 2, W / 2); g.rotate(-(h.yaw - (G.camRig.yaw + Math.PI)) + Math.PI);
    g.fillStyle = h.def.color; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.restore();
  }
  // ---- pause menu
  openPause(tab = 'map') {
    const G = this.G; $('pause').classList.remove('hidden');
    document.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.onclick = () => this.openPause(b.dataset.tab); });
    const body = $('tab-body'); const s = G.progress.s; const h = G.player;
    if (tab === 'skills') {
      const trees = ['ali', 'majed'];
      body.innerHTML = `<div class="hint">Skill points: <b style="color:#ffd34d">${s.sp}</b> — click a node to unlock. Level ${s.level}.</div>` + trees.map(id => `<h2 style="font-family:Bebas Neue;letter-spacing:3px;color:${HERO_DEFS[id].color}">${HERO_DEFS[id].name}</h2><div class="tree">` + SKILL_TREES[id].map(b => `<div class="branch"><h3 style="color:${HERO_DEFS[id].color}">${b.branch}</h3>${b.nodes.map(n => `<div class="node ${s.skills.includes(n.id) ? 'owned' : ''}" data-id="${n.id}"><b>${n.name}</b> <span style="float:right">${s.skills.includes(n.id) ? '✓' : n.cost + ' SP'}</span><small>${n.desc}</small></div>`).join('')}</div>`).join('') + '</div>').join('');
      body.querySelectorAll('.node').forEach(el => el.onclick = () => { if (G.progress.buy(el.dataset.id)) { G.audio.chime(); this.openPause('skills'); } else G.audio.ui(-1); });
    } else if (tab === 'suits') {
      body.innerHTML = ['ali', 'majed'].concat(s.venomUnlocked ? ['venom'] : []).map(hid => `<h2 style="font-family:Bebas Neue;letter-spacing:3px;color:${HERO_DEFS[hid].color}">${HERO_DEFS[hid].name}</h2><div class="suits">` + Object.entries(SUITS).filter(([, su]) => su.hero === hid).map(([id, su]) => { const un = G.progress.suitUnlocked(id); return `<div class="suit ${un ? '' : 'locked'} ${s.suits[hid] === id ? 'eq' : ''}" data-id="${id}" data-h="${hid}"><div class="swatch" style="background:linear-gradient(135deg,${su.base} 0 45%,${su.second} 45% 75%,${su.accent} 75%)"></div><b>${su.name}</b><small style="display:block;opacity:.7">${un ? (s.suits[hid] === id ? 'EQUIPPED' : 'Click to equip') : 'Unlocks at level ' + su.level}</small></div>`; }).join('') + '</div>').join('');
      body.querySelectorAll('.suit').forEach(el => el.onclick = () => { if (!G.progress.suitUnlocked(el.dataset.id)) return; s.suits[el.dataset.h] = el.dataset.id; const hero = G.heroes.find(x => x.id === el.dataset.h); hero?.setSuit(el.dataset.id); G.progress.save(); G.audio.ui(1); this.setHero(G.player); this.openPause('suits'); });
    } else if (tab === 'journal') {
      const m = G.missions;
      body.innerHTML = `<div class="kv"><b>Story</b><span>${m.current ? m.current.title + ' — ' + m.current.desc : (s.mission >= m.list.length ? 'Campaign complete! Venom is playable (press V).' : '—')}</span>
      <b>Missions complete</b><span>${Math.min(s.mission, m.list.length)} / ${m.list.length}</span>
      <b>Juma Memories</b><span>${s.collect.length} / ${G.activities.collectibles.length}</span>
      <b>Crimes stopped</b><span>${s.crimes}</span>
      <b>Enemy bases cleared</b><span>${s.bases.length} / ${G.activities.bases.length}</span>
      <b>Challenges</b><span>${G.activities.challenges.map(c => `${c.name}: ${s.challenges[c.id] ? s.challenges[c.id].toFixed(1) + 's' : '—'}`).join(' · ')}</span></div>
      <h3 style="margin-top:20px">Campaign</h3>${m.list.map((x, i) => `<div style="opacity:${i <= s.mission ? 1 : .4}">${i < s.mission ? '✓' : i === s.mission ? '▶' : '·'} ${i + 1}. <b>${x.title}</b> — ${x.desc}</div>`).join('')}`;
    } else if (tab === 'controls') {
      body.innerHTML = CONTROLS_HTML;
    } else {
      body.innerHTML = '<canvas id="mapcanvas"></canvas>';
      const c = $('mapcanvas'); c.width = c.clientWidth; c.height = c.clientHeight; const g = c.getContext('2d');
      const sc = Math.min(c.width / this.mapC.width, c.height / this.mapC.height);
      g.fillStyle = '#0d2233'; g.fillRect(0, 0, c.width, c.height);
      g.save(); g.translate((c.width - this.mapC.width * sc) / 2, (c.height - this.mapC.height * sc) / 2); g.scale(sc, sc); g.drawImage(this.mapC, 0, 0);
      const pt = (p, col, r, label) => { const x = (p.x - this.mapOx) / this.mapS, y = (p.z - this.mapOz) / this.mapS; g.fillStyle = col; g.beginPath(); g.arc(x, y, r / sc * 0.5, 0, 7); g.fill(); if (label) { g.font = `${12 / sc}px Rajdhani`; g.fillStyle = '#fff'; g.fillText(label, x + 8 / sc, y + 4 / sc); } };
      for (const [k, v] of Object.entries(LANDMARKS)) pt(v, '#aaa', 6, k.replace(/([A-Z])/g, ' $1').toUpperCase());
      for (const [, m] of this.markers) pt(m.pos, { mission: '#ffd34d', crime: '#ff4040', collect: '#6fe3ff', challenge: '#7dff8a', base: '#ff9a3a' }[m.cls] || '#fff', 8, m.cls === 'mission' ? m.label : null);
      for (const o of G.heroes) if (o.rig.root.visible) pt(o.pos, o.def.color, 14, o.def.name);
      g.restore();
    }
  }
  closePause() { $('pause').classList.add('hidden'); }
}
export const CONTROLS_HTML = `<div class="kv">
<b>Move / Look</b><span>WASD · Mouse</span>
<b>Web Swing</b><span>Hold SHIFT or RIGHT MOUSE in the air — release to fly. Steer with WASD to pick anchors & turn corners.</span>
<b>Sprint / Wall-run</b><span>Hold SHIFT on the ground; run into a wall to run up it</span>
<b>Jump / Launch</b><span>SPACE — while swinging: jump-release boost. Hold SPACE while falling: Web Wings glide</span>
<b>Dive</b><span>Hold CTRL (or C) in the air</span>
<b>Zip / Point Launch</b><span>E to zip to the crosshair point, then SPACE to point-launch</span>
<b>Air Trick</b><span>T after a release</span>
<b>Attack / Launcher</b><span>LEFT MOUSE combo · R launcher (then air combo)</span>
<b>Dodge</b><span>F — dodge on the Spider-Sense cue for PERFECT DODGE + counter</span>
<b>Web Strike / Grab</b><span>E near enemies (Venom: tendril grab & throw)</span>
<b>Web Shot</b><span>Q — 3 webs = webbed enemy (knock into walls to stick)</span>
<b>Finisher</b><span>X with a full focus bar</span>
<b>Abilities</b><span>1 · 2 · 3</span>
<b>Switch Hero</b><span>TAB (Ali ⇄ Majed) · V (Venom, after the campaign)</span>
<b>Menu</b><span>ESC — map, skills, suits, journal</span>
<b>Gamepad</b><span>Supported (A jump, RT swing, X attack, B dodge, Y web strike, LT dive)</span></div>`;
