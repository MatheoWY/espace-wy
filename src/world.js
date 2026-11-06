// Monde : architecture, décoration (charte Work&You), sièges, télés, panneaux, collisions.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Charte
export const BRAND = { rose: '#D6006C', navy: '#2E3484', blue: '#4676ED', purple: '#6A3FB5', ink: '#1d2050', paper: '#F7F6FA', lav: '#EEF0FB' };

export const ROOMS = {
  reunion:     { x0: -14, x1: -2, z0: -13, z1: 0,   label: 'Réunion · Brainstorm',    short: 'RÉUNION',     color: BRAND.blue },
  prospection: { x0: -14, x1: -2, z0: -28, z1: -13, label: 'Prospection commerciale', short: 'PROSPECTION', color: BRAND.rose },
  dressing:    { x0: 2,   x1: 12, z0: -10, z1: 0,   label: 'Dressing',                short: 'DRESSING',    color: '#B44DB0' },
  amphi:       { x0: 2,   x1: 22, z0: -28, z1: -10, label: 'Amphithéâtre',            short: 'AMPHI',       color: BRAND.purple },
  couloir:     { x0: -2,  x1: 2,  z0: -28, z1: 0,   label: 'Couloir',                 short: 'COULOIR',     color: '#8C93C4' },
  accueil:     { x0: -14, x1: 14, z0: 0,   z1: 16,  label: 'Accueil',                 short: 'ACCUEIL',     color: BRAND.navy },
};
const ORDER = ['reunion', 'prospection', 'dressing', 'amphi', 'couloir', 'accueil'];
export const ENCLOSED = new Set(['reunion', 'prospection', 'dressing', 'amphi']);

export function zoneAt(x, z) {
  for (const k of ORDER) { const r = ROOMS[k]; if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return k; }
  return 'dehors';
}
const AMPHI_ROWS = [{ x: 15, h: 0 }, { x: 13, h: 0.2 }, { x: 11, h: 0.4 }, { x: 9, h: 0.6 }, { x: 7, h: 0.8 }];
export const STAGE_X = 17;
export function heightAt(x, z) {
  if (zoneAt(x, z) !== 'amphi') return 0;
  if (x >= STAGE_X) return 0.6;
  for (const r of AMPHI_ROWS) if (x >= r.x - 1 && x < r.x + 1) return r.h;
  return 0;
}
export function onStage(x, z) { return zoneAt(x, z) === 'amphi' && x >= STAGE_X; }

export const FONT_TITLE = '"Poppins", "Segoe UI", sans-serif';
export const FONT_TEXT = '"Poppins", "Segoe UI", sans-serif';

// ---------- utilitaires ----------
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
const jit = (h, a) => { const [r, g, b] = hex2rgb(h); const k = (rnd() - 0.5) * a; return rgb(r + k, g + k, b + k); };
function noise(g, w, h, a) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const k = (rnd() - 0.5) * a; d[i] += k; d[i + 1] += k; d[i + 2] += k; }
  g.putImageData(img, 0, 0);
}
function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function floorTex(kind, a, b, rep) {
  const s = 512, c = mkCanvas(s, s), g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, s, s);
  if (kind === 'oak') {
    const ph = 48;
    for (let y = 0; y < s; y += ph) {
      let x = -Math.floor(rnd() * 200);
      while (x < s) {
        const len = 180 + rnd() * 220;
        g.fillStyle = jit(a, 22); g.fillRect(x, y, len, ph);
        g.strokeStyle = 'rgba(120,80,40,.13)'; g.lineWidth = 1.2;
        for (let k = 0; k < 7; k++) {
          const yy = y + 4 + rnd() * (ph - 8), amp = 1 + rnd() * 2.5, f = 0.012 + rnd() * 0.03, p0 = rnd() * 6;
          g.beginPath(); for (let xx = x; xx < x + len; xx += 4) g.lineTo(xx, yy + Math.sin(xx * f + p0) * amp); g.stroke();
        }
        g.fillStyle = b; g.fillRect(x, y, 2, ph);
        x += len;
      }
      g.fillStyle = b; g.fillRect(0, y, s, 2);
    }
    noise(g, s, s, 8);
  } else if (kind === 'tiles') {
    const t = 256;
    for (let y = 0; y < s; y += t) for (let x = 0; x < s; x += t) {
      const gr = g.createLinearGradient(x, y, x + t, y + t); gr.addColorStop(0, jit(a, 6)); gr.addColorStop(1, jit(a, 6));
      g.fillStyle = gr; g.fillRect(x, y, t, t);
    }
    noise(g, s, s, 9);
    g.fillStyle = b; for (let i = 0; i <= s; i += t) { g.fillRect(i - 2, 0, 4, s); g.fillRect(0, i - 2, s, 4); }
  } else if (kind === 'carpet') {
    noise(g, s, s, 22);
    if (b) { g.strokeStyle = b; g.lineWidth = 3; for (let i = 0; i < s; i += 128) { g.beginPath(); g.moveTo(0, i + 64); g.lineTo(s, i + 64); g.stroke(); } }
    noise(g, s, s, 10);
  } else if (kind === 'herring') {
    const w = 32, l = 128;
    for (let y = -l; y < s + l; y += w * 2) for (let x = -l; x < s + l; x += l) {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = jit(a, 20); g.fillRect(0, 0, l, w); g.strokeStyle = b; g.strokeRect(0, 0, l, w); g.restore();
      g.save(); g.translate(x + l / 2, y); g.rotate(-Math.PI / 4); g.fillStyle = jit(a, 20); g.fillRect(0, 0, l, w); g.strokeStyle = b; g.strokeRect(0, 0, l, w); g.restore();
    }
    noise(g, s, s, 8);
  } else if (kind === 'grid') {
    g.fillStyle = b; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s);
  }
  return canvasTex(c, rep);
}
let wallCanvas = null;
function wallTexture(len, h) {
  if (!wallCanvas) {
    const s = 512; wallCanvas = mkCanvas(s, s); const g = wallCanvas.getContext('2d');
    g.fillStyle = '#F7F6FA'; g.fillRect(0, 0, s, s); noise(g, s, s, 5);
  }
  const t = canvasTex(wallCanvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, len / 3), h / 3);
  return t;
}

// matériaux
const matCache = new Map();
export function lam(color, rough = 0.72, metal = 0.02) {
  const k = color + rough + metal;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(k);
}
const M = {
  oak: () => lam('#C99A66', 0.55), oakLight: () => lam('#DDBB8E', 0.6), white: () => lam('#F4F3F7', 0.5), black: () => lam('#22243A', 0.4, 0.4),
  navyFab: () => lam(BRAND.navy, 0.95), roseFab: () => lam(BRAND.rose, 0.9), blueFab: () => lam(BRAND.blue, 0.9), steel: () => lam('#B9BDCC', 0.3, 0.8),
  glow: (c) => { const k = 'glow' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); return matCache.get(k); },
};
const geoCache = new Map();
function rbox(w, h, d, rr) {
  const r = rr ?? Math.min(0.05, Math.min(w, h, d) * 0.3);
  const k = [w, h, d, r].map((v) => (+v).toFixed(3)).join('x');
  if (!geoCache.has(k)) geoCache.set(k, r > 0.012 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
function box(parent, w, h, d, mat, x, y, z, rr) {
  const m = new THREE.Mesh(rbox(w, h, d, rr), typeof mat === 'string' ? lam(mat) : mat);
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cyl(parent, rt, rb, h, mat, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof mat === 'string' ? lam(mat) : mat);
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function rotXZ(lx, lz, ry) { return [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)]; }

export function drawTextCanvas(c, lines, { bg = '#ffffff', fg = BRAND.navy, border = null, accent = null, font = FONT_TITLE, align = 'center', radius = 0 } = {}) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = bg; if (radius) { rrect(g, 0, 0, c.width, c.height, radius); g.fill(); } else g.fillRect(0, 0, c.width, c.height);
  if (border) { g.strokeStyle = border; g.lineWidth = Math.max(4, c.height * 0.05); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, c.width - g.lineWidth, c.height - g.lineWidth); }
  if (accent) { g.fillStyle = accent; g.fillRect(0, 0, Math.max(10, c.height * 0.09), c.height); }
  g.textAlign = align; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((ln, i) => {
    const size = ln.size || Math.floor(c.height / (n + 1.2) * 0.55);
    g.font = `${ln.weight || 700} ${size}px ${ln.font || font}`;
    g.fillStyle = ln.color || fg;
    const x = align === 'center' ? c.width / 2 : (accent ? c.height * 0.2 : 0) + 30;
    const y = ln.y != null ? ln.y * c.height : c.height * (i + 1) / (n + 1);
    g.fillText(ln.text, x, y, c.width - 40);
  });
}

