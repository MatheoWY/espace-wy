// Avatars "voxel" (cubiques) très personnalisables : curseurs de morphologie, couleurs libres, styles.
import * as THREE from 'three';
import { FONT_TEXT, BRAND } from './world.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Nuanciers proposés (une couleur libre reste possible partout)
export const PALETTE = {
  skin: ['#FBE0CF', '#F5D0B0', '#E8B48A', '#D19A6A', '#B07A4E', '#8A5A36', '#6B4226', '#4A2E1A'],
  hair: ['#1E1612', '#3B2618', '#5A3A1E', '#8A5A2B', '#C08A4A', '#E3C16F', '#D9D9D9', '#B23A2E', '#D6006C', '#4676ED'],
  eyes: ['#2A1C14', '#5A3A1E', '#3E6FB0', '#3A8A5C', '#7A8A99', '#1A1A2A'],
  cloth: ['#D6006C', '#2E3484', '#4676ED', '#F4F3F7', '#1F2233', '#9AA0B4', '#D9C3A0', '#B88552', '#3E5A8A', '#3A8A5C', '#7A1F3D', '#6A3FB5', '#F2C14E', '#A9C4F5'],
  shoes: ['#1F2233', '#F4F3F7', '#7A4E2D', '#D6006C', '#4676ED', '#9AA0B4'],
};
export const OPTIONS = {
  eyes: ['Ronds', 'Fins', 'Rieurs', 'Cils', 'Pixel'],
  brows: ['Droits', 'Arqués', 'Épais', 'Froncés'],
  mouth: ['Sourire', 'Neutre', 'Grand sourire', 'Petit'],
  facial: ['Aucune', 'Barbe', 'Moustache', 'Bouc', 'Collier'],
  hair: ['Court', 'Long', 'Crête', 'Chignon', 'Rasé', 'Bouclé', 'Carré', 'Queue', 'Dégradé', 'Mèche', 'Afro', 'Couettes'],
  top: ['T-shirt', 'Chemise', 'Col roulé', 'Blazer', 'Sweat à capuche', 'Polo', 'Débardeur', 'Gilet'],
  bottom: ['Pantalon', 'Jupe', 'Short', 'Jupe longue'],
  glasses: ['Aucune', 'Lunettes', 'Rondes', 'Soleil'],
  hat: ['Aucun', 'Casquette', 'Bonnet', 'Casque audio', 'Béret', 'Bandeau'],
};
// Curseurs (0 → 1)
export const SLIDERS = { h: 'Taille', b: 'Corpulence', sh: 'Épaules', lg: 'Longueur des jambes', hd: 'Taille de la tête', es: 'Taille des yeux', ed: 'Écart des yeux', hl: 'Longueur des cheveux', fl: 'Longueur de barbe' };

