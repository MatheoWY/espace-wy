// Avatars "voxel" low-poly : construction, personnalisation, animation, étiquette de nom.
import * as THREE from 'three';
import { FONT_TEXT } from './world.js';

export const PALETTE = {
  skin: ['#f5d0b0', '#e8b48a', '#c68a5a', '#9a623a', '#6b4226', '#ffe3cf'],
  hair: ['#2b1d14', '#5a3a1e', '#a0672b', '#e3c16f', '#d9d9d9', '#c0392b', '#5b4bdb', '#1abc9c'],
  cloth: ['#2bb3a3', '#ff6b5a', '#5b8def', '#f2c14e', '#8e5bd8', '#2d3142', '#f4f4f4', '#e872b0', '#3aa655', '#ff8a3d'],
};
export const HAIR_STYLES = ['Court', 'Long', 'Crête', 'Chignon', 'Rasé', 'Bouclé'];
export const ACCS = ['Aucun', 'Lunettes', 'Casquette', 'Casque audio', 'Bonnet'];
export const DEFAULT_LOOK = [0, 0, 0, 0, 5, 0]; // skin, hairStyle, hairColor, top, pants, acc

const mats = new Map();
function m(color) { if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true })); return mats.get(color); }
function bx(parent, w, h, d, color, x, y, z) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(color)); me.position.set(x, y, z); parent.add(me); return me; }

export function normLook(l) {
  const L = Array.isArray(l) ? l.slice(0, 6) : DEFAULT_LOOK.slice();
  const lim = [PALETTE.skin.length, HAIR_STYLES.length, PALETTE.hair.length, PALETTE.cloth.length, PALETTE.cloth.length, ACCS.length];
  return lim.map((n, i) => { const v = Number(L[i]) | 0; return v >= 0 && v < n ? v : DEFAULT_LOOK[i]; });
}

export function buildAvatar(look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; root.add(shadow);
  const av = { root, body, shadow, t: 0, look: null, parts: {} };
  applyLook(av, look);
  return av;
}

export function applyLook(av, look) {
  look = normLook(look);
  av.look = look;
  const [skinI, hairI, hairColI, topI, pantsI, accI] = look;
  const skin = PALETTE.skin[skinI], hair = PALETTE.hair[hairColI], top = PALETTE.cloth[topI], pants = PALETTE.cloth[pantsI];
  const b = av.body;
  while (b.children.length) b.remove(b.children[0]);
  const P = {};
  // jambes (hanche -> genou)
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.13 * side, 0.82, 0); b.add(hip);
    bx(hip, 0.23, 0.42, 0.25, pants, 0, -0.21, 0);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    bx(knee, 0.22, 0.32, 0.24, pants, 0, -0.16, 0);
    bx(knee, 0.24, 0.1, 0.34, '#22242e', 0, -0.35, 0.04);
    P[side < 0 ? 'hipL' : 'hipR'] = hip; P[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  bx(b, 0.58, 0.64, 0.32, top, 0, 1.14, 0);
  bx(b, 0.6, 0.08, 0.34, pants, 0, 0.84, 0);
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.39 * side, 1.42, 0); b.add(sh);
    bx(sh, 0.18, 0.52, 0.2, top, 0, -0.26, 0);
    bx(sh, 0.16, 0.14, 0.18, skin, 0, -0.6, 0);
    P[side < 0 ? 'armL' : 'armR'] = sh;
  }
  const head = new THREE.Group(); head.position.y = 1.47; b.add(head); P.head = head;
  bx(head, 0.46, 0.46, 0.46, skin, 0, 0.23, 0);
  bx(head, 0.07, 0.09, 0.02, '#1a1a1a', -0.1, 0.25, 0.235); bx(head, 0.07, 0.09, 0.02, '#1a1a1a', 0.1, 0.25, 0.235);
  bx(head, 0.13, 0.03, 0.02, '#8a4a3a', 0, 0.11, 0.235);
  // cheveux
  const H = (w, h, d, x, y, z) => bx(head, w, h, d, hair, x, y, z);
  switch (HAIR_STYLES[hairI]) {
    case 'Court': H(0.5, 0.12, 0.5, 0, 0.5, 0); H(0.5, 0.3, 0.1, 0, 0.33, -0.21); H(0.06, 0.16, 0.42, -0.24, 0.38, -0.02); H(0.06, 0.16, 0.42, 0.24, 0.38, -0.02); break;
    case 'Long': H(0.5, 0.12, 0.5, 0, 0.5, 0); H(0.5, 0.62, 0.12, 0, 0.2, -0.22); H(0.07, 0.5, 0.42, -0.25, 0.25, -0.02); H(0.07, 0.5, 0.42, 0.25, 0.25, -0.02); break;
    case 'Crête': H(0.12, 0.22, 0.5, 0, 0.56, 0); break;
    case 'Chignon': H(0.5, 0.1, 0.5, 0, 0.5, 0); H(0.5, 0.25, 0.1, 0, 0.36, -0.21); H(0.22, 0.22, 0.22, 0, 0.62, -0.12); break;
    case 'Rasé': H(0.48, 0.04, 0.48, 0, 0.47, 0); break;
    case 'Bouclé': for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) H(0.2, 0.2, 0.2, i * 0.17, 0.53 + ((i + j) & 1) * 0.04, j * 0.17); H(0.54, 0.3, 0.14, 0, 0.33, -0.21); break;
  }
  switch (ACCS[accI]) {
    case 'Lunettes': bx(head, 0.44, 0.04, 0.03, '#111', 0, 0.27, 0.245); bx(head, 0.15, 0.12, 0.02, '#9ad1ff', -0.1, 0.25, 0.25); bx(head, 0.15, 0.12, 0.02, '#9ad1ff', 0.1, 0.25, 0.25); break;
    case 'Casquette': bx(head, 0.5, 0.15, 0.5, top, 0, 0.53, 0); bx(head, 0.46, 0.04, 0.24, top, 0, 0.47, 0.33); break;
    case 'Casque audio': bx(head, 0.52, 0.06, 0.1, '#22242e', 0, 0.55, 0); bx(head, 0.09, 0.18, 0.18, '#22242e', -0.27, 0.25, 0); bx(head, 0.09, 0.18, 0.18, '#22242e', 0.27, 0.25, 0); break;
    case 'Bonnet': bx(head, 0.52, 0.22, 0.52, top, 0, 0.53, 0); bx(head, 0.14, 0.14, 0.14, '#f4f4f4', 0, 0.7, 0); break;
  }
  av.parts = P;
}

