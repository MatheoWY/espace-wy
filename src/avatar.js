// Avatars low-poly personnalisables : morphologie, visage, coiffure, tenue, accessoires.
import * as THREE from 'three';
import { FONT_TEXT, BRAND } from './world.js';

export const PALETTE = {
  skin: ['#FBE0CF', '#F5D0B0', '#E8B48A', '#D19A6A', '#B07A4E', '#8A5A36', '#6B4226', '#4A2E1A'],
  hair: ['#1E1612', '#3B2618', '#5A3A1E', '#8A5A2B', '#C08A4A', '#E3C16F', '#D9D9D9', '#B23A2E', '#D6006C', '#4676ED'],
  cloth: ['#D6006C', '#2E3484', '#4676ED', '#F4F3F7', '#1F2233', '#9AA0B4', '#D9C3A0', '#B88552', '#3E5A8A', '#3A8A5C', '#7A1F3D', '#6A3FB5', '#F2C14E', '#A9C4F5'],
  shoes: ['#1F2233', '#F4F3F7', '#7A4E2D', '#D6006C', '#4676ED', '#9AA0B4'],
};
export const OPTIONS = {
  height: ['Petit', 'Moyen', 'Grand'],
  build: ['Fin', 'Normal', 'Costaud'],
  eyes: ['Ronds', 'Fins', 'Rieurs', 'Cils', 'Grands'],
  brows: ['Droits', 'Arqués', 'Épais'],
  facial: ['Aucune', 'Barbe courte', 'Barbe longue', 'Moustache', 'Bouc'],
  hair: ['Court', 'Long', 'Crête', 'Chignon', 'Rasé', 'Bouclé', 'Carré', 'Queue', 'Dégradé', 'Mèche'],
  top: ['T-shirt', 'Chemise', 'Col roulé', 'Blazer', 'Sweat à capuche', 'Polo'],
  bottom: ['Pantalon', 'Jupe', 'Short'],
  acc: ['Aucun', 'Lunettes', 'Lunettes de soleil', 'Casquette', 'Casque audio', 'Bonnet', 'Boucles d\'oreilles', 'Badge Work&You'],
};
// Index des réglages dans le tableau "look"
export const L = { skin: 0, hair: 1, hairColor: 2, topColor: 3, bottomColor: 4, acc: 5, height: 6, build: 7, eyes: 8, brows: 9, facial: 10, top: 11, top2Color: 12, bottom: 13, shoes: 14, accColor: 15 };
export const DEFAULT_LOOK = [1, 0, 1, 1, 4, 7, 1, 1, 0, 0, 0, 3, 3, 0, 0, 0];
const LIMITS = () => [PALETTE.skin.length, OPTIONS.hair.length, PALETTE.hair.length, PALETTE.cloth.length, PALETTE.cloth.length, OPTIONS.acc.length,
  OPTIONS.height.length, OPTIONS.build.length, OPTIONS.eyes.length, OPTIONS.brows.length, OPTIONS.facial.length, OPTIONS.top.length, PALETTE.cloth.length,
  OPTIONS.bottom.length, PALETTE.shoes.length, PALETTE.cloth.length];
// ancien format (6 valeurs) accepté
export function normLook(l) {
  const lim = LIMITS();
  const src = Array.isArray(l) ? l : DEFAULT_LOOK;
  return lim.map((n, i) => { const v = Number(src[i]); return Number.isInteger(v) && v >= 0 && v < n ? v : DEFAULT_LOOK[i]; });
}
export function randomLook() { return LIMITS().map((n) => Math.floor(Math.random() * n)); }

const mats = new Map();
function m(color, rough = 0.8) { const k = color + rough; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough })); return mats.get(k); }
function bx(parent, w, h, d, color, x, y, z, rough) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(color, rough)); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me;
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, v + amt)); return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join(''); }

export function buildAvatar(look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; root.add(shadow);
  const av = { root, body, shadow, t: 0, look: null, parts: {} };
  applyLook(av, look);
  return av;
}