export const DEFAULT_LOOK = {
  v: 3, sk: '#F5D0B0', hs: 0, hc: '#3B2618', hl: 0.4, ey: 0, ec: '#2A1C14', es: 0.5, ed: 0.5, br: 0, mo: 0, fa: 0, fl: 0.4,
  h: 0.5, b: 0.5, sh: 0.5, lg: 0.5, hd: 0.5,
  to: 3, tc: '#2E3484', t2: '#F4F3F7', bo: 0, bc: '#1F2233', so: '#1F2233',
  gl: 0, ht: 0, ac: '#D6006C', bd: 1, er: 0,
};
const HEX = /^#[0-9a-fA-F]{6}$/;
const LIMS = { hs: OPTIONS.hair, ey: OPTIONS.eyes, br: OPTIONS.brows, mo: OPTIONS.mouth, fa: OPTIONS.facial, to: OPTIONS.top, bo: OPTIONS.bottom, gl: OPTIONS.glasses, ht: OPTIONS.hat };
export function normLook(l) {
  const d = DEFAULT_LOOK, o = {};
  const src = l && typeof l === 'object' && !Array.isArray(l) ? l : {};
  for (const k of Object.keys(d)) {
    const v = src[k], dv = d[k];
    if (typeof dv === 'string') o[k] = typeof v === 'string' && HEX.test(v) ? v : dv;
    else if (k in SLIDERS) o[k] = typeof v === 'number' && v >= 0 && v <= 1 ? Math.round(v * 100) / 100 : dv;
    else { const n = LIMS[k] ? LIMS[k].length : 2; o[k] = Number.isInteger(v) && v >= 0 && v < n ? v : dv; }
  }
  o.v = 3;
  return o;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function randomLook() {
  const r = Math.random;
  return normLook({
    sk: pick(PALETTE.skin), hs: Math.floor(r() * OPTIONS.hair.length), hc: pick(PALETTE.hair), hl: r(), ey: Math.floor(r() * OPTIONS.eyes.length), ec: pick(PALETTE.eyes),
    es: 0.3 + r() * 0.5, ed: 0.3 + r() * 0.4, br: Math.floor(r() * OPTIONS.brows.length), mo: Math.floor(r() * OPTIONS.mouth.length), fa: r() < 0.6 ? 0 : 1 + Math.floor(r() * 4), fl: r(),
    h: r(), b: r(), sh: r(), lg: r(), hd: r(),
    to: Math.floor(r() * OPTIONS.top.length), tc: pick(PALETTE.cloth), t2: pick(PALETTE.cloth), bo: Math.floor(r() * OPTIONS.bottom.length), bc: pick(PALETTE.cloth), so: pick(PALETTE.shoes),
    gl: r() < 0.6 ? 0 : 1 + Math.floor(r() * 3), ht: r() < 0.65 ? 0 : 1 + Math.floor(r() * 5), ac: pick(PALETTE.cloth), bd: r() < 0.5 ? 1 : 0, er: r() < 0.25 ? 1 : 0,
  });
}
export const lookKey = (l) => (l ? JSON.stringify(l) : '');

// ---------- construction ----------
const mats = new Map();
function m(color) { if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.75 })); return mats.get(color); }
const geos = new Map();
function bg(w, h, d) { const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`; if (!geos.has(k)) geos.set(k, new THREE.BoxGeometry(w, h, d)); return geos.get(k); }
function bx(parent, w, h, d, color, x, y, z, rz = 0, ry = 0) {
  const me = new THREE.Mesh(bg(w, h, d), m(color)); me.position.set(x, y, z); if (rz) me.rotation.z = rz; if (ry) me.rotation.y = ry; me.castShadow = true; parent.add(me); return me;
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, v + amt)); return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join(''); }

export function buildAvatar(look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0x1d2050, transparent: true, opacity: 0.16, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; root.add(shadow);
  const av = { root, body, shadow, t: 0, look: null, parts: {}, sitY: -0.37 };
  applyLook(av, look);
  return av;
}

export function applyLook(av, look) {
  const L = normLook(look); av.look = L;
  const B = av.body;
  B.traverse((o) => { if (o.userData.baked) o.geometry.dispose(); });
  while (B.children.length) B.remove(B.children[0]);
  const P = {};
  const skin = L.sk, hair = L.hc, top = L.tc, top2 = L.t2, bot = L.bc, shoes = L.so, acc = L.ac;
  const topS = OPTIONS.top[L.to], botS = OPTIONS.bottom[L.bo];
  // morphologie
  const sy = 0.9 + L.h * 0.2;
  const bw = 0.8 + L.b * 0.48;
  const sw = 0.85 + L.sh * 0.35;
  const lgS = 0.85 + L.lg * 0.3;
  const hdS = 0.85 + L.hd * 0.35;
  B.scale.set(1, sy, 1);
  const thighH = 0.42 * lgS, shinH = 0.32 * lgS;
  const hipY = thighH + shinH + 0.08;
  av.sitY = 0.47 - hipY * sy;
  const torsoH = 0.64, torsoY = hipY + 0.02 + torsoH / 2;
  const shoulderY = hipY + 0.02 + torsoH - 0.06;
  const neckY = hipY + 0.02 + torsoH;
  const tw = 0.56 * bw * 0.6 + 0.56 * sw * 0.4;
  const td = 0.3 * (0.85 + bw * 0.15);

  // ===== jambes =====
  const legW = 0.22 * (0.85 + bw * 0.15);
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set((tw / 2 - legW / 2 - 0.01) * side, hipY, 0); B.add(hip);
    const bareThigh = botS === 'Jupe' || botS === 'Jupe longue' || botS === 'Short';
    bx(hip, legW, thighH, legW * 1.1, bareThigh ? skin : bot, 0, -thighH / 2, 0);
    if (botS === 'Short') bx(hip, legW + 0.02, thighH * 0.55, legW * 1.1 + 0.02, bot, 0, -thighH * 0.27, 0);
    const knee = new THREE.Group(); knee.position.y = -thighH; hip.add(knee);
    bx(knee, legW - 0.01, shinH, legW * 1.05, botS === 'Pantalon' || botS === 'Jupe longue' ? bot : skin, 0, -shinH / 2, 0);
    if (botS === 'Pantalon') bx(knee, legW + 0.005, 0.05, legW * 1.1, shade(bot, -18), 0, -shinH + 0.03, 0);
    bx(knee, legW + 0.02, 0.1, 0.34, shoes, 0, -shinH - 0.03, 0.04);
    bx(knee, legW + 0.03, 0.03, 0.35, shade(shoes, 50), 0, -shinH - 0.085, 0.04);
    bx(knee, legW * 0.5, 0.02, 0.012, shade(shoes, 40), 0, -shinH - 0.02, 0.215);
    P[side < 0 ? 'hipL' : 'hipR'] = hip; P[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  if (botS === 'Jupe') { bx(B, tw + 0.06, 0.34, td + 0.1, bot, 0, hipY - 0.14, 0); bx(B, tw + 0.1, 0.06, td + 0.14, shade(bot, -12), 0, hipY - 0.3, 0); }
  if (botS === 'Jupe longue') { bx(B, tw + 0.08, 0.5, td + 0.12, bot, 0, hipY - 0.22, 0); bx(B, tw + 0.14, 0.32, td + 0.18, bot, 0, hipY - 0.6, 0); }
  bx(B, tw + 0.02, 0.09, td + 0.02, shade(bot, -30), 0, hipY + 0.02, 0);
  bx(B, 0.07, 0.05, 0.01, '#C9B27A', 0, hipY + 0.02, td / 2 + 0.012);

  // ===== buste =====
  const F = td / 2 + 0.006;
  const long = !['T-shirt', 'Polo', 'Débardeur'].includes(topS);
  bx(B, tw, torsoH, td, topS === 'Gilet' ? top2 : top, 0, torsoY, 0);
  switch (topS) {
    case 'T-shirt': bx(B, 0.22, 0.04, 0.01, shade(top, -22), 0, neckY - 0.04, F); break;
    case 'Débardeur': bx(B, 0.26, 0.1, 0.01, skin, 0, neckY - 0.06, F); for (const s of [-1, 1]) bx(B, 0.08, 0.1, td + 0.005, skin, s * (tw / 2 - 0.04), neckY - 0.05, 0); break;
    case 'Chemise': case 'Polo': {
      for (const s of [-1, 1]) bx(B, 0.15, 0.06, 0.05, topS === 'Polo' ? top2 : shade(top, 22), s * 0.08, neckY - 0.03, F - 0.01, -s * 0.35);
      const pl = topS === 'Polo' ? 0.18 : torsoH - 0.06;
      bx(B, 0.035, pl, 0.008, shade(top, -25), 0, neckY - 0.02 - pl / 2, F);
      for (let i = 0; i < (topS === 'Polo' ? 2 : 5); i++) bx(B, 0.02, 0.02, 0.01, shade(top, 55), 0, neckY - 0.08 - i * 0.11, F + 0.004);
      if (topS === 'Chemise') bx(B, 0.1, 0.09, 0.008, shade(top, -12), tw * 0.25, torsoY + 0.12, F);
      break;
    }
    case 'Col roulé': bx(B, 0.3, 0.12, 0.28, shade(top, -12), 0, neckY + 0.02, 0); break;
    case 'Blazer':
      bx(B, 0.16, torsoH - 0.04, 0.01, top2, 0, torsoY + 0.01, F);
      for (const s of [-1, 1]) { bx(B, 0.07, 0.34, 0.025, shade(top, -20), s * 0.11, neckY - 0.18, F + 0.005, -s * 0.28); bx(B, 0.12, 0.025, 0.012, shade(top, -25), s * tw * 0.27, torsoY - 0.17, F + 0.002); }
      bx(B, tw + 0.02, 0.07, td + 0.02, shade(top, -12), 0, hipY + 0.06, 0);
      bx(B, 0.02, 0.02, 0.01, '#C9B27A', 0.02, torsoY - 0.08, F + 0.008);
      bx(B, 0.07, 0.04, 0.01, top2, -tw * 0.27, torsoY + 0.13, F + 0.004);
      break;
    case 'Sweat à capuche':
      bx(B, 0.42, 0.2, 0.14, shade(top, -14), 0, neckY - 0.02, -td / 2 - 0.05);
      bx(B, tw * 0.62, 0.13, 0.012, shade(top, -14), 0, torsoY - 0.18, F);
      for (const s of [-1, 1]) bx(B, 0.02, 0.2, 0.01, top2, s * 0.06, neckY - 0.14, F + 0.004);
      bx(B, tw + 0.02, 0.07, td + 0.02, shade(top, -20), 0, hipY + 0.06, 0);
      break;
    case 'Gilet':
      for (const s of [-1, 1]) bx(B, tw * 0.36, torsoH - 0.02, 0.02, top, s * tw * 0.32, torsoY, F);
      for (let i = 0; i < 4; i++) bx(B, 0.022, 0.022, 0.01, shade(top, 40), tw * 0.15, torsoY + 0.2 - i * 0.13, F + 0.012);
      break;
  }
  if (L.bd) {
    for (const s of [-1, 1]) bx(B, 0.024, 0.3, 0.008, BRAND.rose, s * 0.08, neckY - 0.17, F + 0.014, s * 0.28);
    bx(B, 0.13, 0.17, 0.014, '#ffffff', 0, torsoY - 0.07, F + 0.02);
    bx(B, 0.09, 0.03, 0.004, BRAND.navy, 0, torsoY - 0.03, F + 0.029);
    bx(B, 0.05, 0.015, 0.004, BRAND.rose, 0, torsoY - 0.07, F + 0.029);
  }
  // ===== bras =====
  const armW = 0.17 * (0.85 + bw * 0.15);
  for (const side of [-1, 1]) {
    const shG = new THREE.Group(); shG.position.set((tw / 2 + armW / 2 + 0.005) * side, shoulderY, 0); B.add(shG);
    bx(shG, armW, 0.28, armW + 0.02, topS === 'Débardeur' ? skin : top, 0, -0.13, 0);
    bx(shG, armW - 0.01, 0.27, armW, long ? top : skin, 0, -0.4, 0);
    if (!long && topS !== 'Débardeur') bx(shG, armW + 0.01, 0.04, armW + 0.03, shade(top, -18), 0, -0.26, 0);
    if (long) bx(shG, armW + 0.005, 0.04, armW + 0.01, topS === 'Blazer' ? top2 : shade(top, -15), 0, -0.53, 0);
    bx(shG, armW - 0.02, 0.13, armW - 0.01, skin, 0, -0.61, 0);
    bx(shG, 0.04, 0.06, 0.05, shade(skin, -12), -side * (armW / 2 - 0.01), -0.6, 0.05);
    P[side < 0 ? 'armL' : 'armR'] = shG;
  }

  // ===== tête =====
  const head = new THREE.Group(); head.position.y = neckY + 0.01; head.scale.setScalar(hdS); B.add(head); P.head = head;
  const HS = 0.46, hy = HS / 2 + 0.04, HF = HS / 2 + 0.003;
  bx(head, 0.14, 0.06, 0.14, skin, 0, 0.02, 0);
  bx(head, HS, HS, HS * 0.96, skin, 0, hy, 0);
  for (const s of [-1, 1]) bx(head, 0.05, 0.1, 0.08, skin, s * (HS / 2 + 0.02), hy, 0);
  bx(head, 0.06, 0.08, 0.05, shade(skin, -16), 0, hy - 0.03, HF + 0.02);
  const eS = 0.7 + L.es * 0.7, eX = 0.07 + L.ed * 0.06, eY = hy + 0.04;
  for (const s of [-1, 1]) {
    const ex = s * eX;
    switch (OPTIONS.eyes[L.ey]) {
      case 'Fins': bx(head, 0.09 * eS, 0.025, 0.02, '#1a1a2a', ex, eY, HF); break;
      case 'Rieurs': bx(head, 0.03 * eS, 0.025, 0.02, '#1a1a2a', ex - 0.03 * eS, eY - 0.005, HF); bx(head, 0.03 * eS, 0.025, 0.02, '#1a1a2a', ex, eY + 0.012, HF); bx(head, 0.03 * eS, 0.025, 0.02, '#1a1a2a', ex + 0.03 * eS, eY - 0.005, HF); break;
      case 'Pixel': bx(head, 0.06 * eS, 0.07 * eS, 0.02, '#1a1a2a', ex, eY, HF); break;
      default:
        bx(head, 0.085 * eS, 0.09 * eS, 0.015, '#ffffff', ex, eY, HF - 0.002);
        bx(head, 0.05 * eS, 0.065 * eS, 0.02, L.ec, ex + s * 0.006, eY - 0.005, HF);
        bx(head, 0.02 * eS, 0.02 * eS, 0.01, '#ffffff', ex + 0.012, eY + 0.018 * eS, HF + 0.008);
        if (OPTIONS.eyes[L.ey] === 'Cils') { bx(head, 0.035, 0.018, 0.02, '#1a1a2a', ex + s * 0.05 * eS, eY + 0.04 * eS, HF, -s * 0.6); bx(head, 0.09 * eS, 0.016, 0.02, '#1a1a2a', ex, eY + 0.048 * eS, HF); }
    }
  }
  const brS = OPTIONS.brows[L.br];
  for (const s of [-1, 1]) bx(head, 0.1, brS === 'Épais' ? 0.035 : 0.02, 0.02, hair, s * eX, eY + 0.075 * Math.max(1, eS * 0.9), HF, brS === 'Arqués' ? -s * 0.25 : brS === 'Froncés' ? s * 0.3 : 0);
  for (const s of [-1, 1]) bx(head, 0.07, 0.035, 0.01, '#FFA3B1', s * (eX + 0.05), eY - 0.08, HF);
  const mo = OPTIONS.mouth[L.mo], mY = hy - 0.12;
  const mouth = new THREE.Group(); mouth.position.set(0, mY, HF); head.add(mouth); P.mouth = mouth;
  if (mo === 'Sourire') { bx(mouth, 0.1, 0.025, 0.02, '#8a3a3a', 0, 0, 0); for (const s of [-1, 1]) bx(mouth, 0.025, 0.025, 0.02, '#8a3a3a', s * 0.06, 0.018, 0); }
  else if (mo === 'Grand sourire') { bx(mouth, 0.14, 0.05, 0.02, '#6a2a2a', 0, 0, 0); bx(mouth, 0.12, 0.018, 0.022, '#ffffff', 0, 0.014, 0); for (const s of [-1, 1]) bx(mouth, 0.025, 0.025, 0.02, '#6a2a2a', s * 0.08, 0.025, 0); }
  else if (mo === 'Petit') bx(mouth, 0.05, 0.03, 0.02, '#8a3a3a', 0, 0, 0);
  else bx(mouth, 0.12, 0.022, 0.02, '#8a3a3a', 0, 0, 0);
  const fa = OPTIONS.facial[L.fa], fl = 0.06 + L.fl * 0.22;
  if (fa === 'Barbe') { bx(head, HS + 0.01, 0.12 + fl * 0.4, 0.1, hair, 0, hy - HS / 2 + 0.02 - fl * 0.2, HF - 0.03); for (const s of [-1, 1]) bx(head, 0.05, 0.24, HS * 0.7, hair, s * (HS / 2 - 0.02), hy - 0.06, 0.04); bx(head, 0.14, 0.03, 0.02, hair, 0, mY + 0.035, HF + 0.008); }
  else if (fa === 'Moustache') { bx(head, 0.16, 0.035, 0.025, hair, 0, mY + 0.04, HF + 0.008); for (const s of [-1, 1]) bx(head, 0.03, 0.04 + fl * 0.15, 0.02, hair, s * 0.08, mY + 0.03 - fl * 0.07, HF + 0.008); }
  else if (fa === 'Bouc') { bx(head, 0.1, 0.06 + fl * 0.35, 0.05, hair, 0, hy - HS / 2 - fl * 0.15, HF - 0.01); bx(head, 0.12, 0.03, 0.02, hair, 0, mY + 0.04, HF + 0.008); }
  else if (fa === 'Collier') { bx(head, HS + 0.01, 0.06 + fl * 0.15, 0.08, hair, 0, hy - HS / 2 + 0.01, HF - 0.03); for (const s of [-1, 1]) bx(head, 0.04, 0.2, HS * 0.6, hair, s * (HS / 2 - 0.01), hy - 0.08, 0.05); }

  // ===== cheveux =====
  const hl = L.hl;
  const H = (w, h, d, x, y, z, rz = 0) => bx(head, w, h, d, hair, x, y, z, rz);
  const T = hy + HS / 2;
  const top0 = () => { H(HS + 0.04, 0.1, HS + 0.02, 0, T + 0.03, 0); };
  const backH = (len) => H(HS + 0.04, len, 0.1, 0, T - len / 2 + 0.02, -HS / 2 - 0.02);
  const sides = (len) => { for (const s of [-1, 1]) H(0.05, len, HS * 0.86, s * (HS / 2 + 0.02), T - len / 2, -0.03); };
  const fringe = (h = 0.07) => H(HS + 0.02, h, 0.06, 0, T - h / 2 + 0.01, HS / 2 - 0.01);
  switch (OPTIONS.hair[L.hs]) {
    case 'Court': top0(); backH(0.16 + hl * 0.16); sides(0.12 + hl * 0.06); fringe(0.05 + hl * 0.04); break;
    case 'Long': top0(); backH(0.32 + hl * 0.5); sides(0.3 + hl * 0.4); fringe(0.06); break;
    case 'Crête': H(0.12, 0.14 + hl * 0.2, HS + 0.04, 0, T + 0.06 + hl * 0.08, 0); for (const s of [-1, 1]) H(0.01, 0.12, HS * 0.8, s * (HS / 2 + 0.005), T - 0.1, -0.03); break;
    case 'Chignon': top0(); backH(0.22); sides(0.12); fringe(0.05); H(0.2 + hl * 0.08, 0.2 + hl * 0.08, 0.2 + hl * 0.08, 0, T + 0.13, -0.12); bx(head, 0.22, 0.04, 0.04, acc, 0, T + 0.06, -0.12); break;
    case 'Rasé': H(HS + 0.02, 0.03, HS + 0.01, 0, T + 0.005, 0); backH(0.16); break;
    case 'Bouclé': top0(); backH(0.26 + hl * 0.2); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if ((i + j) % 2 === 0) H(0.12, 0.12, 0.12, i * 0.11, T + 0.1 + (Math.abs(i * j) % 2) * 0.03, j * 0.1); sides(0.2 + hl * 0.12); break;
    case 'Carré': top0(); backH(0.3 + hl * 0.14); sides(0.3 + hl * 0.14); fringe(0.09); break;
    case 'Queue': top0(); backH(0.18); sides(0.12); fringe(0.05); bx(head, 0.1, 0.08, 0.08, acc, 0, T - 0.12, -HS / 2 - 0.08); H(0.1, 0.24 + hl * 0.4, 0.1, 0, T - 0.24 - hl * 0.2, -HS / 2 - 0.1); break;
    case 'Dégradé': H(HS + 0.02, 0.12 + hl * 0.08, HS + 0.01, 0, T + 0.05, 0); bx(head, HS + 0.025, 0.18, HS * 0.98, shade(hair, 35), 0, T - 0.12, -0.005); break;
    case 'Mèche': top0(); backH(0.18); sides(0.12); H(0.32, 0.08, 0.1, 0.05, T - 0.02, HS / 2 + 0.01, -0.35); H(0.2, 0.06 + hl * 0.08, 0.08, 0.14, T - 0.08 - hl * 0.04, HS / 2 + 0.02, -0.6); break;
    case 'Afro': { const r = 0.62 + hl * 0.2; H(r, 0.32 + hl * 0.12, r * 0.95, 0, T + 0.1, -0.03); H(r + 0.04, 0.22, r * 0.7, 0, T - 0.12, -0.15); fringe(0.05); break; }
    case 'Couettes': top0(); backH(0.18); fringe(0.07); for (const s of [-1, 1]) { bx(head, 0.06, 0.06, 0.06, acc, s * (HS / 2 + 0.06), T - 0.12, -0.06); H(0.11, 0.2 + hl * 0.4, 0.11, s * (HS / 2 + 0.09), T - 0.25 - hl * 0.2, -0.06); } break;
  }
  // ===== accessoires =====
  const gz = HF + 0.02, gy = eY;
  switch (OPTIONS.glasses[L.gl]) {
    case 'Lunettes': for (const s of [-1, 1]) { bx(head, 0.13, 0.025, 0.02, acc, s * eX, gy + 0.055, gz); bx(head, 0.13, 0.02, 0.02, acc, s * eX, gy - 0.05, gz); bx(head, 0.02, 0.1, 0.02, acc, s * (eX + 0.055), gy, gz); bx(head, 0.02, 0.1, 0.02, acc, s * (eX - 0.055), gy, gz); bx(head, 0.015, 0.02, HS * 0.55, acc, s * (HS / 2 + 0.01), gy + 0.05, gz - HS * 0.28); } bx(head, Math.max(0.02, eX * 2 - 0.11), 0.02, 0.02, acc, 0, gy + 0.04, gz); break;
    case 'Rondes': for (const s of [-1, 1]) { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; bx(head, 0.03, 0.03, 0.02, acc, s * eX + Math.cos(a) * 0.055, gy + Math.sin(a) * 0.055, gz); } bx(head, 0.015, 0.02, HS * 0.55, acc, s * (HS / 2 + 0.01), gy + 0.03, gz - HS * 0.28); } bx(head, Math.max(0.02, eX * 2 - 0.11), 0.02, 0.02, acc, 0, gy + 0.02, gz); break;
    case 'Soleil': for (const s of [-1, 1]) { bx(head, 0.15, 0.1, 0.02, '#151522', s * eX, gy, gz); bx(head, 0.015, 0.02, HS * 0.55, acc, s * (HS / 2 + 0.01), gy + 0.04, gz - HS * 0.28); } bx(head, HS + 0.02, 0.025, 0.02, acc, 0, gy + 0.05, gz + 0.002); break;
  }
  switch (OPTIONS.hat[L.ht]) {
    case 'Casquette': bx(head, HS + 0.06, 0.16, HS + 0.04, acc, 0, T + 0.06, 0); bx(head, HS, 0.04, 0.22, acc, 0, T - 0.01, HS / 2 + 0.11); bx(head, 0.06, 0.03, 0.06, shade(acc, -35), 0, T + 0.155, 0); break;
    case 'Bonnet': bx(head, HS + 0.06, 0.22, HS + 0.06, acc, 0, T + 0.05, 0); bx(head, HS + 0.08, 0.07, HS + 0.08, shade(acc, -25), 0, T - 0.05, 0); bx(head, 0.13, 0.13, 0.13, '#F4F3F7', 0, T + 0.22, 0); break;
    case 'Casque audio': bx(head, HS + 0.12, 0.06, 0.1, '#22242e', 0, T + 0.07, 0); for (const s of [-1, 1]) { bx(head, 0.06, 0.24, 0.08, '#22242e', s * (HS / 2 + 0.06), T - 0.08, 0); bx(head, 0.09, 0.2, 0.2, '#22242e', s * (HS / 2 + 0.06), hy, 0); bx(head, 0.02, 0.14, 0.14, acc, s * (HS / 2 + 0.11), hy, 0); } break;
    case 'Béret': bx(head, HS + 0.12, 0.09, HS + 0.08, acc, 0.03, T + 0.06, 0, -0.12); bx(head, 0.04, 0.05, 0.04, shade(acc, -30), 0.03, T + 0.13, 0); break;
    case 'Bandeau': bx(head, HS + 0.06, 0.07, HS + 0.04, acc, 0, T - 0.06, 0); break;
  }
  if (L.er) for (const s of [-1, 1]) { bx(head, 0.03, 0.03, 0.03, '#E8C25A', s * (HS / 2 + 0.05), hy - 0.07, 0.01); bx(head, 0.04, 0.06, 0.04, acc, s * (HS / 2 + 0.05), hy - 0.12, 0.01); }

  av.parts = P;
  av.root.updateMatrixWorld(true);
  for (const grp of [B, P.hipL, P.hipR, P.kneeL, P.kneeR, P.armL, P.armR, head, mouth]) bake(grp, new Set(grp === head ? [mouth] : []));
}

// Fusion d'une partie articulée en un seul maillage à couleurs par sommet
const avMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
const _inv = new THREE.Matrix4(), _mm = new THREE.Matrix4();
function bake(group, skip) {
  const meshes = [];
  const walk = (o) => { for (const c of o.children) { if (c.isGroup || skip.has(c)) continue; if (c.isMesh) { meshes.push(c); walk(c); } } };
  walk(group);
  if (!meshes.length) return;
  _inv.copy(group.matrixWorld).invert();
  const parts = [];
  for (const me of meshes) {
    const g2 = me.geometry.index ? me.geometry.toNonIndexed() : me.geometry.clone();
    for (const n of Object.keys(g2.attributes)) if (n !== 'position' && n !== 'normal') g2.deleteAttribute(n);
    _mm.multiplyMatrices(_inv, me.matrixWorld); g2.applyMatrix4(_mm);
    const c = me.material.color, n = g2.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g2.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g2);
  }
  for (const me of meshes) if (me.parent) me.parent.remove(me);
  const merged = mergeGeometries(parts); parts.forEach((p) => p.dispose());
  const mesh = new THREE.Mesh(merged, avMat); mesh.castShadow = true; mesh.userData.baked = true; group.add(mesh);
}

export function animateAvatar(av, dt, st) {
  const P = av.parts;
  if (st.moving && !st.sitting) av.t += dt * (7 + (st.speed || 3) * 1.2); else av.t *= 0.9;
  const sw = st.moving && !st.sitting ? Math.sin(av.t) * 0.55 : 0;
  const lerp = (o, k, v) => { o[k] += (v - o[k]) * Math.min(1, dt * 14); };
  if (st.sitting) {
    lerp(P.hipL.rotation, 'x', -Math.PI / 2); lerp(P.hipR.rotation, 'x', -Math.PI / 2);
    lerp(P.kneeL.rotation, 'x', Math.PI / 2); lerp(P.kneeR.rotation, 'x', Math.PI / 2);
    lerp(P.armL.rotation, 'x', -0.5); lerp(P.armR.rotation, 'x', -0.5);
    lerp(av.body.position, 'y', av.sitY);
  } else {
    lerp(P.hipL.rotation, 'x', sw); lerp(P.hipR.rotation, 'x', -sw);
    lerp(P.kneeL.rotation, 'x', Math.max(0, -sw) * 0.5); lerp(P.kneeR.rotation, 'x', Math.max(0, sw) * 0.5);
    lerp(P.armL.rotation, 'x', -sw * 0.8); lerp(P.armR.rotation, 'x', sw * 0.8);
    const breathe = Math.sin(performance.now() / 700) * 0.006;
    av.body.position.y = st.moving ? Math.abs(Math.cos(av.t)) * 0.05 : av.body.position.y * 0.8 + breathe;
  }
  const now = performance.now();
  const tk = st.talking ? Math.sin(now / 90) * 0.05 : 0;
  P.head.rotation.x += (tk - P.head.rotation.x) * 0.3;
  if (P.mouth) P.mouth.scale.y = st.talking ? 1 + Math.abs(Math.sin(now / 70)) * 1.8 : 1;
}

export function makeLabel(name) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 96;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
  sp.scale.set(1.7, 0.425, 1); sp.position.y = 2.42; sp.renderOrder = 10;
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