// state: { moving, sitting, speed, talking }
export function animateAvatar(av, dt, st) {
  const P = av.parts;
  if (st.moving && !st.sitting) av.t += dt * (7 + (st.speed || 3) * 1.2); else av.t *= 0.9;
  const sw = st.moving && !st.sitting ? Math.sin(av.t) * 0.55 : 0;
  const lerp = (o, k, v) => { o[k] += (v - o[k]) * Math.min(1, dt * 14); };
  if (st.sitting) {
    lerp(P.hipL.rotation, 'x', -Math.PI / 2); lerp(P.hipR.rotation, 'x', -Math.PI / 2);
    lerp(P.kneeL.rotation, 'x', Math.PI / 2); lerp(P.kneeR.rotation, 'x', Math.PI / 2);
    lerp(P.armL.rotation, 'x', -0.5); lerp(P.armR.rotation, 'x', -0.5);
    lerp(av.body.position, 'y', -0.37);
  } else {
    lerp(P.hipL.rotation, 'x', sw); lerp(P.hipR.rotation, 'x', -sw);
    lerp(P.kneeL.rotation, 'x', Math.max(0, -sw) * 0.5); lerp(P.kneeR.rotation, 'x', Math.max(0, sw) * 0.5);
    lerp(P.armL.rotation, 'x', -sw * 0.8); lerp(P.armR.rotation, 'x', sw * 0.8);
    av.body.position.y = st.moving ? Math.abs(Math.cos(av.t)) * 0.05 : av.body.position.y * 0.8;
  }
  const tk = st.talking ? Math.sin(performance.now() / 90) * 0.06 : 0;
  P.head.rotation.x += (tk - P.head.rotation.x) * 0.3;
}

export function makeLabel(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(1.6, 0.4, 1); sp.position.y = 2.3; sp.renderOrder = 10;
  const label = { sprite: sp, name, state: '' };
  label.set = (name, mode) => {
    const key = name + '|' + mode; if (label.state === key) return; label.state = key; label.name = name;
    const g = c.getContext('2d'); g.clearRect(0, 0, 256, 64);
    g.font = `34px ${FONT_TEXT}`; const w = Math.min(248, g.measureText(name).width + 34);
    const x0 = (256 - w) / 2;
    g.fillStyle = mode === 'talk' ? 'rgba(40,160,90,.92)' : mode === 'muted' ? 'rgba(90,40,50,.85)' : mode === 'visio' ? 'rgba(60,80,170,.9)' : 'rgba(20,24,46,.82)';
    g.fillRect(x0, 10, w, 44);
    g.fillStyle = mode === 'talk' ? '#c8ffd8' : mode === 'muted' ? '#ff8a8a' : '#f2c14e';
    g.fillRect(x0 + 8, 26, 10, 12);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(name, x0 + 26, 33, w - 32);
    tex.needsUpdate = true;
  };
  label.set(name, '');
  return label;
}
