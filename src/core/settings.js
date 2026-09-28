// Persistent game settings: graphics presets, gameplay, audio and key bindings.
const KEY = 'juma-brothers-settings-v1';

export const ACTIONS = [
  ['forward', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ['jump', 'Jump / Launch / Glide', 'Space'], ['swing', 'Web swing / Sprint', 'ShiftLeft'], ['dive', 'Dive', 'ControlLeft'],
  ['attack', 'Attack', 'Mouse0'], ['launcher', 'Launcher', 'KeyR'], ['dodge', 'Dodge', 'KeyF'], ['strike', 'Web strike / Zip', 'KeyE'],
  ['webshot', 'Web shot', 'KeyQ'], ['finisher', 'Finisher', 'KeyX'], ['trick', 'Air trick', 'KeyT'],
  ['ab1', 'Ability 1', 'Digit1'], ['ab2', 'Ability 2', 'Digit2'], ['ab3', 'Ability 3', 'Digit3'],
  ['switch', 'Switch brother', 'Tab'], ['venom', 'Become Venom', 'KeyV'], ['photo', 'Photo mode', 'KeyP'], ['next', 'Start next mission', 'Enter'],
];

export const PRESETS = {
  low: { renderScale: 0.6, shadows: 'off', ao: false, bloom: true, clouds: false, water: false, aa: 'off', viewDistance: 0.7, crowd: 0.35, traffic: 0.5, lampPools: false, detail: 'low' },
  medium: { renderScale: 0.85, shadows: 'low', ao: false, bloom: true, clouds: true, water: false, aa: 'smaa', viewDistance: 1.0, crowd: 0.7, traffic: 0.8, lampPools: true, detail: 'medium' },
  high: { renderScale: 1.0, shadows: 'medium', ao: true, bloom: true, clouds: true, water: true, aa: 'smaa', viewDistance: 1.2, crowd: 1.0, traffic: 1.0, lampPools: true, detail: 'high' },
  ultra: { renderScale: 1.25, shadows: 'high', ao: true, bloom: true, clouds: true, water: true, aa: 'smaa', viewDistance: 1.5, crowd: 1.0, traffic: 1.0, lampPools: true, detail: 'high' },
};

export const DEFAULTS = {
  preset: 'high', ...PRESETS.high,
  bloomStrength: 0.6, motionFx: true, filmGrain: true, fpsCounter: false, exposure: 1.0,
  fov: 64, sensitivity: 1.0, invertY: false, shake: 1.0, autoCamera: true, difficulty: 'normal', subtitles: true, hudScale: 1.0, markers: 'all', hints: true, dayLength: 24,
  master: 0.8, music: 0.6, sfx: 0.9, voice: 0.7,
  binds: Object.fromEntries(ACTIONS.map(a => [a[0], a[2]])),
};

export class Settings {
  constructor() {
    this.s = structuredClone(DEFAULTS);
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) { Object.assign(this.s, d); this.s.binds = { ...DEFAULTS.binds, ...(d.binds || {}) }; } } catch (e) { }
    if (location.search.includes('low')) Object.assign(this.s, PRESETS.low, { preset: 'low' });
    this.listeners = [];
  }
  get(k) { return this.s[k]; }
  set(k, v) {
    this.s[k] = v;
    if (k === 'preset' && PRESETS[v]) Object.assign(this.s, PRESETS[v]);
    else if (k in PRESETS.high) this.s.preset = 'custom';
    this.save(); this.listeners.forEach(f => f(k, v));
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { } }
  reset() { this.s = structuredClone(DEFAULTS); this.save(); this.listeners.forEach(f => f('*')); }
  onChange(f) { this.listeners.push(f); }
}