// ---------- monde ----------
export function buildWorld(scene) {
  const W = new THREE.Group(); scene.add(W);
  const colliders = [], seats = [], tvs = {}, fadeables = [], doorSigns = {}, redrawers = [], lights = [];
  const addCol = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ });

  // Sol extérieur (maquette sur fond clair)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: floorTex('grid', '#E3E6F3', '#D3D8EC', [65, 65]), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true; W.add(ground);
  // socle du bâtiment
  box(W, 36.6, 0.2, 44.6, lam('#C9CDE0', 0.9), 4, -0.22, -6, 0.08);

  const floors = {
    accueil: ['oak', '#D9B78C', '#B8935F', 0.5],
    couloir: ['carpet', '#3A418E', null, 0.95],
    reunion: ['tiles', '#ECEDF2', '#D3D6E2', 0.35],
    prospection: ['carpet', '#4A5296', '#5A64B0', 0.95],
    dressing: ['herring', '#E6CFAE', 'rgba(140,100,60,.35)', 0.5],
    amphi: ['carpet', '#262B6B', '#3A2F80', 0.95],
  };
  for (const [k, [kind, a, b, rough]] of Object.entries(floors)) {
    const r = ROOMS[k], w = r.x1 - r.x0, d = r.z1 - r.z0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: floorTex(kind, a, b, [w / 4, d / 4]), roughness: rough }));
    m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, 0.001, (r.z0 + r.z1) / 2); m.receiveShadow = true; W.add(m);
  }

  // ----- Murs -----
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f5ff, metalness: 0, roughness: 0.48, transmission: 1, thickness: 0.2, ior: 1.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glassClear = new THREE.MeshBasicMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0.12, depthWrite: false });
  const metal = lam('#2B2F4A', 0.35, 0.6);
  // bande dépolie décorative (vitrophanie rose) sur les vitres
  const WALLS = [
    { a: [-14, 16], b: [14, 16], t: 's', gaps: [[-1.6, 1.6]] },
    { a: [-14, 0], b: [-14, 16], t: 's' },
    { a: [14, 0], b: [14, 16], t: 's' },
    { a: [-14, 0], b: [-2, 0], t: 's' },
    { a: [2, 0], b: [14, 0], t: 's' },
    { a: [-2, -13], b: [-2, 0], t: 'g', gaps: [[-7.5, -5.5]] },
    { a: [-2, -28], b: [-2, -13], t: 'g', gaps: [[-21.5, -19.5]] },
    { a: [2, -10], b: [2, 0], t: 'g', gaps: [[-6, -4]] },
    { a: [2, -28], b: [2, -10], t: 'g', gaps: [[-20, -18]], h: 4.5 },
    { a: [-2, -28], b: [2, -28], t: 's' },
    { a: [-14, -28], b: [-14, 0], t: 's' },
    { a: [-14, -13], b: [-2, -13], t: 's' },
    { a: [-14, -28], b: [-2, -28], t: 's' },
    { a: [12, -10], b: [12, 0], t: 's' },
    { a: [2, -10], b: [22, -10], t: 's', h: 4.5 },
    { a: [22, -28], b: [22, -10], t: 's', h: 4.5 },
    { a: [2, -28], b: [22, -28], t: 's', h: 4.5 },
  ];
  const stripeMat = new THREE.MeshStandardMaterial({ color: BRAND.rose, roughness: 0.4, transparent: true, opacity: 0.85 });
  for (const wl of WALLS) {
    const h = wl.h || 3;
    const alongZ = wl.a[0] === wl.b[0];
    const fixed = alongZ ? wl.a[0] : wl.a[1];
    const lo = Math.min(alongZ ? wl.a[1] : wl.a[0], alongZ ? wl.b[1] : wl.b[0]);
    const hi = Math.max(alongZ ? wl.a[1] : wl.a[0], alongZ ? wl.b[1] : wl.b[0]);
    const gaps = (wl.gaps || []).slice().sort((p, q) => p[0] - q[0]);
    const segs = []; let cur = lo;
    for (const [g0, g1] of gaps) { if (g0 > cur) segs.push([cur, g0]); cur = g1; }
    if (cur < hi) segs.push([cur, hi]);
    const place = (m, c) => { if (alongZ) { m.position.x = fixed; m.position.z = c; m.rotation.y = Math.PI / 2; } else { m.position.x = c; m.position.z = fixed; } };
    for (const [s0, s1] of segs) {
      const len = s1 - s0, c = (s0 + s1) / 2;
      if (wl.t === 's') {
        const m1 = new THREE.MeshStandardMaterial({ map: wallTexture(len, h), roughness: 0.92, transparent: true });
        const m2 = new THREE.MeshStandardMaterial({ color: '#D9D6E2', roughness: 0.6, transparent: true });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.25), m1); wall.position.y = h / 2; place(wall, c); W.add(wall);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.08, 0.28), m2); cap.position.y = h - 0.04; place(cap, c); W.add(cap);
        const base = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.1, 0.28), m2); base.position.y = 0.05; place(base, c); W.add(base);
        const obj = { mats: [m1, m2], faded: false };
        for (const mm of [wall, cap, base]) { mm.castShadow = true; mm.receiveShadow = true; mm.userData.wall = obj; fadeables.push(mm); }
        const t = 0.15;
        if (alongZ) addCol(fixed - t, fixed + t, s0, s1); else addCol(s0, s1, fixed - t, fixed + t);
      } else {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(len, h - 0.16, 0.05), glassMat); glass.position.y = h / 2; place(glass, c); W.add(glass);
        glass.userData.wall = { glass: true, mesh: glass, faded: false }; fadeables.push(glass);
        for (const [yy, hh] of [[0, 0.1], [h - 0.1, 0.1]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(len, hh, 0.1), metal); r.position.y = yy + hh / 2; place(r, c); r.castShadow = true; W.add(r); }
        const st = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), stripeMat); st.position.y = 1.15; place(st, c); W.add(st);
        const n = Math.max(1, Math.round(len / 2.4));
        for (let i = 0; i <= n; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.1), metal); p.position.y = h / 2; p.castShadow = true; place(p, s0 + (len * i) / n); W.add(p); }
        const t = 0.08;
        if (alongZ) addCol(fixed - t, fixed + t, s0, s1); else addCol(s0, s1, fixed - t, fixed + t);
      }
    }
    if (wl.t === 'g') for (const [g0, g1] of gaps) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(g1 - g0, h - 2.3, 0.14), metal); l.position.y = 2.3 + (h - 2.3) / 2; place(l, (g0 + g1) / 2); W.add(l);
    }
  }
  box(W, 4, 0.5, 0.25, metal, 0, 2.5, 0, 0.02);

  // ----- Décor mural (peintures, cadres, panneaux) -----
  function wallItem(mesh) {
    mesh.material = mesh.material.clone(); mesh.material.transparent = true;
    mesh.userData.wall = { mats: [mesh.material], faded: false }; fadeables.push(mesh);
    W.add(mesh); return mesh;
  }
  // ry : 0 → regarde +z ; PI → -z ; PI/2 → +x ; -PI/2 → -x
  function paint(x, y, z, ry, w, h, color) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; return wallItem(m);
  }
  function canvasPlane(x, y, z, ry, w, h, px, draw, { basic = true } = {}) {
    const c = mkCanvas(Math.round(w * px), Math.round(h * px)); const tex = canvasTex(c);
    const mat = basic ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry;
    const redraw = () => { draw(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; };
    redraw(); redrawers.push(redraw);
    wallItem(m); m.material.map = tex;
    return { mesh: m, canvas: c, tex, redraw };
  }
  function frame(x, y, z, ry, w, h, draw) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; W.add(g);
    const f = new THREE.Mesh(rbox(w + 0.1, h + 0.1, 0.05, 0.015), lam('#1F2238', 0.5)); f.castShadow = true; g.add(f);
    const c = mkCanvas(Math.round(w * 220), Math.round(h * 220)); const tex = canvasTex(c);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, transparent: true })); p.position.z = 0.03; g.add(p);
    f.material = f.material.clone(); f.material.transparent = true;
    const obj = { mats: [f.material, p.material], faded: false }; for (const mm of [f, p]) { mm.userData.wall = obj; fadeables.push(mm); }
    const redraw = () => { draw(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; }; redraw(); redrawers.push(redraw);
    return g;
  }
  const statCard = (big, small, sub, c1, c2) => (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(w * 0.9, h * 0.1, w * 0.5, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `800 ${w * 0.3}px ${FONT_TITLE}`; g.fillText(big, w * 0.1, h * 0.42);
    g.font = `700 ${w * 0.085}px ${FONT_TITLE}`; g.fillText(small, w * 0.1, h * 0.56);
    g.font = `400 ${w * 0.06}px ${FONT_TEXT}`; g.globalAlpha = 0.85;
    wrapText(g, sub, w * 0.1, h * 0.67, w * 0.8, w * 0.078, 4); g.globalAlpha = 1;
  };
  function wordmark(g, w, h, { bg = BRAND.navy, tagline = 'Provoquons LA rencontre professionnelle', sub = null } = {}) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const s = h * 0.36;
    g.font = `800 ${s}px ${FONT_TITLE}`;
    const t1 = 'Work', t2 = '&', t3 = 'You';
    const w1 = g.measureText(t1).width, w2 = g.measureText(t2).width, w3 = g.measureText(t3).width;
    let x = w / 2 - (w1 + w2 + w3) / 2; g.textAlign = 'left';
    g.fillStyle = '#fff'; g.fillText(t1, x, h * 0.42); x += w1;
    g.fillStyle = BRAND.rose; g.fillText(t2, x, h * 0.42); x += w2;
    g.fillStyle = '#fff'; g.fillText(t3, x, h * 0.42);
    g.textAlign = 'center'; g.font = `500 ${h * 0.11}px ${FONT_TEXT}`; g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText(tagline, w / 2, h * 0.74);
    if (sub) { g.font = `700 ${h * 0.08}px ${FONT_TEXT}`; g.fillStyle = BRAND.rose; g.fillText(sub, w / 2, h * 0.9); }
  }
  function wrapText(g, text, x, y, maxW, lh, maxL) {
    const words = String(text).split(/\s+/); let line = '', n = 0;
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y + n * lh); n++; line = wd; if (n >= maxL) return; } else line = t;
    }
    if (line && n < maxL) g.fillText(line, x, y + n * lh);
  }
  function feltPanels(cx, cy, z, ry, cols, rows, colors) {
    const g = new THREE.Group(); g.position.set(cx, cy, z); g.rotation.y = ry; W.add(g);
    const r = 0.32, dx = r * 1.75, dy = r * 1.52;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (rnd() < 0.18) continue;
      const hx = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 6), lam(colors[Math.floor(rnd() * colors.length)], 1));
      hx.rotation.x = Math.PI / 2; hx.rotation.y = Math.PI / 6;
      hx.position.set((i - (cols - 1) / 2) * dx + (j % 2) * dx / 2, (j - (rows - 1) / 2) * dy, 0.03 + rnd() * 0.04); hx.castShadow = true; g.add(hx);
    }
  }
  function slats(cx, cy, z, ry, w, h) {
    const g = new THREE.Group(); g.position.set(cx, cy, z); g.rotation.y = ry; W.add(g);
    box(g, w, h, 0.02, lam('#1F2238', 1), 0, -h / 2, 0.01, 0);
    for (let x = -w / 2 + 0.05; x < w / 2; x += 0.11) box(g, 0.06, h, 0.05, M.oak(), x, -h / 2, 0.045, 0.01);
  }
  function wallLight(x, y, z, ry, color = '#FFE7C2') {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; W.add(g);
    box(g, 0.12, 0.35, 0.1, M.black(), 0, -0.175, 0.05, 0.02);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.22, 16, 1, true), lam(BRAND.navy, 0.5)); s.position.set(0, 0.05, 0.16); s.material.side = THREE.DoubleSide; g.add(s);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M.glow(color)); b.position.set(0, 0.0, 0.16); g.add(b);
  }

  // ----- Signalétique -----
  const signs = [];
  function makeSign(w, h, px = 300) {
    const c = mkCanvas(Math.round(px * w), Math.round(px * h)); const tex = canvasTex(c);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }));
    return { mesh, canvas: c, tex, draw(lines, opts) { drawTextCanvas(c, lines, opts); tex.needsUpdate = true; } };
  }
  const doors = {
    reunion: [-1.92, 2.62, -6.5, Math.PI / 2],
    prospection: [-1.92, 2.62, -20.5, Math.PI / 2],
    dressing: [1.92, 2.62, -5, -Math.PI / 2],
    amphi: [1.92, 3.25, -19, -Math.PI / 2],
  };
  for (const [k, [x, y, z, ry]] of Object.entries(doors)) {
    const s = makeSign(2.2, 0.55); s.mesh.position.set(x, y, z); s.mesh.rotation.y = ry; W.add(s.mesh); doorSigns[k] = s;
  }
  function updateDoorSigns(counts) {
    for (const [k, s] of Object.entries(doorSigns)) {
      const n = counts[k] || 0, key = k + n; if (s._k === key) continue; s._k = key;
      s.draw([{ text: ROOMS[k].short, size: 52, weight: 800, color: BRAND.navy, y: 0.38 }, { text: n ? `● ${n} présent${n > 1 ? 's' : ''}` : '○ libre', size: 38, weight: 600, color: n ? BRAND.rose : '#8C93C4', y: 0.74 }], { bg: '#ffffff', accent: ROOMS[k].color, align: 'left' });
    }
  }
  const corrSign = makeSign(3.8, 0.45); corrSign.mesh.position.set(0, 2.75, 0.14); W.add(corrSign.mesh);
  const drawCorr = () => corrSign.draw([{ text: 'Réunion · Prospection · Dressing · Amphi  ↑', size: 54, weight: 600, color: '#fff' }], { bg: BRAND.navy });
  drawCorr(); redrawers.push(drawCorr);

  // ----- Télés -----
  function idleTv(c, title, sub) {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, BRAND.navy); gr.addColorStop(1, '#1A1E55');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(214,0,108,.18)'; g.beginPath(); g.arc(w * 0.85, h * 0.15, h * 0.6, 0, 7); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.font = `800 ${h * 0.11}px ${FONT_TITLE}`; g.fillText(title, w / 2, h * 0.42);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `500 ${h * 0.065}px ${FONT_TEXT}`; g.fillText(sub, w / 2, h * 0.58);
    g.fillStyle = BRAND.rose; g.fillRect(w / 2 - h * 0.12, h * 0.68, h * 0.24, h * 0.012);
  }
  function makeTV(id, zone, x, y, z, ry, w, h, title = 'Écran disponible', sub = 'Approche-toi pour partager ton écran') {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; W.add(g);
    const fr = new THREE.Mesh(rbox(w + 0.12, h + 0.12, 0.08, 0.02), lam('#15172A', 0.3, 0.5)); fr.castShadow = true; g.add(fr);
    const idleCanvas = mkCanvas(1280, Math.round(1280 * h / w));
    const idleTex = canvasTex(idleCanvas);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: idleTex, toneMapped: false })); screen.position.z = 0.045; screen.userData.keep = true; g.add(screen);
    const redraw = () => { idleTv(idleCanvas, title, sub); idleTex.needsUpdate = true; };
    const tv = {
      id, zone, w, h, group: g, screen, idleTex, idleCanvas, video: null, sharer: null, custom: null,
      pos: new THREE.Vector3(x, 0, z),
      setStream(stream, sharer) {
        this.clear();
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; v.srcObject = stream; v.play().catch(() => {});
        const vt = new THREE.VideoTexture(v); vt.colorSpace = THREE.SRGBColorSpace;
        screen.material.map = vt; screen.material.needsUpdate = true; this.video = v; this.sharer = sharer;
      },
      clear() {
        if (this.video) { this.video.srcObject = null; this.video = null; }
        if (screen.material.map !== idleTex) { screen.material.map.dispose?.(); screen.material.map = idleTex; screen.material.needsUpdate = true; }
        this.sharer = null;
      },
      redrawIdle(fn) { this.custom = fn; fn(idleCanvas); idleTex.needsUpdate = true; },
    };
    redrawers.push(() => (tv.custom ? tv.redrawIdle(tv.custom) : redraw()));
    redraw(); tvs[id] = tv; return tv;
  }

  // ----- Mobilier -----
  function sofa(x, z, ry, fabric, cushionCols, group, zone) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; W.add(g);
    const L = 2.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.03, 0.03, 0.12, M.oak(), sx * (L / 2 - 0.15), 0, sz * 0.33, 8);
    box(g, L, 0.3, 0.92, fabric, 0, 0.12, 0, 0.08);
    for (const o of [-0.78, 0, 0.78]) box(g, 0.76, 0.14, 0.66, fabric, o, 0.42, 0.1, 0.06);
    box(g, L, 0.48, 0.24, fabric, 0, 0.42, -0.34, 0.09);
    box(g, 0.2, 0.28, 0.92, fabric, -L / 2 + 0.1, 0.42, 0, 0.08); box(g, 0.2, 0.28, 0.92, fabric, L / 2 - 0.1, 0.42, 0, 0.08);
    cushionCols.forEach((c, i) => { const cu = box(g, 0.42, 0.38, 0.13, lam(c, 0.95), (i - (cushionCols.length - 1) / 2) * 1.1, 0.52, -0.16, 0.06); cu.rotation.z = (i % 2 ? 0.12 : -0.1); });
    for (const o of [-0.78, 0, 0.78]) {
      const [dx, dz] = rotXZ(o, 0.12, ry);
      seats.push({ id: `${group}-${seats.length}`, x: x + dx, z: z + dz, y: 0.45, ry, group, zone, kind: 'sofa' });
    }
    const sw = Math.abs(Math.cos(ry)) > 0.5 ? [L / 2, 0.46] : [0.46, L / 2];
    addCol(x - sw[0], x + sw[0], z - sw[1], z + sw[1]);
  }
  function armchair(x, z, ry, fabric, group, zone) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; W.add(g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.025, 0.02, 0.18, M.oak(), sx * 0.3, 0, sz * 0.28, 8);
    box(g, 0.8, 0.26, 0.78, fabric, 0, 0.18, 0, 0.1);
    box(g, 0.8, 0.5, 0.18, fabric, 0, 0.38, -0.3, 0.08);
    box(g, 0.14, 0.24, 0.7, fabric, -0.33, 0.4, 0, 0.06); box(g, 0.14, 0.24, 0.7, fabric, 0.33, 0.4, 0, 0.06);
    const [dx, dz] = rotXZ(0, 0.08, ry);
    seats.push({ id: `${group}-${seats.length}`, x: x + dx, z: z + dz, y: 0.45, ry, group, zone, kind: 'sofa' });
    addCol(x - 0.38, x + 0.38, z - 0.38, z + 0.38);
  }
  function chair(x, z, ry, seatCol, group, zone, kind = 'chair', y0 = 0, style = 'shell') {
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry; W.add(g);
    if (style === 'theatre') {
      box(g, 0.06, 0.42, 0.45, M.black(), -0.29, 0, 0, 0.02); box(g, 0.06, 0.42, 0.45, M.black(), 0.29, 0, 0, 0.02);
      box(g, 0.52, 0.1, 0.48, lam(seatCol, 0.9), 0, 0.38, 0.02, 0.04);
      box(g, 0.52, 0.62, 0.1, lam(seatCol, 0.9), 0, 0.42, -0.22, 0.05);
      box(g, 0.08, 0.06, 0.45, M.black(), -0.31, 0.62, 0, 0.02); box(g, 0.08, 0.06, 0.45, M.black(), 0.31, 0.62, 0, 0.02);
    } else if (style === 'stool') {
      cyl(g, 0.02, 0.025, 0.7, M.black(), 0, 0, 0, 8);
      cyl(g, 0.2, 0.2, 0.02, M.black(), 0, 0, 0, 16);
      cyl(g, 0.21, 0.19, 0.08, lam(seatCol, 0.8), 0, 0.7, 0, 18);
    } else if (style === 'office') {
      cyl(g, 0.28, 0.28, 0.03, M.black(), 0, 0.02, 0, 5);
      cyl(g, 0.03, 0.03, 0.35, M.steel(), 0, 0.05, 0, 8);
      box(g, 0.54, 0.09, 0.52, lam(seatCol, 0.85), 0, 0.38, 0, 0.04);
      box(g, 0.5, 0.62, 0.08, lam(seatCol, 0.85), 0, 0.47, -0.24, 0.04);
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = cyl(g, 0.018, 0.018, 0.4, M.oak(), sx * 0.19, 0, sz * 0.19, 6); l.rotation.z = sx * 0.06; }
      box(g, 0.5, 0.06, 0.48, M.white(), 0, 0.38, 0, 0.03);
      box(g, 0.44, 0.04, 0.42, lam(seatCol, 0.9), 0, 0.44, 0.01, 0.02);
      box(g, 0.5, 0.42, 0.06, M.white(), 0, 0.44, -0.23, 0.03);
    }
    const [dx, dz] = rotXZ(0, 0.05, ry);
    const s = { id: `${group}-${seats.length}`, x: x + dx, z: z + dz, y: y0 + (style === 'stool' ? 0.78 : 0.45), ry, group, zone, kind };
    seats.push(s); return s;
  }
  function table(x, z, w, d, h, topMat = M.oak(), legMat = M.black(), col = true) {
    box(W, w, 0.06, d, topMat, x, h - 0.06, z, 0.025);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(W, 0.06, h - 0.06, 0.06, legMat, x + sx * (w / 2 - 0.15), 0, z + sz * (d / 2 - 0.15), 0.01);
    if (col) addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }
  function roundTable(x, z, r, h, top = M.oak()) {
    cyl(W, r, r, 0.05, top, x, h - 0.05, z, 28); cyl(W, 0.05, 0.05, h - 0.05, M.black(), x, 0, z, 10); cyl(W, r * 0.5, r * 0.55, 0.03, M.black(), x, 0, z, 20);
    addCol(x - r * 0.8, x + r * 0.8, z - r * 0.8, z + r * 0.8);
  }
  const leafCols = ['#2E7D4F', '#3C9A5F', '#4FB06D', '#256B43'];
  function plant(x, z, s = 1, type = 'bush', potCol = '#F4F3F7') {
    cyl(W, 0.26 * s, 0.2 * s, 0.5 * s, lam(potCol, 0.5), x, 0, z, 18);
    cyl(W, 0.24 * s, 0.24 * s, 0.02, lam('#5A3B22', 1), x, 0.48 * s, z, 18);
    if (type === 'tall') {
      cyl(W, 0.025 * s, 0.035 * s, 1.1 * s, lam('#6B4A2E', 0.9), x, 0.5 * s, z, 6);
      for (let i = 0; i < 9; i++) {
        const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 * s + rnd() * 0.08 * s, 0), lam(leafCols[i % 4], 0.8));
        lf.position.set(x + (rnd() - 0.5) * 0.5 * s, (0.9 + rnd() * 0.9) * s, z + (rnd() - 0.5) * 0.5 * s); lf.scale.set(1, 0.55, 1.4); lf.rotation.set(rnd(), rnd() * 3, rnd());
        lf.castShadow = true; W.add(lf);
      }
    } else if (type === 'snake') {
      for (let i = 0; i < 9; i++) {
        const lf = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, (0.6 + rnd() * 0.5) * s, 4), lam(leafCols[i % 4], 0.7));
        lf.position.set(x + (rnd() - 0.5) * 0.25 * s, 0.75 * s, z + (rnd() - 0.5) * 0.25 * s); lf.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4); lf.castShadow = true; W.add(lf);
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const lf = new THREE.Mesh(new THREE.IcosahedronGeometry((0.2 + rnd() * 0.12) * s, 0), lam(leafCols[i % 4], 0.8));
        lf.position.set(x + (rnd() - 0.5) * 0.4 * s, (0.65 + rnd() * 0.35) * s, z + (rnd() - 0.5) * 0.4 * s); lf.castShadow = true; W.add(lf);
      }
    }
    addCol(x - 0.26 * s, x + 0.26 * s, z - 0.26 * s, z + 0.26 * s);
  }
  function rug(x, z, w, d, draw, round = false) {
    const c = mkCanvas(512, Math.round(512 * d / w)); draw(c.getContext('2d'), c.width, c.height);
    const tex = canvasTex(c);
    const geo = round ? new THREE.CircleGeometry(w / 2, 48) : new THREE.PlaneGeometry(w, d);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, transparent: round }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.008, z); m.receiveShadow = true; W.add(m); return m;
  }
  function floorLamp(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; W.add(g);
    cyl(g, 0.18, 0.2, 0.04, M.black(), 0, 0, 0, 18);
    cyl(g, 0.02, 0.02, 1.7, M.black(), 0, 0.04, 0, 6);
    box(g, 1.1, 0.03, 0.03, M.black(), 0.55, 1.72, 0, 0.005);
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(BRAND.rose, 0.4)); shade.position.set(1.08, 1.5, 0); shade.material.side = THREE.DoubleSide; shade.castShadow = true; g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.glow('#FFE9C8')); bulb.position.set(1.08, 1.5, 0); g.add(bulb);
    addCol(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
  }
  // Lumières ponctuelles désactivées (coût GPU) : l'ambiance vient du soleil, de l'environnement et des luminaires émissifs.
  function light() {}
  function books(parent, x0, y, z, w, ry = 0) {
    let x = x0; const cols = [BRAND.navy, BRAND.rose, BRAND.blue, '#F4F3F7', '#2B2F4A', '#E6CFAE'];
    while (x < x0 + w - 0.06) { const bw = 0.04 + rnd() * 0.05, bh = 0.22 + rnd() * 0.12; box(parent, bw, bh, 0.2, lam(cols[Math.floor(rnd() * cols.length)], 0.8), x + bw / 2, y, z, 0.005); x += bw + 0.005; }
  }

  // ===================== ACCUEIL =====================
  // Mur nord gauche : peinture navy + logo
  paint(-8, 1.5, 0.13, 0, 12, 3, BRAND.navy);
  canvasPlane(-8, 1.85, 0.14, 0, 6.4, 1.8, 220, (g, w, h) => wordmark(g, w, h, { sub: 'Leader du recrutement prédictif' }));
  wallLight(-12.2, 2.3, 0.13, 0, '#FFD9EC'); wallLight(-3.8, 2.3, 0.13, 0, '#FFD9EC');
  // Mur nord droit : cartes chiffres comme sur le site
  frame(5.2, 1.75, 0.16, 0, 1.6, 2.05, statCard('62%', 'de temps gagné', 'Méthode prédictive : on recrute plus vite, et mieux.', BRAND.rose, '#8C1C8F'));
  frame(8, 1.75, 0.16, 0, 1.6, 2.05, statCard('-50%', 'de turnover', 'Des recrues alignées avec votre culture et vos équipes.', BRAND.purple, BRAND.navy));
  frame(10.8, 1.75, 0.16, 0, 1.6, 2.05, statCard('20%', 'moins cher', 'Un recrutement réussi du premier coup.', BRAND.rose, BRAND.purple));
  box(W, 6.5, 0.7, 0.45, M.white(), 8, 0, 0.42, 0.04); box(W, 6.6, 0.04, 0.5, M.oak(), 8, 0.7, 0.42, 0.015); addCol(4.7, 11.3, 0.15, 0.7);
  plant(5.6, 0.45, 0.6, 'snake', BRAND.navy); plant(10.4, 0.45, 0.6, 'snake', BRAND.rose);

  // Salon TV (ouest)
  rug(-9.6, 8, 7.2, 7.2, (g, w, h) => {
    g.fillStyle = BRAND.blue; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 22, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(46,52,132,.5)'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 40, 0, 7); g.stroke();
    noise(g, w, h, 14);
  }, true);
  paint(-13.87, 1.5, 8, Math.PI / 2, 7, 3, '#E9E7F1');
  makeTV('tv-accueil', 'accueil', -13.82, 1.75, 8, Math.PI / 2, 4.4, 2.48);
  box(W, 0.5, 0.5, 5, M.white(), -13.55, 0, 8, 0.04); box(W, 0.52, 0.04, 5.1, M.oak(), -13.55, 0.5, 8, 0.015); addCol(-13.85, -13.25, 5.5, 10.5);
  sofa(-6.5, 8, -Math.PI / 2, M.navyFab(), [BRAND.rose, BRAND.blue], 'canape-accueil', 'accueil');
  sofa(-9.6, 11.7, Math.PI, M.navyFab(), [BRAND.rose], 'canape-accueil', 'accueil');
  sofa(-9.6, 4.3, 0, M.navyFab(), [BRAND.blue], 'canape-accueil', 'accueil');
  roundTable(-9.6, 8, 0.75, 0.4);
  cyl(W, 0.09, 0.07, 0.18, lam(BRAND.rose, 0.3), -9.4, 0.4, 7.8, 12); cyl(W, 0.14, 0.14, 0.03, M.oakLight(), -9.85, 0.4, 8.2, 16);
  floorLamp(-6.3, 11.3, Math.PI * 0.75);
  plant(-13.1, 14.9, 1.3, 'tall'); plant(-13.1, 1.1, 1.1, 'bush', BRAND.navy);
  light(-9.6, 2.7, 8, '#FFE4C4', 10, 10);

  // Accueil / réception
  rug(5.5, 12.5, 4.5, 3, (g, w, h) => { g.fillStyle = '#ECEAF3'; g.fillRect(0, 0, w, h); g.fillStyle = BRAND.rose; g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, w, 14); noise(g, w, h, 10); });
  const desk = new THREE.Group(); desk.position.set(6.5, 0, 9.6); W.add(desk);
  box(desk, 4.4, 1.0, 0.9, M.white(), 0, 0, 0, 0.06);
  box(desk, 4.5, 0.05, 1.05, M.oak(), 0, 1.0, 0.04, 0.02);
  box(desk, 4.3, 0.04, 0.02, M.glow(BRAND.rose), 0, 0.1, 0.46, 0);
  const deskSign = canvasPlane(6.5, 0.6, 10.07, 0, 2.2, 0.45, 260, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${h * 0.62}px ${FONT_TITLE}`; const a = 'Work', b = '&', c = 'You'; const wa = g.measureText(a).width, wb = g.measureText(b).width, wc = g.measureText(c).width;
    let x = w / 2 - (wa + wb + wc) / 2; g.textAlign = 'left';
    g.fillStyle = BRAND.navy; g.fillText(a, x, h / 2); x += wa; g.fillStyle = BRAND.rose; g.fillText(b, x, h / 2); x += wb; g.fillStyle = BRAND.navy; g.fillText(c, x, h / 2);
  });
  box(W, 0.55, 0.36, 0.04, lam('#15172A', 0.3, 0.5), 5.4, 1.05, 9.35, 0.01);
  chair(6.5, 8.75, 0, BRAND.navy, 'reception', 'accueil', 'chair', 0, 'office');
  addCol(4.3, 8.7, 9.15, 10.05);
  light(6.5, 2.8, 10.5, '#FFF1DE', 6, 8);
  // Attente
  armchair(11.4, 13.6, -Math.PI * 0.75, M.roseFab(), 'attente', 'accueil');
  armchair(12.6, 11.9, -Math.PI * 0.6, M.roseFab(), 'attente', 'accueil');
  roundTable(12.5, 13.3, 0.35, 0.45, M.white());
  plant(13.2, 15.1, 1.2, 'tall', BRAND.navy);
  // Coin café (est)
  paint(13.87, 1.5, 3.4, -Math.PI / 2, 4.2, 3, BRAND.rose);
  canvasPlane(13.86, 2.45, 3.4, -Math.PI / 2, 2.6, 0.5, 260, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${h * 0.6}px ${FONT_TITLE}`; g.fillText('Le Café', w / 2, h / 2); });
  box(W, 0.7, 0.92, 3.4, M.white(), 13.45, 0, 3.4, 0.04); box(W, 0.75, 0.05, 3.5, M.oak(), 13.45, 0.92, 3.4, 0.02); addCol(13.05, 13.9, 1.6, 5.2);
  box(W, 0.35, 0.45, 0.32, M.black(), 13.55, 0.97, 2.4, 0.04); box(W, 0.1, 0.05, 0.1, M.glow('#7CFFB2'), 13.36, 1.25, 2.4, 0);
  for (const zz of [3.3, 3.55, 3.8]) cyl(W, 0.04, 0.035, 0.09, lam(BRAND.rose, 0.4), 13.5, 0.97, zz, 10);
  plant(13.5, 4.85, 0.45, 'bush', BRAND.navy);
  for (const zz of [2.4, 3.4, 4.4]) chair(12.55, zz, Math.PI / 2, BRAND.rose, 'cafe', 'accueil', 'chair', 0, 'stool');
  roundTable(9.2, 4.6, 0.55, 1.05, M.white());
  for (const [dx, dz, ry] of [[0, -0.95, 0], [0, 0.95, Math.PI], [-0.95, 0, Math.PI / 2], [0.95, 0, -Math.PI / 2]]) chair(9.2 + dx, 4.6 + dz, ry, BRAND.navy, 'table-haute', 'accueil', 'chair', 0, 'stool');
  light(11, 2.6, 3.6, '#FFE1C2', 6, 7);
  // Entrée (sud)
  box(W, 3.2, 2.5, 0.08, lam('#2B2F4A', 0.35, 0.6), 0, 0, 15.95, 0.01);
  box(W, 3.0, 2.3, 0.04, new THREE.MeshPhysicalMaterial({ color: 0xdfe8ff, transmission: 0.6, roughness: 0.2, thickness: 0.1 }), 0, 0.02, 15.9, 0.005);
  rug(0, 15, 2.6, 1.2, (g, w, h) => { g.fillStyle = '#3A3E5C'; g.fillRect(0, 0, w, h); noise(g, w, h, 20); g.fillStyle = '#fff'; g.font = `700 ${h * 0.32}px ${FONT_TITLE}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Bienvenue', w / 2, h / 2); });
  plant(-2.4, 15.2, 1.1, 'tall'); plant(2.4, 15.2, 1.1, 'tall');
  plant(-2.9, 0.75, 0.9, 'bush'); plant(2.9, 0.75, 0.9, 'bush');

  // ===================== COULOIR =====================
  rug(0, -14, 2.4, 26.5, (g, w, h) => {
    g.fillStyle = '#2E3484'; g.fillRect(0, 0, w, h); noise(g, w, h, 16);
    g.fillStyle = BRAND.blue; g.fillRect(18, 0, 10, h); g.fillRect(w - 28, 0, 10, h);
    g.fillStyle = BRAND.rose; g.fillRect(34, 0, 4, h); g.fillRect(w - 38, 0, 4, h);
  });
  paint(0, 1.5, -27.87, 0, 4, 3, BRAND.navy);
  canvasPlane(0, 1.75, -27.86, 0, 3.4, 1.7, 240, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.font = `800 ${h * 0.17}px ${FONT_TITLE}`; g.fillText('Leader du', w / 2, h * 0.28); g.fillText('recrutement', w / 2, h * 0.47);
    g.fillStyle = BRAND.rose; g.fillText('prédictif', w / 2, h * 0.66);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `500 ${h * 0.07}px ${FONT_TEXT}`; g.fillText('Vous ne cherchez pas juste quelqu\'un.', w / 2, h * 0.84);
  });
  plant(-1.45, -27.35, 0.7, 'snake', BRAND.rose); plant(1.45, -27.35, 0.7, 'snake', BRAND.rose);
  light(0, 2.6, -8, '#FFF0DC', 4, 9); light(0, 2.6, -21, '#FFF0DC', 4, 9);

  // ===================== RÉUNION =====================
  rug(-8.3, -6.5, 7.8, 4.6, (g, w, h) => { g.fillStyle = BRAND.navy; g.fillRect(0, 0, w, h); noise(g, w, h, 14); g.strokeStyle = BRAND.blue; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); });
  table(-8.4, -6.5, 5.2, 2.1, 0.76, M.oakLight(), M.black());
  box(W, 0.6, 0.05, 0.25, M.black(), -8.4, 0.76, -6.5, 0.01);
  for (const cx of [-10.2, -8.4, -6.6]) { chair(cx, -8.15, 0, BRAND.blue, 'reunion', 'reunion'); chair(cx, -4.85, Math.PI, BRAND.blue, 'reunion', 'reunion'); }
  chair(-11.75, -6.5, Math.PI / 2, BRAND.rose, 'reunion', 'reunion'); chair(-5.05, -6.5, -Math.PI / 2, BRAND.rose, 'reunion', 'reunion');
  makeTV('tv-reunion', 'reunion', -13.82, 1.65, -6.5, Math.PI / 2, 3.9, 2.2);
  feltPanels(-13.84, 1.7, -2.9, Math.PI / 2, 3, 4, [BRAND.rose, BRAND.navy, BRAND.blue, '#C9CDE8']);
  feltPanels(-13.84, 1.7, -10.1, Math.PI / 2, 3, 4, [BRAND.rose, BRAND.navy, BRAND.blue, '#C9CDE8']);
  // Tableau post-it
  const boardCanvas = mkCanvas(1600, 590); const boardTex = canvasTex(boardCanvas);
  const boardFrame = new THREE.Mesh(rbox(6.2, 2.4, 0.06, 0.02), M.steel()); boardFrame.position.set(-8, 1.6, -12.84); boardFrame.castShadow = true; W.add(boardFrame);
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.21), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false })); boardMesh.position.set(-8, 1.6, -12.8); W.add(boardMesh);
  box(W, 6.2, 0.04, 0.12, M.steel(), -8, 0.47, -12.75, 0.01);
  const board = { pos: new THREE.Vector3(-8, 0, -11.8), zone: 'reunion', canvas: boardCanvas, tex: boardTex };
  box(W, 3.2, 0.75, 0.45, M.white(), -8, 0, -0.42, 0.04); box(W, 3.3, 0.04, 0.5, M.oak(), -8, 0.75, -0.42, 0.015); addCol(-9.6, -6.4, -0.7, -0.15);
  books(W, -9.4, 0.79, -0.42, 1.2);
  plant(-13.1, -0.9, 1.1, 'tall'); plant(-13.1, -12.1, 0.9, 'bush', BRAND.rose); plant(-2.9, -12.1, 0.8, 'snake', BRAND.navy);
  light(-8.4, 2.8, -6.5, '#FFF3E2', 9, 9);

  // ===================== PROSPECTION =====================
  paint(-8, 1.5, -27.87, 0, 12, 3, BRAND.rose);
  const onAir = makeSign(3, 0.75); onAir.mesh.position.set(-8, 2.25, -27.85); W.add(onAir.mesh);
  function setOnAir(name) {
    const key = name || ''; if (onAir._k === key) return; onAir._k = key;
    onAir.draw(name
      ? [{ text: '● EN APPEL', color: BRAND.rose, size: 70, weight: 800, y: 0.36 }, { text: name, size: 52, weight: 600, color: BRAND.navy, y: 0.74 }]
      : [{ text: 'Poste d\'appel', color: BRAND.navy, size: 62, weight: 800, y: 0.38 }, { text: 'Assieds-toi pour appeler', size: 44, weight: 500, color: '#8C93C4', y: 0.74 }],
      { bg: '#ffffff', accent: name ? BRAND.rose : BRAND.navy, align: 'left' });
  }
  setOnAir(null); redrawers.push(() => { const k = onAir._k; onAir._k = '__'; setOnAir(k || null); });
  const pd = new THREE.Group(); pd.position.set(-8, 0, -25.4); W.add(pd);
  box(pd, 2.8, 0.74, 0.95, M.white(), 0, 0, 0, 0.04); box(pd, 2.9, 0.05, 1.05, M.oak(), 0, 0.74, 0, 0.02);
  box(pd, 0.9, 0.52, 0.04, lam('#15172A', 0.3, 0.5), 0.5, 0.95, -0.2, 0.01); box(pd, 0.08, 0.2, 0.08, M.black(), 0.5, 0.79, -0.22, 0.01);
  box(pd, 0.84, 0.46, 0.01, M.glow('#3E58C9'), 0.5, 0.98, -0.175, 0);
  box(pd, 0.18, 0.04, 0.32, M.black(), -0.7, 0.79, 0.05, 0.01); box(pd, 0.5, 0.02, 0.18, lam('#ECEDF2', 0.6), -0.1, 0.79, 0.2, 0.005);
  addCol(-9.45, -6.55, -25.95, -24.85);
  const callSeat = chair(-8, -26.45, 0, BRAND.rose, 'poste-appel', 'prospection', 'callDesk', 0, 'office');
  rug(-8, -19.6, 9.5, 4.6, (g, w, h) => { g.fillStyle = '#EEF0FB'; g.fillRect(0, 0, w, h); noise(g, w, h, 10); g.fillStyle = BRAND.rose; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); });
  for (const [row, zz] of [[0, -20.9], [1, -18.6]]) for (let i = 0; i < 5; i++) chair(-11.6 + i * 1.8 + row * 0.9 - 0.45, zz, Math.PI, row ? BRAND.blue : BRAND.navy, 'prospection', 'prospection', 'chair', 0, 'office');
  makeTV('tv-prospection', 'prospection', -13.82, 1.65, -18.5, Math.PI / 2, 3.6, 2.05, 'Écran prospection', 'Partage la fiche client ou ton script');
  plant(-2.9, -27.2, 1.0, 'tall'); plant(-13.1, -27.2, 1.0, 'tall'); plant(-13.1, -14.0, 0.8, 'snake', BRAND.navy);
  light(-8, 2.6, -24.5, '#FFE7EF', 9, 8); light(-8, 2.8, -19.5, '#FFF3E2', 6, 9);

  // ===================== DRESSING =====================
  rug(7.6, -5, 3.6, 3.6, (g, w, h) => { g.fillStyle = BRAND.rose; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 26, 0, 7); g.stroke(); noise(g, w, h, 14); }, true);
  cyl(W, 1.05, 1.1, 0.14, M.white(), 7.6, 0, -5, 40); cyl(W, 1.06, 1.06, 0.02, M.glow(BRAND.rose), 7.6, 0.13, -5, 40);
  const mirror = new THREE.Group(); mirror.position.set(11.84, 1.5, -5); mirror.rotation.y = -Math.PI / 2; W.add(mirror);
  const mf = new THREE.Mesh(rbox(1.7, 2.6, 0.08, 0.3), M.oak()); mf.castShadow = true; mirror.add(mf);
  const mirC = mkCanvas(256, 400); { const g = mirC.getContext('2d'); const gr = g.createLinearGradient(0, 0, 256, 400); gr.addColorStop(0, '#E9F0FF'); gr.addColorStop(1, '#B8C6EA'); g.fillStyle = gr; g.fillRect(0, 0, 256, 400); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(40, 40, 14, 120); g.fillRect(66, 40, 6, 60); }
  const mp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), new THREE.MeshStandardMaterial({ map: canvasTex(mirC), roughness: 0.05, metalness: 0.85 })); mp.position.z = 0.05; mirror.add(mp);
  const mled = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 2.48), M.glow('#FFD6EA')); mled.position.z = 0.042; mirror.add(mled);
  wallLight(11.86, 2.3, -6.4, -Math.PI / 2, '#FFE1EF'); wallLight(11.86, 2.3, -3.6, -Math.PI / 2, '#FFE1EF');
  // portants & étagères
  paint(7, 1.5, -9.86, 0, 9.5, 3, '#F3E6EE');
  const clothes = [BRAND.rose, BRAND.navy, BRAND.blue, '#F4F3F7', '#2B2F4A', '#E86AA8', '#F2C14E'];
  for (const [rx, w] of [[4.3, 3], [9.7, 3]]) {
    box(W, 0.04, 1.75, 0.04, M.black(), rx - w / 2, 0, -9.3, 0.01); box(W, 0.04, 1.75, 0.04, M.black(), rx + w / 2, 0, -9.3, 0.01);
    box(W, w, 0.03, 0.03, M.steel(), rx, 1.7, -9.3, 0.01);
    for (let x = rx - w / 2 + 0.2; x < rx + w / 2 - 0.1; x += 0.22) {
      const cl = box(W, 0.06, 0.85, 0.42, lam(clothes[Math.floor(rnd() * clothes.length)], 0.9), x, 0.85, -9.3, 0.03); cl.rotation.y = (rnd() - 0.5) * 0.15;
    }
  }
  const sh = new THREE.Group(); sh.position.set(7, 0, -9.55); W.add(sh);
  box(sh, 2, 2.3, 0.04, M.white(), 0, 0, -0.18, 0.01);
  for (const y of [0, 0.6, 1.2, 1.8]) box(sh, 2, 0.04, 0.4, M.oak(), 0, y, 0, 0.01);
  for (const y of [0.64, 1.24]) for (let i = 0; i < 4; i++) box(sh, 0.38, 0.16, 0.3, lam(clothes[(i + y * 10) % clothes.length | 0], 0.9), -0.72 + i * 0.48, y, 0.02, 0.04);
  for (let i = 0; i < 4; i++) { box(sh, 0.12, 0.1, 0.28, lam(i % 2 ? BRAND.rose : '#F4F3F7', 0.6), -0.75 + i * 0.5, 0.04, 0, 0.03); box(sh, 0.12, 0.1, 0.28, lam(i % 2 ? BRAND.rose : '#F4F3F7', 0.6), -0.6 + i * 0.5, 0.04, 0, 0.03); }
  addCol(2.6, 11.6, -9.9, -8.95);
  cyl(W, 0.42, 0.45, 0.42, M.roseFab(), 4.4, 0, -3.2, 24); cyl(W, 0.35, 0.38, 0.38, M.navyFab(), 5.3, 0, -1.6, 24);
  addCol(3.95, 4.85, -3.65, -2.75); addCol(4.95, 5.65, -1.95, -1.25);
  plant(11.2, -0.9, 1.0, 'tall', BRAND.rose); plant(2.9, -0.8, 0.8, 'bush');
  const dsign = canvasPlane(7, 2.6, -9.84, 0, 3, 0.5, 260, (g, w, h) => { g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = BRAND.navy; g.font = `800 ${h * 0.62}px ${FONT_TITLE}`; g.fillText('Dressing', w / 2, h / 2); });
  const dressing = { pos: new THREE.Vector3(7.6, 0, -5) };
  light(8.5, 2.6, -5, '#FFE6F1', 8, 8);

  // ===================== AMPHI =====================
  for (const r of AMPHI_ROWS) {
    if (r.h > 0) { box(W, 2, r.h, 18, lam('#20245A', 0.95), r.x, 0, -19, 0.02); }
    box(W, 0.04, 0.025, 18, M.glow(BRAND.blue), r.x + 1, r.h, -19, 0);
    for (let z = -26.6; z <= -11.4; z += 1.15) {
      if (Math.abs(z + 19) < 1.2) continue;
      chair(r.x + 0.25, z, Math.PI / 2, BRAND.rose, 'amphi', 'amphi', 'amphi', r.h, 'theatre');
    }
  }
  box(W, 4.9, 0.6, 18, lam(BRAND.navy, 0.8), 19.45, 0, -19, 0.03);
  box(W, 4.95, 0.05, 18.05, M.oak(), 19.45, 0.6, -19, 0.01);
  box(W, 0.03, 0.04, 18, M.glow(BRAND.rose), 17.0, 0.3, -19, 0);
  const lect = new THREE.Group(); lect.position.set(18.5, 0.65, -19); W.add(lect);
  box(lect, 0.6, 1.1, 0.5, M.white(), 0, 0, 0, 0.04); box(lect, 0.62, 0.05, 0.56, M.oak(), 0, 1.1, 0, 0.01); box(lect, 0.02, 0.5, 0.3, M.glow(BRAND.rose), -0.31, 0.3, 0, 0);
  addCol(18.2, 18.8, -19.25, -18.75);
  paint(21.87, 2.25, -19, -Math.PI / 2, 18, 4.5, '#1A1E55');
  const amphiTV = makeTV('tv-amphi', 'amphi', 21.82, 2.6, -19, -Math.PI / 2, 8.4, 3.8, 'Amphithéâtre', 'Agenda en chargement…');
  box(W, 0.02, 0.03, 8.6, M.glow(BRAND.blue), 21.75, 0.66, -19, 0);
  slats(9.5, 2.75, -27.86, 0, 13, 3.4);
  canvasPlane(9.5, 2.9, -27.74, 0, 6.5, 1.5, 200, (g, w, h) => wordmark(g, w, h, { bg: BRAND.navy, tagline: 'Leader du recrutement prédictif' }));
  wallLight(2.6, 3, -27.86, 0, '#E4E8FF');
  plant(21.2, -10.9, 1.1, 'tall'); plant(21.2, -27.1, 1.1, 'tall');
  light(19.5, 3.8, -19, '#E8ECFF', 14, 12); light(10, 3.6, -19, '#FFE8F2', 7, 12);

  // ----- Tableau post-it -----
  function drawBoard(notes) {
    const g = boardCanvas.getContext('2d'), W2 = boardCanvas.width, H2 = boardCanvas.height;
    g.fillStyle = '#FBFBFD'; g.fillRect(0, 0, W2, H2);
    g.fillStyle = BRAND.navy; g.font = `800 34px ${FONT_TITLE}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('Brainstorm', 32, 24);
    g.fillStyle = BRAND.rose; g.fillRect(32, 70, 70, 5);
    g.font = `500 24px ${FONT_TEXT}`; g.fillStyle = '#8C93C4'; g.fillText('E près du tableau pour ajouter un post-it', 260, 32);
    const cols = 6, w = 240, h = 150, gap = 18;
    notes.slice(-12).forEach((n, i) => {
      const x = 32 + (i % cols) * (w + gap), y = 100 + Math.floor(i / cols) * (h + gap);
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(((i * 37) % 7 - 3) * 0.006); g.translate(-w / 2, -h / 2);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(5, 6, w, h);
      g.fillStyle = n.color || '#ffe066'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d2050'; g.font = `600 26px ${FONT_TEXT}`;
      wrapText(g, n.text, 14, 14, w - 28, 30, 3);
      g.fillStyle = 'rgba(29,32,80,.6)'; g.font = `500 19px ${FONT_TEXT}`; g.fillText('— ' + (n.author || '').slice(0, 18), 14, h - 30);
      g.restore();
    });
    boardTex.needsUpdate = true;
  }
  drawBoard([]);

  // Fusion des objets statiques par matériau : quelques dizaines d'appels de dessin au lieu de milliers
  function mergeStatic() {
    W.updateMatrixWorld(true);
    const groups = new Map(), victims = [];
    W.traverse((o) => {
      if (!o.isMesh || o.userData.wall || o.userData.keep) return;
      const k = o.material.uuid + '|' + o.castShadow + '|' + o.receiveShadow;
      if (!groups.has(k)) groups.set(k, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const n of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(n)) geo.deleteAttribute(n);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      geo.applyMatrix4(o.matrixWorld);
      groups.get(k).geos.push(geo); victims.push(o);
    });
    for (const o of victims) o.parent.remove(o);
    for (const gr of groups.values()) {
      const merged = mergeGeometries(gr.geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, gr.mat); mesh.castShadow = gr.cast; mesh.receiveShadow = gr.recv; mesh.matrixAutoUpdate = false; W.add(mesh);
      for (const g of gr.geos) g.dispose();
    }
  }
  mergeStatic();

  function redrawSigns() { for (const r of redrawers) r(); for (const s of Object.values(doorSigns)) s._k = null; }

  return { group: W, glassMat, glassClear, colliders, seats, tvs, board, drawBoard, fadeables, updateDoorSigns, setOnAir, amphiTV, dressing, callSeat, redrawSigns, lights };
}

// Collision cercle / AABB
export function collide(p, r, colliders) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else {
          const pens = [[p.x - c.minX + r, -1, 0], [c.maxX - p.x + r, 1, 0], [p.z - c.minZ + r, 0, -1], [c.maxZ - p.z + r, 0, 1]].sort((a, b) => a[0] - b[0]);
          p.x += pens[0][1] * pens[0][0]; p.z += pens[0][2] * pens[0][0];
        }
      }
    }
  }
}
