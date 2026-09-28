// Procedural WebAudio: web thwips, wind, impacts, voices (blips), adaptive music.
export class Audio {
  constructor() { this.ctx = null; this.intensity = 0; this.musicOn = true; this.vol = { master: 0.8, music: 0.6, sfx: 0.9, voice: 0.7 }; }
  setVolumes(v) { Object.assign(this.vol, v); if (!this.ctx) return; const t = this.now(); this.master.gain.setTargetAtTime(this.vol.master * 0.9, t, 0.05); this.mus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05); this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05); }
  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
    this.comp = ctx.createDynamicsCompressor(); this.comp.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.comp);
    this.mus = ctx.createGain(); this.mus.gain.value = 0.32; this.mus.connect(this.comp);
    // noise buffer
    const len = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // wind loop
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 400; this.windF.Q.value = 0.6;
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    src.connect(this.windF).connect(this.windG).connect(this.sfx); src.start();
    // city ambience (low rumble)
    const amb = ctx.createBufferSource(); amb.buffer = this.noise; amb.loop = true;
    const af = ctx.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 180; this.ambG = ctx.createGain(); this.ambG.gain.value = 0.12;
    amb.connect(af).connect(this.ambG).connect(this.sfx); amb.start();
    this.startMusic(); this.setVolumes({});
  }
  now() { return this.ctx.currentTime; }
  env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
  noiseHit(freq, q, peak, dcy, type = 'bandpass', sweepTo) {
    if (!this.ctx) return; const t = this.now();
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dcy);
    const g = this.ctx.createGain(); this.env(g, t, 0.004, peak, dcy);
    s.connect(f).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + dcy + 0.1);
  }
  tone(freq, dur, type = 'sine', peak = 0.3, slideTo, dest) {
    if (!this.ctx) return; const t = this.now();
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain(); this.env(g, t, 0.005, peak, dur);
    o.connect(g).connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  thwip(p, pitch = 1) { this.noiseHit(3200 * pitch, 2.5, 0.5, 0.12, 'bandpass', 900); this.tone(1400 * pitch, 0.06, 'triangle', 0.06, 500); }
  whoosh(a = 1) { this.noiseHit(700, 0.8, 0.25 * a, 0.35, 'bandpass', 250); }
  punch(heavy = 0) { this.tone(110 - heavy * 30, 0.14 + heavy * 0.1, 'sine', 0.7, 40); this.noiseHit(1800, 1, 0.35 + heavy * 0.2, 0.08, 'lowpass'); }
  zap() { this.tone(900, 0.2, 'sawtooth', 0.12, 120); this.noiseHit(5000, 4, 0.2, 0.15); }
  boom() { this.tone(60, 0.8, 'sine', 0.9, 25); this.noiseHit(400, 0.5, 0.8, 0.9, 'lowpass', 60); }
  gun() { this.noiseHit(2500, 0.7, 0.35, 0.09, 'highpass'); this.tone(180, 0.06, 'square', 0.1, 80); }
  land(a = 1) { this.tone(70, 0.25, 'sine', 0.6 * a, 35); this.noiseHit(300, 0.7, 0.3 * a, 0.25, 'lowpass'); }
  roar() { this.tone(90, 1.2, 'sawtooth', 0.35, 55); this.noiseHit(350, 1.5, 0.5, 1.2, 'bandpass', 120); }
  ui(k = 0) { this.tone(660 + k * 220, 0.08, 'triangle', 0.12); }
  chime() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.14), i * 70)); }
  voice(speaker) { // quick formant blips to accompany subtitles
    if (!this.ctx || this.vol.voice <= 0.01) return; const base = speaker === 'venom' ? 70 : speaker === 'majed' ? 120 : speaker === 'ali' ? 170 : 200;
    for (let i = 0; i < 4; i++) setTimeout(() => this.tone(base * (0.9 + Math.random() * 0.3), 0.07, speaker === 'venom' ? 'sawtooth' : 'triangle', 0.07 * this.vol.voice), i * 70);
  }
  honk() { this.tone(392, 0.25, 'square', 0.06); this.tone(330, 0.25, 'square', 0.05); }
  thunder() { this.noiseHit(120, 0.4, 0.9, 2.6, 'lowpass', 40); setTimeout(() => this.noiseHit(90, 0.5, 0.6, 1.8, 'lowpass', 30), 300); }
  step(a = 0.2) { this.noiseHit(900 + Math.random() * 400, 1.2, a * 0.25, 0.05, 'bandpass'); }
  setWind(speed) { if (!this.ctx) return; const a = Math.min(1, Math.max(0, (speed - 8) / 45)); this.windG.gain.setTargetAtTime(a * 0.5, this.now(), 0.1); this.windF.frequency.setTargetAtTime(300 + a * 1400, this.now(), 0.2); }
  startMusic() {
    const ctx = this.ctx; const bpm = 104, beat = 60 / bpm;
    const prog = [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]]; // Am F C G
    let step = 0; let next = ctx.currentTime + 0.2;
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const sched = () => {
      while (next < ctx.currentTime + 0.3) {
        const bar = Math.floor(step / 16) % 4, s16 = step % 16, chord = prog[bar];
        const I = this.intensity;
        if (this.musicOn) {
          // pad at bar start
          if (s16 === 0) chord.forEach(m => this.pad(mtof(m + 12), beat * 4, next));
          // bass
          if (s16 % 4 === 0 || (I > 0.5 && s16 % 2 === 0)) this.bass(mtof(chord[0] - 12), beat * 0.45, next);
          // arp
          if (I > 0.15 || s16 % 2 === 0) { const n = chord[(s16 * 3) % 4] + 24; this.pluck(mtof(n), next, 0.05 + I * 0.04); }
          // drums
          if (s16 % 8 === 0) this.kick(next, 0.6 + I * 0.4);
          if (s16 % 8 === 4) this.snare(next, 0.2 + I * 0.35);
          if (I > 0.3 && s16 % 2 === 1) this.hat(next, 0.05 + I * 0.08);
          if (I > 0.6 && s16 === 14) this.kick(next, 0.7);
        }
        next += beat / 4; step++;
      }
      setTimeout(sched, 80);
    };
    sched();
  }
  pad(f, dur, t) { const ctx = this.ctx; for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900 + this.intensity * 1500; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(fl).connect(g).connect(this.mus); o.start(t); o.stop(t + dur + 0.1); } }
  bass(f, dur, t) { const ctx = this.ctx; const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 300 + this.intensity * 500; const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(fl).connect(g).connect(this.mus); o.start(t); o.stop(t + dur); }
  pluck(f, t, a) { const ctx = this.ctx; const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g).connect(this.mus); o.start(t); o.stop(t + 0.3); }
  kick(t, a) { const ctx = this.ctx; const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); const g = ctx.createGain(); g.gain.setValueAtTime(a * 0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(this.mus); o.start(t); o.stop(t + 0.3); }
  snare(t, a) { const ctx = this.ctx; const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; const g = ctx.createGain(); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f).connect(g).connect(this.mus); s.start(t, Math.random()); s.stop(t + 0.2); }
  hat(t, a) { const ctx = this.ctx; const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(this.mus); s.start(t, Math.random()); s.stop(t + 0.06); }
}