// ---- UI schema ------------------------------------------------------------
const opt = (k, label, type, extra = {}) => ({ k, label, type, ...extra });
export const SCHEMA = {
  Graphics: [
    opt('preset', 'Quality preset', 'select', { options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'], ['custom', 'Custom']] }),
    opt('renderScale', 'Resolution scale', 'range', { min: 0.5, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('shadows', 'Shadows', 'select', { options: [['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] }),
    opt('ao', 'Ambient occlusion (N8AO)', 'toggle'),
    opt('aa', 'Anti-aliasing', 'select', { options: [['off', 'Off'], ['smaa', 'SMAA']] }),
    opt('bloom', 'Bloom', 'toggle'),
    opt('bloomStrength', 'Bloom intensity', 'range', { min: 0, max: 1.5, step: 0.05 }),
    opt('clouds', 'Volumetric clouds', 'toggle'),
    opt('water', 'Water reflections', 'toggle'),
    opt('lampPools', 'Street light pools', 'toggle'),
    opt('viewDistance', 'View distance', 'range', { min: 0.5, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('crowd', 'Crowd density', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('traffic', 'Traffic density', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('exposure', 'Brightness', 'range', { min: 0.6, max: 1.6, step: 0.05 }),
    opt('motionFx', 'Speed blur & aberration', 'toggle'),
    opt('filmGrain', 'Film grain', 'toggle'),
    opt('fpsCounter', 'Show FPS', 'toggle'),
  ],
  Gameplay: [
    opt('difficulty', 'Difficulty', 'select', { options: [['easy', 'Friendly Neighborhood'], ['normal', 'Amazing'], ['hard', 'Spectacular']] }),
    opt('fov', 'Field of view', 'range', { min: 55, max: 90, step: 1, fmt: v => v + '°' }),
    opt('sensitivity', 'Mouse sensitivity', 'range', { min: 0.2, max: 3, step: 0.05 }),
    opt('invertY', 'Invert Y axis', 'toggle'),
    opt('autoCamera', 'Auto camera while swinging', 'toggle'),
    opt('shake', 'Camera shake', 'range', { min: 0, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('hudScale', 'HUD scale', 'range', { min: 0.7, max: 1.3, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('markers', 'World markers', 'select', { options: [['all', 'All activities'], ['mission', 'Mission only'], ['none', 'Off']] }),
    opt('subtitles', 'Subtitles', 'toggle'),
    opt('hints', 'Tutorial hints', 'toggle'),
    opt('dayLength', 'Day length', 'select', { options: [[12, '12 minutes'], [24, '24 minutes'], [48, '48 minutes'], [0, 'Frozen time']] }),
  ],
  Audio: [
    opt('master', 'Master volume', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('music', 'Music', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('sfx', 'Sound effects', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    opt('voice', 'Voices', 'range', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
  ],
  Controls: [],
};

const keyName = c => !c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace('Mouse0', 'Left Mouse').replace('Mouse1', 'Middle Mouse').replace('Mouse2', 'Right Mouse').replace('ShiftLeft', 'L-Shift').replace('ControlLeft', 'L-Ctrl').replace('ShiftRight', 'R-Shift').replace('ControlRight', 'R-Ctrl').replace('AltLeft', 'L-Alt');

export function renderSettings(el, settings, tab = 'Graphics') {
  const s = settings.s;
  const tabs = Object.keys(SCHEMA).map(t => `<button class="stab ${t === tab ? 'active' : ''}" data-t="${t}">${t.toUpperCase()}</button>`).join('');
  let body = '';
  if (tab === 'Controls') {
    body = `<div class="hint">Click a binding, then press a key or mouse button. ESC cancels. Right mouse always swings; gamepads use fixed bindings.</div><div class="binds">` +
      ACTIONS.map(([id, label]) => `<div class="setrow"><span>${label}</span><button class="bind" data-a="${id}">${keyName(s.binds[id])}</button></div>`).join('') + '</div>';
  } else {
    body = SCHEMA[tab].map(o => {
      const v = s[o.k];
      let ctl;
      if (o.type === 'toggle') ctl = `<button class="tog ${v ? 'on' : ''}" data-k="${o.k}">${v ? 'ON' : 'OFF'}</button>`;
      else if (o.type === 'select') ctl = `<select data-k="${o.k}">${o.options.map(([val, l]) => `<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      else ctl = `<input type="range" data-k="${o.k}" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}"><b class="val">${o.fmt ? o.fmt(v) : (+v).toFixed(2)}</b>`;
      return `<div class="setrow"><span>${o.label}</span><div class="ctl">${ctl}</div></div>`;
    }).join('');
  }
  el.innerHTML = `<div class="stabs">${tabs}<button class="stab reset">RESET TO DEFAULTS</button></div><div class="setbody">${body}</div>`;
  el.querySelectorAll('.stab[data-t]').forEach(b => b.onclick = () => renderSettings(el, settings, b.dataset.t));
  el.querySelector('.reset').onclick = () => { settings.reset(); renderSettings(el, settings, tab); };
  el.querySelectorAll('.tog').forEach(b => b.onclick = () => { settings.set(b.dataset.k, !s[b.dataset.k]); renderSettings(el, settings, tab); });
  el.querySelectorAll('select').forEach(b => b.onchange = () => { const o = SCHEMA[tab].find(x => x.k === b.dataset.k); const raw = b.value; const val = typeof o.options[0][0] === 'number' ? +raw : raw; settings.set(b.dataset.k, val); renderSettings(el, settings, tab); });
  el.querySelectorAll('input[type=range]').forEach(b => {
    const o = SCHEMA[tab].find(x => x.k === b.dataset.k);
    b.oninput = () => { b.nextElementSibling.textContent = o.fmt ? o.fmt(+b.value) : (+b.value).toFixed(2); };
    b.onchange = () => { settings.set(b.dataset.k, +b.value); if (o.k in PRESETS.high) renderSettings(el, settings, tab); };
  });
  el.querySelectorAll('.bind').forEach(b => b.onclick = (ev) => {
    ev.stopPropagation(); b.textContent = 'PRESS A KEY…'; b.classList.add('listening');
    const done = (code) => {
      removeEventListener('keydown', kd, true); removeEventListener('mousedown', md, true);
      if (code && code !== 'Escape') {
        const binds = { ...s.binds }; const prev = binds[b.dataset.a];
        const clash = Object.keys(binds).find(a => binds[a] === code && a !== b.dataset.a);
        if (clash) binds[clash] = prev; binds[b.dataset.a] = code;
        settings.set('binds', binds);
      }
      renderSettings(el, settings, 'Controls');
    };
    const kd = e => { e.preventDefault(); e.stopPropagation(); done(e.code); };
    const md = e => { e.preventDefault(); e.stopPropagation(); done('Mouse' + e.button); };
    setTimeout(() => { addEventListener('keydown', kd, true); addEventListener('mousedown', md, true); }, 50);
  });
}