export function applyLook(av, look) {
  look = normLook(look); av.look = look;
  const g = (k) => look[L[k]];
  const skin = PALETTE.skin[g('skin')], hair = PALETTE.hair[g('hairColor')], top = PALETTE.cloth[g('topColor')], top2 = PALETTE.cloth[g('top2Color')];
  const bottom = PALETTE.cloth[g('bottomColor')], shoes = PALETTE.shoes[g('shoes')], accC = PALETTE.cloth[g('accColor')];
  const topStyle = OPTIONS.top[g('top')], botStyle = OPTIONS.bottom[g('bottom')];
  const b = av.body;
  while (b.children.length) b.remove(b.children[0]);
  const P = {};
  const bw = [0.88, 1, 1.16][g('build')];
  b.scale.set(1, [0.93, 1, 1.07][g('height')], 1);

  // ----- jambes -----
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.13 * side * bw, 0.82, 0); b.add(hip);
    const thighCol = botStyle === 'Jupe' ? skin : bottom;
    bx(hip, 0.22 * bw, 0.42, 0.24, thighCol, 0, -0.21, 0);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    bx(knee, 0.21 * bw, 0.31, 0.23, botStyle === 'Pantalon' ? bottom : skin, 0, -0.155, 0);
    bx(knee, 0.23 * bw, 0.1, 0.34, shoes, 0, -0.35, 0.04, 0.5);
    bx(knee, 0.235 * bw, 0.03, 0.35, shade(shoes, 40), 0, -0.395, 0.04, 0.6);
    P[side < 0 ? 'hipL' : 'hipR'] = hip; P[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  if (botStyle === 'Jupe') { const sk = bx(b, 0.62 * bw, 0.36, 0.36, bottom, 0, 0.72, 0); sk.scale.set(1, 1, 1); bx(b, 0.68 * bw, 0.08, 0.4, bottom, 0, 0.56, 0); }
  if (botStyle === 'Short') { /* cuisses déjà en couleur du bas */ }
  bx(b, 0.6 * bw, 0.08, 0.33, botStyle === 'Jupe' ? bottom : shade(bottom, -25), 0, 0.84, 0);

  // ----- buste -----
  const longSleeves = !['T-shirt', 'Polo'].includes(topStyle);
  const torsoCol = top;
  bx(b, 0.58 * bw, 0.64, 0.32, torsoCol, 0, 1.14, 0);
  if (topStyle === 'Chemise' || topStyle === 'Polo') {
    bx(b, 0.04, topStyle === 'Polo' ? 0.2 : 0.56, 0.01, shade(top, -30), 0, topStyle === 'Polo' ? 1.34 : 1.14, 0.165);
    for (const s of [-1, 1]) { const c = bx(b, 0.16, 0.06, 0.06, topStyle === 'Polo' ? top2 : shade(top, 18), s * 0.09, 1.45, 0.15); c.rotation.z = s * 0.35; }
  } else if (topStyle === 'Col roulé') {
    bx(b, 0.3, 0.12, 0.3, shade(top, -12), 0, 1.47, 0);
  } else if (topStyle === 'Blazer') {
    bx(b, 0.2, 0.62, 0.01, top2, 0, 1.15, 0.163);
    for (const s of [-1, 1]) { const lp = bx(b, 0.07, 0.36, 0.02, shade(top, -22), s * 0.12, 1.28, 0.17); lp.rotation.z = -s * 0.28; }
    bx(b, 0.62 * bw, 0.06, 0.34, shade(top, -15), 0, 0.84, 0);
    bx(b, 0.08, 0.04, 0.01, top2, -0.17 * bw, 1.32, 0.166);
  } else if (topStyle === 'Sweat à capuche') {
    bx(b, 0.4, 0.2, 0.14, shade(top, -18), 0, 1.4, -0.2);
    bx(b, 0.34, 0.14, 0.01, shade(top, -15), 0, 0.98, 0.163);
    for (const s of [-1, 1]) bx(b, 0.02, 0.2, 0.01, top2, s * 0.07, 1.3, 0.167);
  } else {
    bx(b, 0.24, 0.04, 0.01, shade(top, -20), 0, 1.44, 0.163);
  }
  // ----- bras -----
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set((0.29 * bw + 0.1) * side, 1.42, 0); b.add(sh);
    bx(sh, 0.18 * bw, 0.28, 0.2, top, 0, -0.14, 0);
    bx(sh, 0.165 * bw, 0.26, 0.185, longSleeves ? top : skin, 0, -0.41, 0);
    if (longSleeves && topStyle === 'Blazer') bx(sh, 0.17 * bw, 0.03, 0.19, top2, 0, -0.53, 0);
    bx(sh, 0.15, 0.13, 0.17, skin, 0, -0.6, 0);
    P[side < 0 ? 'armL' : 'armR'] = sh;
  }
  // badge
  if (OPTIONS.acc[g('acc')] === 'Badge Work&You') {
    for (const s of [-1, 1]) { const st = bx(b, 0.03, 0.3, 0.01, BRAND.rose, s * 0.1, 1.33, 0.165); st.rotation.z = s * 0.3; }
    bx(b, 0.14, 0.18, 0.02, '#ffffff', 0, 1.08, 0.17, 0.4); bx(b, 0.1, 0.04, 0.005, BRAND.navy, 0, 1.13, 0.182); bx(b, 0.06, 0.02, 0.005, BRAND.rose, 0, 1.08, 0.182);
  }

  // ----- tête -----
  const head = new THREE.Group(); head.position.y = 1.47; b.add(head); P.head = head;
  bx(head, 0.12, 0.08, 0.12, skin, 0, 0.02, 0);
  bx(head, 0.46, 0.46, 0.44, skin, 0, 0.27, 0, 0.7);
  for (const s of [-1, 1]) bx(head, 0.05, 0.1, 0.08, skin, s * 0.245, 0.26, 0);
  const eyeStyle = OPTIONS.eyes[g('eyes')];
  for (const s of [-1, 1]) {
    const ex = s * 0.1;
    if (eyeStyle === 'Rieurs') { const e = bx(head, 0.09, 0.025, 0.02, '#1a1a2a', ex, 0.29, 0.225); e.rotation.z = s * 0.15; }
    else if (eyeStyle === 'Fins') bx(head, 0.09, 0.04, 0.02, '#1a1a2a', ex, 0.29, 0.225);
    else {
      const big = eyeStyle === 'Grands';
      bx(head, big ? 0.11 : 0.085, big ? 0.12 : 0.09, 0.015, '#ffffff', ex, 0.29, 0.222, 0.3);
      bx(head, big ? 0.06 : 0.05, big ? 0.08 : 0.065, 0.02, '#1a1a2a', ex + s * 0.005, 0.285, 0.226, 0.3);
      bx(head, 0.02, 0.02, 0.01, '#ffffff', ex + 0.012, 0.305, 0.237);
      if (eyeStyle === 'Cils') { const c = bx(head, 0.04, 0.02, 0.02, '#1a1a2a', ex + s * 0.055, 0.335, 0.225); c.rotation.z = -s * 0.5; }
    }
  }
  const browStyle = OPTIONS.brows[g('brows')];
  for (const s of [-1, 1]) {
    const br = bx(head, 0.11, browStyle === 'Épais' ? 0.045 : 0.025, 0.02, hair, s * 0.1, 0.375, 0.225);
    if (browStyle === 'Arqués') br.rotation.z = -s * 0.2;
  }
  bx(head, 0.05, 0.08, 0.04, shade(skin, -14), 0, 0.22, 0.235);
  for (const s of [-1, 1]) bx(head, 0.06, 0.035, 0.01, '#ff9aa8', s * 0.15, 0.2, 0.223).material.transparent = false;
  const mouth = bx(head, 0.12, 0.03, 0.02, '#8a3a3a', 0, 0.13, 0.225); P.mouth = mouth;
  // pilosité faciale
  const facial = OPTIONS.facial[g('facial')];
  if (facial === 'Barbe courte' || facial === 'Barbe longue') {
    const long = facial === 'Barbe longue';
    bx(head, 0.47, long ? 0.24 : 0.14, 0.12, hair, 0, long ? 0.06 : 0.11, 0.18);
    for (const s of [-1, 1]) bx(head, 0.05, 0.22, 0.3, hair, s * 0.215, 0.18, 0.06);
    bx(head, 0.16, 0.04, 0.03, hair, 0, 0.165, 0.235);
    mouth.position.z = 0.245;
  } else if (facial === 'Moustache') bx(head, 0.18, 0.045, 0.03, hair, 0, 0.165, 0.235);
  else if (facial === 'Bouc') { bx(head, 0.12, 0.1, 0.05, hair, 0, 0.06, 0.21); bx(head, 0.14, 0.035, 0.03, hair, 0, 0.165, 0.235); }

  // ----- cheveux -----
  const H = (w, h, d, x, y, z) => bx(head, w, h, d, hair, x, y, z, 0.6);
  const hs = OPTIONS.hair[g('hair')];
  switch (hs) {
    case 'Court': H(0.5, 0.12, 0.48, 0, 0.53, 0); H(0.5, 0.3, 0.1, 0, 0.37, -0.2); for (const s of [-1, 1]) H(0.05, 0.16, 0.4, s * 0.24, 0.42, -0.02); H(0.46, 0.06, 0.08, 0, 0.47, 0.2); break;
    case 'Long': H(0.5, 0.12, 0.48, 0, 0.53, 0); H(0.5, 0.66, 0.12, 0, 0.2, -0.21); for (const s of [-1, 1]) H(0.07, 0.56, 0.4, s * 0.25, 0.24, -0.02); H(0.46, 0.08, 0.08, 0, 0.46, 0.2); break;
    case 'Crête': H(0.12, 0.24, 0.5, 0, 0.6, 0); for (const s of [-1, 1]) H(0.02, 0.2, 0.36, s * 0.235, 0.4, -0.04); break;
    case 'Chignon': H(0.5, 0.1, 0.48, 0, 0.52, 0); H(0.5, 0.26, 0.1, 0, 0.38, -0.2); H(0.24, 0.24, 0.24, 0, 0.66, -0.12); H(0.46, 0.06, 0.08, 0, 0.47, 0.2); break;
    case 'Rasé': H(0.48, 0.04, 0.46, 0, 0.51, 0); H(0.48, 0.2, 0.04, 0, 0.42, -0.215); break;
    case 'Bouclé': for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) H(0.21, 0.21, 0.21, i * 0.17, 0.56 + ((i + j) & 1) * 0.04, j * 0.16); H(0.56, 0.34, 0.16, 0, 0.36, -0.2); for (const s of [-1, 1]) H(0.1, 0.24, 0.3, s * 0.25, 0.42, -0.04); break;
    case 'Carré': H(0.52, 0.12, 0.5, 0, 0.53, 0); H(0.52, 0.42, 0.12, 0, 0.3, -0.21); for (const s of [-1, 1]) H(0.08, 0.38, 0.44, s * 0.26, 0.31, 0); H(0.5, 0.12, 0.1, 0, 0.46, 0.2); break;
    case 'Queue': H(0.5, 0.12, 0.48, 0, 0.53, 0); H(0.5, 0.3, 0.1, 0, 0.37, -0.2); H(0.14, 0.14, 0.14, 0, 0.42, -0.3); H(0.12, 0.42, 0.12, 0, 0.16, -0.32); H(0.46, 0.06, 0.08, 0, 0.47, 0.2); break;
    case 'Dégradé': H(0.48, 0.16, 0.46, 0, 0.55, 0); bx(head, 0.49, 0.18, 0.45, shade(hair, 35), 0, 0.4, -0.015, 0.8); break;
    case 'Mèche': H(0.5, 0.12, 0.48, 0, 0.53, 0); H(0.5, 0.3, 0.1, 0, 0.37, -0.2); { const mm = H(0.3, 0.1, 0.12, 0.08, 0.5, 0.2); mm.rotation.z = -0.3; } H(0.05, 0.16, 0.4, -0.24, 0.42, -0.02); break;
  }
  // ----- accessoires -----
  switch (OPTIONS.acc[g('acc')]) {
    case 'Lunettes': bx(head, 0.44, 0.03, 0.02, accC, 0, 0.32, 0.24, 0.3); for (const s of [-1, 1]) { bx(head, 0.15, 0.13, 0.015, '#CFE4FF', s * 0.1, 0.29, 0.238, 0.1); bx(head, 0.02, 0.02, 0.24, accC, s * 0.23, 0.31, 0.12); } break;
    case 'Lunettes de soleil': bx(head, 0.46, 0.04, 0.02, accC, 0, 0.32, 0.245, 0.3); for (const s of [-1, 1]) { bx(head, 0.17, 0.12, 0.02, '#151522', s * 0.1, 0.285, 0.245, 0.1); bx(head, 0.02, 0.02, 0.24, accC, s * 0.235, 0.31, 0.12); } break;
    case 'Casquette': bx(head, 0.52, 0.16, 0.5, accC, 0, 0.56, 0); bx(head, 0.46, 0.04, 0.26, accC, 0, 0.5, 0.33); bx(head, 0.08, 0.04, 0.08, shade(accC, -30), 0, 0.65, 0); break;
    case 'Casque audio': bx(head, 0.54, 0.06, 0.1, '#22242e', 0, 0.58, 0); for (const s of [-1, 1]) { bx(head, 0.09, 0.2, 0.2, '#22242e', s * 0.27, 0.28, 0); bx(head, 0.02, 0.14, 0.14, accC, s * 0.32, 0.28, 0); } break;
    case 'Bonnet': bx(head, 0.52, 0.24, 0.5, accC, 0, 0.56, 0); bx(head, 0.54, 0.07, 0.52, shade(accC, -25), 0, 0.46, 0); bx(head, 0.14, 0.14, 0.14, '#F4F3F7', 0, 0.74, 0); break;
    case 'Boucles d\'oreilles': for (const s of [-1, 1]) { bx(head, 0.03, 0.03, 0.03, '#E8C25A', s * 0.27, 0.2, 0.02, 0.2); bx(head, 0.04, 0.06, 0.04, accC, s * 0.27, 0.15, 0.02, 0.3); } break;
  }
  av.parts = P;
}

