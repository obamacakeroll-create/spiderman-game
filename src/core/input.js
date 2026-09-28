// Keyboard / mouse / gamepad input with edge detection.
export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.dom = dom;
    this.gamepad = null;
    this.padPrev = {}; this.map = null; this.blocked = new Set();
    addEventListener('keydown', e => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.target && e.target.tagName === 'SELECT') return;
      const c = this.tr(e.code); if (!c) return;
      if (!this.keys.has(c)) this.pressed.add(c);
      this.keys.add(c);
    });
    addEventListener('keyup', e => { const c = this.tr(e.code); if (!c) return; this.keys.delete(c); this.released.add(c); });
    addEventListener('mousedown', e => {
      const c = this.tr('Mouse' + e.button); if (!c) return;
      if (!this.keys.has(c)) this.pressed.add(c);
      this.keys.add(c);
    });
    addEventListener('mouseup', e => { const c = this.tr('Mouse' + e.button); if (!c) return; this.keys.delete(c); this.released.add(c); });
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === dom; });
    addEventListener('blur', () => this.keys.clear());
  }
  // Key rebinding: physical code -> logical (default) code used by gameplay
  setBinds(binds, actions) {
    this.map = new Map(); this.blocked = new Set();
    for (const [id, , def] of actions) { this.map.set(binds[id], def); if (binds[id] !== def) this.blocked.add(def); }
    this.keys.clear();
  }
  tr(code) {
    if (code === 'Mouse2' || code === 'Escape') return code;
    if (this.map && this.map.has(code)) return this.map.get(code);
    if (this.blocked.has(code)) return null;
    return code;
  }
  lock() { if (!this.locked) this.dom.requestPointerLock?.(); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find(p => p);
    this.gamepad = gp || null;
    if (!gp) return;
    const map = { 0: 'Space', 1: 'KeyF', 2: 'Mouse0', 3: 'KeyE', 4: 'KeyQ', 5: 'KeyR', 6: 'ControlLeft', 7: 'ShiftLeft', 9: 'Escape', 12: 'Tab', 13: 'KeyX', 14: 'Digit1', 15: 'Digit2', 10: 'KeyT', 11: 'Digit3' };
    for (const [i, code] of Object.entries(map)) {
      const down = gp.buttons[i] && gp.buttons[i].pressed;
      const was = this.padPrev[i];
      if (down && !was) { this.pressed.add(code); this.keys.add(code); }
      if (!down && was) { this.keys.delete(code); this.released.add(code); }
      this.padPrev[i] = down;
    }
    const dz = v => Math.abs(v) < 0.15 ? 0 : v;
    this.mouseDX += dz(gp.axes[2] || 0) * 14;
    this.mouseDY += dz(gp.axes[3] || 0) * 10;
  }
  down(...codes) { return codes.some(c => this.keys.has(c)); }
  hit(...codes) { return codes.some(c => this.pressed.has(c)); }
  up(...codes) { return codes.some(c => this.released.has(c)); }
  moveAxis() {
    let x = 0, y = 0;
    if (this.down('KeyW', 'ArrowUp')) y += 1;
    if (this.down('KeyS', 'ArrowDown')) y -= 1;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.gamepad) {
      const ax = this.gamepad.axes[0] || 0, ay = this.gamepad.axes[1] || 0;
      if (Math.abs(ax) > 0.15) x += ax;
      if (Math.abs(ay) > 0.15) y -= ay;
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  endFrame() { this.pressed.clear(); this.released.clear(); this.mouseDX = 0; this.mouseDY = 0; }
}

// A synthetic input used by AI-controlled heroes (same interface subset as Input).
export class VirtualInput {
  constructor() { this.keys = new Set(); this.pressed = new Set(); this.released = new Set(); this.axis = { x: 0, y: 0 }; }
  set(code, on) {
    if (on && !this.keys.has(code)) { this.pressed.add(code); this.keys.add(code); }
    if (!on && this.keys.has(code)) { this.keys.delete(code); this.released.add(code); }
  }
  down(...c) { return c.some(k => this.keys.has(k)); }
  hit(...c) { return c.some(k => this.pressed.has(k)); }
  up(...c) { return c.some(k => this.released.has(k)); }
  moveAxis() { return this.axis; }
  endFrame() { this.pressed.clear(); this.released.clear(); }
}
