import * as THREE from 'three';

export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917), (s ^= s >>> 16) >>> 0) / 4294967296); }
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noiseFill(g, w, h, base, amt, r) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

// Facade textures: albedo, packed roughness/metalness, and night emissive.
// One texture tile = cols x rows windows. Styles: glass curtain wall, punched stone, brick.
export function facadeSet(style, seed) {
  const r = rng(seed);
  const S = 512, cols = 4, rows = 4, cw = S / cols, ch = S / rows;
  const [ca, ga] = canvas(S, S), [cr, gr] = canvas(S, S), [ce, ge] = canvas(1024, 1024);
  const pal = {
    glass: { wall: '#5d6a78', win: ['#6f8aa6', '#7d98b3', '#5f7c99'], frame: '#2a3038', rough: 70, wrough: 18, metal: 40, wmetal: 230, wf: 0.94, hf: 0.9 },
    darkglass: { wall: '#1d242c', win: ['#243241', '#2c3c4e', '#1e2a38'], frame: '#101418', rough: 80, wrough: 12, metal: 60, wmetal: 240, wf: 0.95, hf: 0.92 },
    stone: { wall: '#c3b59b', win: ['#3a4452', '#2f3845', '#465363'], frame: '#e8e0cc', rough: 225, wrough: 30, metal: 0, wmetal: 180, wf: 0.5, hf: 0.58 },
    brick: { wall: '#7e4331', win: ['#2c3440', '#36404d', '#252c36'], frame: '#ddd6c8', rough: 235, wrough: 30, metal: 0, wmetal: 170, wf: 0.46, hf: 0.55 },
    concrete: { wall: '#8e8d88', win: ['#3c4854', '#4a5866', '#34404c'], frame: '#5c5c58', rough: 215, wrough: 25, metal: 0, wmetal: 190, wf: 0.62, hf: 0.6 },
    deco: { wall: '#b3a17f', win: ['#3a4250', '#434d5d', '#2e3642'], frame: '#8a7650', rough: 200, wrough: 30, metal: 10, wmetal: 180, wf: 0.4, hf: 0.66 },
  }[style];
  ga.fillStyle = pal.wall; ga.fillRect(0, 0, S, S);
  gr.fillStyle = `rgb(0,${pal.rough},${pal.metal})`; gr.fillRect(0, 0, S, S);
  if (style === 'brick') {
    for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < S; x += 16) {
      const v = (r() - 0.5) * 30; ga.fillStyle = `rgb(${126 + v},${67 + v * 0.6},${49 + v * 0.4})`; ga.fillRect(x + 1, y + 1, 14, 6);
    }
  }
  if (style === 'stone' || style === 'deco') {
    ga.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < S; y += ch) ga.fillRect(0, y + ch - 6, S, 6); // cornice lines
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const w = cw * pal.wf, h = ch * pal.hf, x = i * cw + (cw - w) / 2, y = j * ch + (ch - h) / 2;
    ga.fillStyle = pal.frame; ga.fillRect(x - 3, y - 3, w + 6, h + 6);
    const grad = ga.createLinearGradient(x, y, x + w, y + h);
    const c = pal.win[Math.floor(r() * pal.win.length)];
    grad.addColorStop(0, c); grad.addColorStop(0.6, pal.win[0]); grad.addColorStop(1, '#1a2028');
    ga.fillStyle = grad; ga.fillRect(x, y, w, h);
    ga.fillStyle = 'rgba(255,255,255,0.06)'; ga.fillRect(x, y, w * 0.35, h);
    ga.fillStyle = pal.frame; ga.fillRect(x + w / 2 - 1.5, y, 3, h);
    if (style === 'glass' || style === 'darkglass') ga.fillRect(x, y + h * 0.5, w, 2);
    gr.fillStyle = `rgb(0,${pal.wrough + r() * 20},${pal.wmetal})`; gr.fillRect(x, y, w, h);
  }
  noiseFill(ga, S, S, 0, 14, r);
  // Emissive: 8x8 window grid (two tiles), random lit windows with warm/cool tints
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 1024, 1024);
  const ecw = 1024 / 8, ech = 1024 / 8;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    if (r() > 0.42) continue;
    const w = ecw * pal.wf, h = ech * pal.hf, x = i * ecw + (ecw - w) / 2, y = j * ech + (ech - h) / 2;
    const warm = r();
    const col = warm < 0.6 ? `hsl(${35 + r() * 12},85%,${50 + r() * 20}%)` : warm < 0.85 ? `hsl(200,40%,${60 + r() * 20}%)` : `hsl(50,30%,80%)`;
    const g = ge.createLinearGradient(x, y, x, y + h); g.addColorStop(0, col); g.addColorStop(1, 'rgba(40,25,10,1)');
    ge.fillStyle = g; ge.fillRect(x, y, w * (0.5 + r() * 0.5), h);
  }
  const map = tex(ca), rm = tex(cr, true, false), em = tex(ce);
  em.repeat.set(0.5, 0.5);
  return { map, rm, em };
}