// st: { moving, sitting, speed, talking }
export function animateAvatar(av, dt, st) {
  const P = av.parts;
  if (st.moving && !st.sitting) av.t += dt * (7 + (st.speed || 3) * 1.2); else av.t *= 0.9;
  const sw = st.moving && !st.sitting ? Math.sin(av.t) * 0.55 : 0;
  const lerp = (o, k, v) => { o[k] += (v - o[k]) * Math.min(1, dt * 14); };
  if (st.sitting) {
    lerp(P.hipL.rotation, 'x', -Math.PI / 2); lerp(P.hipR.rotation, 'x', -Math.PI / 2);
    lerp(P.kneeL.rotation, 'x', Math.PI / 2); lerp(P.kneeR.rotation, 'x', Math.PI / 2);
    lerp(P.armL.rotation, 'x', -0.5); lerp(P.armR.rotation, 'x', -0.5);
    lerp(av.body.position, 'y', -0.37 * av.body.scale.y);
  } else {
    lerp(P.hipL.rotation, 'x', sw); lerp(P.hipR.rotation, 'x', -sw);
    lerp(P.kneeL.rotation, 'x', Math.max(0, -sw) * 0.5); lerp(P.kneeR.rotation, 'x', Math.max(0, sw) * 0.5);
    lerp(P.armL.rotation, 'x', -sw * 0.8); lerp(P.armR.rotation, 'x', sw * 0.8);
    av.body.position.y = st.moving ? Math.abs(Math.cos(av.t)) * 0.05 : av.body.position.y * 0.8;
  }
  const now = performance.now();
  const tk = st.talking ? Math.sin(now / 90) * 0.05 : 0;
  P.head.rotation.x += (tk - P.head.rotation.x) * 0.3;
  if (P.mouth) P.mouth.scale.y = st.talking ? 1 + Math.abs(Math.sin(now / 70)) * 2.2 : 1;
}

