// Construction du monde : pièces, murs (pleins + vitrés dépolis), mobilier, sièges, télés, panneaux.
import * as THREE from 'three';

export const ROOMS = {
  reunion:     { x0: -14, x1: -2, z0: -13, z1: 0,   label: 'Réunion · Brainstorm',    short: 'RÉUNION',     color: '#5b8def' },
  prospection: { x0: -14, x1: -2, z0: -28, z1: -13, label: 'Prospection commerciale', short: 'PROSPECTION', color: '#2bb3a3' },
  dressing:    { x0: 2,   x1: 12, z0: -10, z1: 0,   label: 'Dressing',                short: 'DRESSING',    color: '#e872b0' },
  amphi:       { x0: 2,   x1: 22, z0: -28, z1: -10, label: 'Amphithéâtre',            short: 'AMPHI',       color: '#ff8a3d' },
  couloir:     { x0: -2,  x1: 2,  z0: -28, z1: 0,   label: 'Couloir',                 short: 'COULOIR',     color: '#9aa4b8' },
  accueil:     { x0: -14, x1: 14, z0: 0,   z1: 16,  label: 'Accueil',                 short: 'ACCUEIL',     color: '#f2c14e' },
};
const ORDER = ['reunion', 'prospection', 'dressing', 'amphi', 'couloir', 'accueil'];
export const ENCLOSED = new Set(['reunion', 'prospection', 'dressing', 'amphi']);

export function zoneAt(x, z) {
  for (const k of ORDER) {
    const r = ROOMS[k];
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return k;
  }
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

// ---------- helpers ----------
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export const FONT_TITLE = '"Press Start 2P", monospace';
export const FONT_TEXT = '"VT323", monospace';

function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = repeat ? THREE.NearestMipmapLinearFilter : THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function patternTex(kind, a, b, rep) {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, s, s);
  if (kind === 'planks') {
    for (let y = 0; y < s; y += 8) {
      g.fillStyle = b; g.fillRect(0, y, s, 1);
      const off = Math.floor(rnd() * s); g.fillRect(off, y, 1, 8); g.fillRect((off + 32) % s, y, 1, 8);
    }
    for (let i = 0; i < 90; i++) { g.fillStyle = rnd() > .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'; g.fillRect(rnd() * s | 0, rnd() * s | 0, 2, 1); }
  } else if (kind === 'tiles') {
    g.fillStyle = b; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
    g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 0, s, 1); g.fillRect(0, 32, s, 1); g.fillRect(0, 0, 1, s); g.fillRect(32, 0, 1, s);
  } else if (kind === 'carpet') {
    for (let i = 0; i < 700; i++) { g.fillStyle = rnd() > .5 ? b : 'rgba(255,255,255,.07)'; g.fillRect(rnd() * s | 0, rnd() * s | 0, 1, 1); }
  } else if (kind === 'grid') {
    g.fillStyle = b; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
  }
  return canvasTex(c, rep);
}

const matCache = new Map();
export function lam(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return matCache.get(color);
}
function box(parent, w, h, d, color, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || lam(color));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}
function rotXZ(lx, lz, ry) { return [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)]; }

export function drawTextCanvas(c, lines, { bg = '#14182e', fg = '#ffffff', border = null, font = FONT_TITLE, align = 'center' } = {}) {
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  if (border) { g.strokeStyle = border; g.lineWidth = Math.max(4, c.height * 0.06); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, c.width - g.lineWidth, c.height - g.lineWidth); }
  g.fillStyle = fg; g.textAlign = align; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((ln, i) => {
    const size = ln.size || Math.floor(c.height / (n + 1.2) * 0.55);
    g.font = `${size}px ${ln.font || font}`;
    g.fillStyle = ln.color || fg;
    const x = align === 'center' ? c.width / 2 : 24;
    g.fillText(ln.text, x, c.height * (i + 1) / (n + 1));
  });
}