export function groundTextures() {
  const [c, g] = canvas(512, 512); const r = rng(7);
  g.fillStyle = '#34373b'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 40 + r() * 40; g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`; g.fillRect(r() * 512, r() * 512, 2, 2); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(15,15,15,0.35)'; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - .5) * 60; y += (r() - .5) * 60; g.lineTo(x, y); } g.stroke(); }
  const asphalt = tex(c);
  const [c2, g2] = canvas(256, 256);
  g2.fillStyle = '#8f8c86'; g2.fillRect(0, 0, 256, 256);
  g2.strokeStyle = '#6f6c68'; g2.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { g2.beginPath(); g2.moveTo(i, 0); g2.lineTo(i, 256); g2.moveTo(0, i); g2.lineTo(256, i); g2.stroke(); }
  noiseFill(g2, 256, 256, 0, 18, r);
  const sidewalk = tex(c2);
  const [c3, g3] = canvas(512, 512);
  g3.fillStyle = '#3e5e2c'; g3.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 20000; i++) { g3.fillStyle = `hsla(${80 + r() * 40},${35 + r() * 30}%,${18 + r() * 22}%,0.6)`; g3.fillRect(r() * 512, r() * 512, 1.5, 3); }
  const grass = tex(c3);
  const [c4, g4] = canvas(256, 256);
  g4.fillStyle = '#3b3b3b'; g4.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) { const v = 40 + r() * 50; g4.fillStyle = `rgb(${v},${v},${v})`; g4.fillRect(r() * 256, r() * 256, 2, 2); }
  const roof = tex(c4);
  // water normal map
  const [c5, g5] = canvas(256, 256); const img = g5.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const a = Math.sin(x * 0.098 + Math.sin(y * 0.05) * 2) + Math.sin(y * 0.147 + x * 0.03) * 0.7 + Math.sin((x + y) * 0.2) * 0.3;
    const b = Math.cos(y * 0.098 + Math.cos(x * 0.06) * 2) + Math.cos(x * 0.12 - y * 0.04) * 0.7;
    const i = (y * 256 + x) * 4; img.data[i] = 128 + a * 30; img.data[i + 1] = 128 + b * 30; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g5.putImageData(img, 0, 0); const waterN = tex(c5, true, false);
  // crosswalk
  const [c6, g6] = canvas(128, 32); g6.clearRect(0, 0, 128, 32); g6.fillStyle = '#d8d8d0';
  for (let x = 4; x < 128; x += 16) g6.fillRect(x, 0, 9, 32);
  const cross = tex(c6, false);
  return { asphalt, sidewalk, grass, roof, waterN, cross };
}

export function billboardTexture(seed, text) {
  const r = rng(seed);
  const [c, g] = canvas(512, 256);
  const hue = Math.floor(r() * 360);
  const grd = g.createLinearGradient(0, 0, 512, 256);
  grd.addColorStop(0, `hsl(${hue},90%,45%)`); grd.addColorStop(1, `hsl(${(hue + 60) % 360},90%,25%)`);
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 6; i++) { g.fillStyle = `hsla(${(hue + i * 40) % 360},100%,70%,0.25)`; g.beginPath(); g.arc(r() * 512, r() * 256, 30 + r() * 90, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.font = 'bold 64px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12; g.fillText(text, 256, 128);
  return tex(c, false);
}