export function makeLabel(name) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 96;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
  sp.scale.set(1.7, 0.425, 1); sp.position.y = 2.35; sp.renderOrder = 10;
  const label = { sprite: sp, name, state: '' };
  label.set = (name, mode) => {
    const key = name + '|' + mode; if (label.state === key) return; label.state = key; label.name = name;
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    g.font = `600 40px ${FONT_TEXT}`;
    const w = Math.min(372, g.measureText(name).width + 74), x0 = (c.width - w) / 2, y0 = 16, h = 62, r = 31;
    g.fillStyle = 'rgba(20,22,60,.18)'; g.beginPath(); g.roundRect(x0 + 2, y0 + 4, w, h, r); g.fill();
    g.fillStyle = mode === 'visio' ? BRAND.blue : '#ffffff'; g.beginPath(); g.roundRect(x0, y0, w, h, r); g.fill();
    g.fillStyle = mode === 'talk' ? '#22C55E' : mode === 'muted' ? '#9AA0B4' : mode === 'visio' ? '#ffffff' : BRAND.rose;
    g.beginPath(); g.arc(x0 + 32, y0 + h / 2, mode === 'talk' ? 11 : 9, 0, 7); g.fill();
    if (mode === 'muted') { g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + 26, y0 + h / 2 - 6); g.lineTo(x0 + 38, y0 + h / 2 + 6); g.stroke(); }
    g.fillStyle = mode === 'visio' ? '#ffffff' : BRAND.navy; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(name, x0 + 52, y0 + h / 2 + 2, w - 62);
    tex.needsUpdate = true;
  };
  label.set(name, '');
  return label;
}