// ---------- monde ----------
export function buildWorld(scene) {
  const W = new THREE.Group(); scene.add(W);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const seats = [];     // {id,x,z,y,ry,group,zone,kind}
  const tvs = {};       // id -> tv
  const fadeables = []; // meshes pouvant s'estomper
  const doorSigns = {};
  const addCol = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ });

  // Sol extérieur
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ map: patternTex('grid', '#20263d', '#283050', [60, 60]) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; W.add(ground);

  // Sols des pièces
  const floors = {
    accueil: ['planks', '#b98552', '#8a5c34'],
    couloir: ['carpet', '#33406b', 'rgba(0,0,0,.18)'],
    reunion: ['tiles', '#d9dde6', '#c9ced9'],
    prospection: ['carpet', '#2f8f7f', 'rgba(0,0,0,.15)'],
    dressing: ['tiles', '#f3d9e6', '#e9c6d8'],
    amphi: ['carpet', '#7a2e3a', 'rgba(0,0,0,.2)'],
  };
  for (const [k, [kind, a, b]] of Object.entries(floors)) {
    const r = ROOMS[k], w = r.x1 - r.x0, d = r.z1 - r.z0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: patternTex(kind, a, b, [w / 2, d / 2]) }));
    m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, 0.001, (r.z0 + r.z1) / 2); W.add(m);
  }

  // ----- Murs -----
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xe6f1ff, metalness: 0, roughness: 0.62, transmission: 1, thickness: 0.15, ior: 1.2 });
  const frameCol = '#3a3f55';
  const WALLS = [
    { a: [-14, 16], b: [14, 16], t: 's' },
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
        const m1 = new THREE.MeshLambertMaterial({ color: '#efe4d0', flatShading: true, transparent: true });
        const m2 = new THREE.MeshLambertMaterial({ color: '#b5a68c', flatShading: true, transparent: true });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.25), m1); wall.position.y = h / 2; place(wall, c); W.add(wall);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.12, 0.29), m2); cap.position.y = h - 0.06; place(cap, c); W.add(cap);
        const base = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.18, 0.29), m2); base.position.y = 0.09; place(base, c); W.add(base);
        const obj = { mats: [m1, m2], faded: false };
        for (const mm of [wall, cap, base]) { mm.userData.wall = obj; fadeables.push(mm); }
        const t = 0.15;
        if (alongZ) addCol(fixed - t, fixed + t, s0, s1); else addCol(s0, s1, fixed - t, fixed + t);
      } else {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(len, h - 0.2, 0.05), glassMat); glass.position.y = h / 2; place(glass, c); W.add(glass);
        glass.userData.wall = { glass: true, mesh: glass, faded: false }; fadeables.push(glass);
        for (const [yy, hh] of [[0, 0.12], [h - 0.12, 0.12]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(len, hh, 0.1), lam(frameCol)); r.position.y = yy + hh / 2; place(r, c); W.add(r); }
        const n = Math.max(1, Math.round(len / 2.2));
        for (let i = 0; i <= n; i++) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, h, 0.1), lam(frameCol));
          p.position.y = h / 2; place(p, s0 + (len * i) / n); W.add(p);
        }
        const t = 0.08;
        if (alongZ) addCol(fixed - t, fixed + t, s0, s1); else addCol(s0, s1, fixed - t, fixed + t);
      }
    }
    // linteaux au-dessus des portes
    for (const [g0, g1] of gaps) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(g1 - g0, h - 2.3, 0.14), lam(frameCol));
      l.position.y = 2.3 + (h - 2.3) / 2; place(l, (g0 + g1) / 2); W.add(l);
    }
  }
  // linteau entrée couloir
  box(W, 4, 0.6, 0.25, '#3a3f55', 0, 2.4, 0);

  // ----- Panneaux -----
  function makeSign(w, h, px = 128) {
    const c = document.createElement('canvas'); c.width = Math.round(px * w); c.height = Math.round(px * h);
    const tex = canvasTex(c);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    return { mesh, canvas: c, tex, draw(lines, opts) { drawTextCanvas(c, lines, opts); tex.needsUpdate = true; } };
  }
  const signs = [];
  function sign(w, h, x, y, z, ry, lines, opts) {
    const s = makeSign(w, h); s.mesh.position.set(x, y, z); s.mesh.rotation.y = ry; W.add(s.mesh);
    s.lines = lines; s.opts = opts; s.draw(lines, opts); signs.push(s); return s;
  }
  sign(3.8, 0.55, 0, 2.7, 0.14, 0, [{ text: 'COULOIR  ▲' }], { bg: '#3a3f55', fg: '#f2c14e' });
  sign(7, 1.3, -8, 2.0, 0.14, 0, [{ text: 'ESPACE WORK&YOU', color: '#f2c14e' }, { text: 'Bienvenue au QG virtuel', font: FONT_TEXT, size: 50 }], { bg: '#14182e', border: '#f2c14e' });
  sign(7, 1.3, 8, 2.0, 0.14, 0, [{ text: 'Par le couloir :', font: FONT_TEXT, size: 46 }, { text: 'Réunion · Prospection · Dressing · Amphi', font: FONT_TEXT, size: 44 }], { bg: '#14182e', border: '#2bb3a3' });

  const doors = {
    reunion: [-1.92, 2.62, -6.5, Math.PI / 2],
    prospection: [-1.92, 2.62, -20.5, Math.PI / 2],
    dressing: [1.92, 2.62, -5, -Math.PI / 2],
    amphi: [1.92, 3.2, -19, -Math.PI / 2],
  };
  for (const [k, [x, y, z, ry]] of Object.entries(doors)) {
    const s = makeSign(2.2, 0.55); s.mesh.position.set(x, y, z); s.mesh.rotation.y = ry; W.add(s.mesh);
    doorSigns[k] = s;
  }
  function updateDoorSigns(counts) {
    for (const [k, s] of Object.entries(doorSigns)) {
      const n = counts[k] || 0;
      const key = k + n; if (s._k === key) continue; s._k = key;
      s.draw([{ text: ROOMS[k].short, size: 22 }, { text: n ? `● ${n} présent${n > 1 ? 's' : ''}` : '○ libre', font: FONT_TEXT, size: 30, color: n ? '#7CFC9a' : '#9aa4b8' }], { bg: '#14182e', border: ROOMS[k].color });
    }
  }

  // ----- Télés -----
  function idleTvCanvas(title, sub) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 288;
    drawTextCanvas(c, [{ text: title, size: 22, color: '#f2c14e' }, { text: sub, font: FONT_TEXT, size: 30 }], { bg: '#0d1b3a', border: '#2b3a67' });
    const g = c.getContext('2d'); g.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
    return c;
  }
  function makeTV(id, zone, x, y, z, ry, w, h, title = 'ÉCRAN LIBRE', sub = 'Approche-toi pour partager ton écran') {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; W.add(g);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, h + 0.25, 0.12), lam('#1a1c26')); g.add(frame);
    const idleCanvas = idleTvCanvas(title, sub);
    const idleTex = canvasTex(idleCanvas);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: idleTex })); screen.position.z = 0.07; g.add(screen);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: '#3cff7a' })); led.position.set(w / 2 - 0.1, -h / 2 - 0.08, 0.07); g.add(led);
    const tv = {
      id, zone, w, h, group: g, screen, idleTex, idleCanvas, video: null, sharer: null,
      pos: new THREE.Vector3(x, 0, z),
      setStream(stream, sharer) {
        this.clear();
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; v.srcObject = stream;
        v.play().catch(() => {});
        const vt = new THREE.VideoTexture(v); vt.colorSpace = THREE.SRGBColorSpace;
        screen.material.map = vt; screen.material.needsUpdate = true;
        this.video = v; this.sharer = sharer;
      },
      clear() {
        if (this.video) { this.video.srcObject = null; this.video = null; }
        if (screen.material.map !== idleTex) { screen.material.map.dispose?.(); screen.material.map = idleTex; screen.material.needsUpdate = true; }
        this.sharer = null;
      },
      redrawIdle(fn) { fn(idleCanvas); idleTex.needsUpdate = true; },
    };
    tvs[id] = tv;
    return tv;
  }

  // ----- Mobilier -----
  function sofa(x, z, ry, color, group, zone) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; W.add(g);
    const L = 2.4;
    box(g, L, 0.42, 0.9, color, 0, 0, 0);
    box(g, L, 0.6, 0.22, color, 0, 0.42, -0.34);
    box(g, 0.2, 0.28, 0.9, color, -L / 2 + 0.1, 0.42, 0); box(g, 0.2, 0.28, 0.9, color, L / 2 - 0.1, 0.42, 0);
    for (const o of [-0.72, 0, 0.72]) box(g, 0.66, 0.06, 0.6, '#ffffff', o, 0.42, 0.08).material = lam(shade(color, 18));
    for (const [i, o] of [-0.72, 0, 0.72].entries()) {
      const [dx, dz] = rotXZ(o, 0.1, ry);
      seats.push({ id: `${group}-${seats.length}`, x: x + dx, z: z + dz, y: 0.45, ry, group, zone, kind: 'sofa' });
    }
    const sw = Math.abs(Math.cos(ry)) > 0.5 ? [L / 2, 0.45] : [0.45, L / 2];
    addCol(x - sw[0], x + sw[0], z - sw[1], z + sw[1]);
  }
  function chair(x, z, ry, color, group, zone, kind = 'chair', y0 = 0) {
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry; W.add(g);
    box(g, 0.1, 0.38, 0.1, '#2a2d3a', 0, 0, 0);
    box(g, 0.52, 0.08, 0.52, color, 0, 0.37, 0);
    box(g, 0.52, 0.55, 0.07, color, 0, 0.45, -0.23);
    const [dx, dz] = rotXZ(0, 0.05, ry);
    const s = { id: `${group}-${seats.length}`, x: x + dx, z: z + dz, y: y0 + 0.45, ry, group, zone, kind };
    seats.push(s); return s;
  }
  function table(x, z, w, d, h, color, col = true) {
    box(W, w, 0.08, d, color, x, h - 0.08, z);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(W, 0.08, h - 0.08, 0.08, '#2a2d3a', x + sx * (w / 2 - 0.15), 0, z + sz * (d / 2 - 0.15));
    if (col) addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }
  function plant(x, z, s = 1) {
    box(W, 0.5 * s, 0.45 * s, 0.5 * s, '#a0522d', x, 0, z);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45 * s, 1.3 * s, 5), lam('#3aa655')); cone.position.set(x, 0.45 * s + 0.65 * s, z); W.add(cone);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.32 * s, 0.9 * s, 5), lam('#4cc46a')); c2.position.set(x, 0.45 * s + 1.25 * s, z); c2.rotation.y = 0.5; W.add(c2);
    addCol(x - 0.3 * s, x + 0.3 * s, z - 0.3 * s, z + 0.3 * s);
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, v + amt));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  // ===== ACCUEIL =====
  makeTV('tv-accueil', 'accueil', -13.83, 1.65, 8, Math.PI / 2, 5, 2.8);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 7), new THREE.MeshLambertMaterial({ map: patternTex('carpet', '#c0563f', 'rgba(0,0,0,.15)', [3, 3]) }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-9.5, 0.004, 8); W.add(rug);
  sofa(-6.6, 8, -Math.PI / 2, '#2bb3a3', 'canape-accueil', 'accueil');
  sofa(-9.6, 11.6, Math.PI, '#ff6b5a', 'canape-accueil', 'accueil');
  sofa(-9.6, 4.4, 0, '#ff6b5a', 'canape-accueil', 'accueil');
  table(-9.6, 8, 1.6, 1.1, 0.42, '#8a5c34');
  // accueil / réception
  box(W, 4, 1.1, 1, '#2d3142', 7, 0, 10); box(W, 4.2, 0.08, 1.2, '#f2c14e', 7, 1.1, 10); addCol(5, 9, 9.5, 10.5);
  box(W, 0.5, 0.35, 0.05, '#0d1b3a', 6.2, 1.18, 9.9);
  // coin café
  box(W, 1.2, 1, 0.7, '#5a5f73', 12.8, 0, 2); box(W, 0.6, 0.6, 0.5, '#1a1c26', 12.8, 1, 2); addCol(12.2, 13.4, 1.6, 2.4);
  box(W, 1.2, 1, 0.7, '#5a5f73', 12.8, 0, 3.2); addCol(12.2, 13.4, 2.8, 3.6);
  // seconde bulle : poufs autour d'une table haute
  table(8, 4.5, 1.2, 1.2, 1.05, '#f2c14e');
  for (const [dx, dz, ry] of [[0, -1.1, 0], [0, 1.1, Math.PI], [-1.1, 0, Math.PI / 2], [1.1, 0, -Math.PI / 2]]) chair(8 + dx, 4.5 + dz, ry, '#5b8def', 'table-haute', 'accueil');
  for (const [px, pz] of [[-13, 15], [13, 15], [-3, 1], [3, 1], [13, 7]]) plant(px, pz);

  // ===== RÉUNION =====
  table(-8.5, -6.5, 5, 2.2, 0.76, '#e9e3d6');
  for (const cx of [-10.2, -8.5, -6.8]) { chair(cx, -8.2, 0, '#5b8def', 'reunion', 'reunion'); chair(cx, -4.8, Math.PI, '#5b8def', 'reunion', 'reunion'); }
  chair(-11.8, -6.5, Math.PI / 2, '#5b8def', 'reunion', 'reunion'); chair(-5.2, -6.5, -Math.PI / 2, '#5b8def', 'reunion', 'reunion');
  makeTV('tv-reunion', 'reunion', -13.83, 1.65, -6.5, Math.PI / 2, 4.2, 2.4);
  // tableau post-it
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1024; boardCanvas.height = 380;
  const boardTex = canvasTex(boardCanvas);
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.23), new THREE.MeshBasicMaterial({ map: boardTex }));
  boardMesh.position.set(-8, 1.6, -12.86); W.add(boardMesh);
  box(W, 6.2, 0.08, 0.15, '#3a3f55', -8, 0.45, -12.8);
  const board = { pos: new THREE.Vector3(-8, 0, -11.8), zone: 'reunion', canvas: boardCanvas, tex: boardTex };
  plant(-13, -1, 0.9); plant(-13, -12, 0.9);

  // ===== PROSPECTION =====
  box(W, 2.6, 0.76, 1, '#2d3142', -8, 0, -25.3); box(W, 2.8, 0.06, 1.2, '#2bb3a3', -8, 0.76, -25.3); addCol(-9.3, -6.7, -25.8, -24.8);
  box(W, 0.3, 0.12, 0.2, '#f2c14e', -8.6, 0.82, -25.2);
  const callSeat = chair(-8, -26.5, 0, '#ff6b5a', 'poste-appel', 'prospection', 'callDesk');
  for (const [row, zz] of [[0, -21], [1, -18.8]]) for (let i = 0; i < 5; i++) chair(-11.6 + i * 1.8 + row * 0.9 - 0.45, zz, Math.PI, '#2bb3a3', 'prospection', 'prospection');
  const onAir = makeSign(2.8, 0.7); onAir.mesh.position.set(-8, 2.25, -27.86); W.add(onAir.mesh);
  function setOnAir(name) {
    const key = name || '';
    if (onAir._k === key) return; onAir._k = key;
    onAir.draw(name ? [{ text: '● EN APPEL', color: '#ff4d4d', size: 26 }, { text: name, font: FONT_TEXT, size: 34 }] : [{ text: 'POSTE D\'APPEL', color: '#5a6080', size: 22 }, { text: 'Assieds-toi pour appeler', font: FONT_TEXT, size: 30, color: '#9aa4b8' }], { bg: '#14182e', border: name ? '#ff4d4d' : '#2b3a67' });
  }
  setOnAir(null);
  makeTV('tv-prospection', 'prospection', -13.83, 1.65, -20, Math.PI / 2, 4, 2.25, 'ÉCRAN PROSPECTION', 'Partage la fiche client / le script');
  plant(-3, -27, 0.9); plant(-13, -14, 0.9);

  // ===== DRESSING =====
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.15, 10), lam('#f2c14e')); pod.position.set(8, 0.075, -5); W.add(pod);
  const mirrorC = document.createElement('canvas'); mirrorC.width = 128; mirrorC.height = 160;
  { const g = mirrorC.getContext('2d'); const gr = g.createLinearGradient(0, 0, 128, 160); gr.addColorStop(0, '#cfe8ff'); gr.addColorStop(1, '#7fa6d6'); g.fillStyle = gr; g.fillRect(0, 0, 128, 160); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(20, 20, 8, 60); g.fillRect(34, 20, 4, 30); }
  const mirror = new THREE.Group(); mirror.position.set(11.86, 1.5, -5); mirror.rotation.y = -Math.PI / 2; W.add(mirror);
  mirror.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.1), lam('#f2c14e')));
  const mp = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.5), new THREE.MeshBasicMaterial({ map: canvasTex(mirrorC) })); mp.position.z = 0.06; mirror.add(mp);
  const wardrobeCols = ['#e872b0', '#5b8def', '#2bb3a3', '#f2c14e', '#8e5bd8'];
  for (let i = 0; i < 5; i++) {
    const x = 3.4 + i * 1.7;
    box(W, 1.5, 2.3, 0.7, '#f5efe6', x, 0, -9.45);
    box(W, 0.06, 2.1, 0.02, '#c9bfae', x, 0.1, -9.09);
    for (let j = 0; j < 3; j++) box(W, 0.3, 0.7, 0.08, wardrobeCols[(i + j) % 5], x - 0.4 + j * 0.4, 1.2, -9.05);
  }
  addCol(2.6, 11.9, -9.85, -9.05);
  sign(3.2, 0.6, 7, 2.6, -9.0, 0, [{ text: 'DRESSING', size: 24, color: '#e872b0' }], { bg: '#14182e' });
  box(W, 2, 0.45, 0.6, '#8e5bd8', 4.5, 0, -1); addCol(3.5, 5.5, -1.3, -0.7);
  const dressing = { pos: new THREE.Vector3(8, 0, -5) };

  // ===== AMPHI =====
  for (const r of AMPHI_ROWS) {
    if (r.h > 0) box(W, 2, r.h, 18, '#6a2632', r.x, 0, -19);
    for (let z = -26.6; z <= -11.4; z += 1.15) {
      if (Math.abs(z + 19) < 1.2) continue;
      chair(r.x + 0.3, z, Math.PI / 2, '#ff8a3d', 'amphi', 'amphi', 'amphi', r.h);
    }
  }
  box(W, 4.9, 0.6, 18, '#3a3f55', 19.45, 0, -19);
  box(W, 4.9, 0.05, 18, '#f2c14e', 19.45, 0.6, -19);
  box(W, 0.7, 1.1, 0.5, '#2d3142', 18.6, 0.6, -19); addCol(18.25, 18.95, -19.25, -18.75);
  const amphiTV = makeTV('tv-amphi', 'amphi', 21.84, 2.55, -19, -Math.PI / 2, 8.5, 3.8, 'AMPHITHÉÂTRE', 'Agenda en chargement…');
  sign(4, 0.5, 19.5, 4.3, -27.86, 0, [{ text: 'SCÈNE', size: 22, color: '#ff8a3d' }], { bg: '#14182e' });

  // ===== Couloir : plantes & lumière =====
  plant(-1.3, -27.2, 0.7); plant(1.3, -27.2, 0.7);

  // ----- Tableau post-it -----
  function drawBoard(notes) {
    const g = boardCanvas.getContext('2d');
    g.fillStyle = '#f7f7f2'; g.fillRect(0, 0, 1024, 380);
    g.strokeStyle = '#3a3f55'; g.lineWidth = 10; g.strokeRect(5, 5, 1014, 370);
    g.fillStyle = '#3a3f55'; g.font = `18px ${FONT_TITLE}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('BRAINSTORM', 22, 18);
    g.font = `22px ${FONT_TEXT}`; g.fillStyle = '#7a7f95'; g.fillText('[E] près du tableau pour ajouter un post-it', 230, 18);
    const cols = 6, w = 155, h = 100, gap = 10;
    notes.slice(-18).forEach((n, i) => {
      const x = 22 + (i % cols) * (w + gap), y = 56 + Math.floor(i / cols) * (h + gap);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 4, y + 4, w, h);
      g.fillStyle = n.color || '#ffe066'; g.fillRect(x, y, w, h);
      g.fillStyle = '#222'; g.font = `24px ${FONT_TEXT}`;
      wrap(g, n.text, x + 8, y + 6, w - 14, 22, 3);
      g.fillStyle = '#555'; g.font = `18px ${FONT_TEXT}`; g.fillText('— ' + (n.author || '').slice(0, 16), x + 8, y + h - 22);
    });
    boardTex.needsUpdate = true;
  }
  function wrap(g, text, x, y, maxW, lh, maxL) {
    const words = String(text).split(/\s+/); let line = '', n = 0;
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y + n * lh); n++; line = wd; if (n >= maxL) return; }
      else line = t;
    }
    if (line && n < maxL) g.fillText(line, x, y + n * lh);
  }
  drawBoard([]);

  function redrawSigns() { for (const s of signs) s.draw(s.lines, s.opts); for (const s of Object.values(doorSigns)) s._k = null; onAir._k = '__'; }

  const glassClear = new THREE.MeshBasicMaterial({ color: 0xdfeeff, transparent: true, opacity: 0.12, depthWrite: false });
  return { group: W, glassMat, glassClear, colliders, seats, tvs, board, drawBoard, fadeables, updateDoorSigns, setOnAir, amphiTV, dressing, callSeat, redrawSigns };
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
