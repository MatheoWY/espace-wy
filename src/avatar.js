// Avatars low poly stylisés (facettes, formes arrondies) : morphologie, visage, coiffure, tenue, accessoires.
import * as THREE from 'three';
import { FONT_TEXT, BRAND } from './world.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
export const L = { skin: 0, hair: 1, hairColor: 2, topColor: 3, bottomColor: 4, acc: 5, height: 6, build: 7, eyes: 8, brows: 9, facial: 10, top: 11, top2Color: 12, bottom: 13, shoes: 14, accColor: 15 };
export const DEFAULT_LOOK = [1, 0, 1, 1, 4, 7, 1, 1, 0, 0, 0, 3, 3, 0, 0, 0];
const LIMITS = () => [PALETTE.skin.length, OPTIONS.hair.length, PALETTE.hair.length, PALETTE.cloth.length, PALETTE.cloth.length, OPTIONS.acc.length,
  OPTIONS.height.length, OPTIONS.build.length, OPTIONS.eyes.length, OPTIONS.brows.length, OPTIONS.facial.length, OPTIONS.top.length, PALETTE.cloth.length,
  OPTIONS.bottom.length, PALETTE.shoes.length, PALETTE.cloth.length];
export function normLook(l) {
  const lim = LIMITS(), src = Array.isArray(l) ? l : DEFAULT_LOOK;
  return lim.map((n, i) => { const v = Number(src[i]); return Number.isInteger(v) && v >= 0 && v < n ? v : DEFAULT_LOOK[i]; });
}
export function randomLook() { return LIMITS().map((n) => Math.floor(Math.random() * n)); }

// ---------- matériaux & géométries ----------
const mats = new Map();
function m(color, rough = 0.75, flat = true) {
  const k = color + rough + flat;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: flat }));
  return mats.get(k);
}
const geos = new Map();
const G = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const cylG = (rt, rb, h, s = 7) => G(`c${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const sphG = (r, w = 8, h = 6, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => G(`s${r}|${w}|${h}|${ps}|${pl}|${ts}|${tl}`, () => new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl));
const icoG = (r, d = 0) => G(`i${r}|${d}`, () => new THREE.IcosahedronGeometry(r, d));
const boxG = (w, h, d) => G(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const coneG = (r, h, s = 6) => G(`k${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const torG = (r, t, rs = 5, ts = 10, arc = Math.PI * 2) => G(`t${r}|${t}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const halfCylG = (rt, rb, h, ts, tl, s = 10) => G(`h${rt}|${rb}|${h}|${ts}|${tl}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, false, ts, tl));

function add(parent, geo, color, x = 0, y = 0, z = 0, opts = {}) {
  const me = new THREE.Mesh(geo, m(color, opts.rough ?? 0.75, opts.flat ?? true));
  me.position.set(x, y, z);
  if (opts.s) me.scale.set(...opts.s);
  if (opts.r) me.rotation.set(...opts.r);
  me.castShadow = true; parent.add(me); return me;
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, v + amt)); return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join(''); }

export function buildAvatar(look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 18), new THREE.MeshBasicMaterial({ color: 0x1d2050, transparent: true, opacity: 0.16, depthWrite: false }));
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
  const B = av.body;
  B.traverse((o) => { if (o.userData.baked) o.geometry.dispose(); });
  while (B.children.length) B.remove(B.children[0]);
  const P = {};
  const bw = [0.88, 1, 1.18][g('build')];
  B.scale.set(1, [0.93, 1, 1.07][g('height')], 1);
  const skinD = shade(skin, -18);

  // ===== Jambes =====
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.12 * side * bw, 0.84, 0); B.add(hip);
    const thigh = botStyle === 'Jupe' ? skin : bottom;
    add(hip, cylG(0.105 * bw, 0.088, 0.44, 7), thigh, 0, -0.22, 0);
    const knee = new THREE.Group(); knee.position.y = -0.43; hip.add(knee);
    add(knee, sphG(0.09, 7, 5), botStyle === 'Pantalon' ? bottom : skin, 0, 0, 0);
    add(knee, cylG(0.088, 0.072, 0.34, 7), botStyle === 'Pantalon' ? bottom : skin, 0, -0.17, 0);
    if (botStyle === 'Pantalon') add(knee, cylG(0.083, 0.083, 0.05, 7), shade(bottom, -20), 0, -0.33, 0);
    // chaussure arrondie
    add(knee, sphG(0.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), shoes, 0, -0.37, 0.05, { s: [0.95, 0.75, 1.55], rough: 0.45 });
    add(knee, cylG(0.098, 0.1, 0.035, 9), shade(shoes, 45), 0, -0.385, 0.05, { s: [1, 1, 1.55] });
    P[side < 0 ? 'hipL' : 'hipR'] = hip; P[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  // Bassin
  add(B, cylG(0.255 * bw, 0.235 * bw, 0.18, 9), botStyle === 'Jupe' ? bottom : bottom, 0, 0.86, 0, { s: [1, 1, 0.72] });
  if (botStyle === 'Jupe') add(B, cylG(0.25 * bw, 0.34 * bw, 0.36, 10), bottom, 0, 0.7, 0, { s: [1, 1, 0.78] });
  if (botStyle === 'Short') for (const s of [-1, 1]) add(B, cylG(0.115 * bw, 0.12 * bw, 0.2, 7), bottom, 0.12 * s * bw, 0.72, 0);
  add(B, cylG(0.262 * bw, 0.262 * bw, 0.05, 9), shade(bottom, -35), 0, 0.95, 0, { s: [1, 1, 0.74] }); // ceinture
  add(B, boxG(0.06, 0.04, 0.02), '#C9B27A', 0, 0.95, 0.19); // boucle

  // ===== Buste =====
  const torso = add(B, cylG(0.3 * bw, 0.24 * bw, 0.58, 9), top, 0, 1.25, 0, { s: [1, 1, 0.66] });
  add(B, sphG(0.3 * bw, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), top, 0, 1.53, 0, { s: [1, 0.32, 0.66] }); // épaules
  add(B, cylG(0.075, 0.085, 0.12, 7), skin, 0, 1.6, 0); // cou
  const front = 0.66 * 0.3 * bw * 0.93; // avant du buste
  if (topStyle === 'Chemise' || topStyle === 'Polo') {
    for (const s of [-1, 1]) add(B, coneG(0.06, 0.11, 3), topStyle === 'Polo' ? top2 : shade(top, 22), s * 0.06, 1.56, 0.11, { r: [-1.1, 0, s * 0.6] });
    add(B, boxG(0.035, topStyle === 'Polo' ? 0.16 : 0.52, 0.01), shade(top, -25), 0, topStyle === 'Polo' ? 1.47 : 1.27, front - 0.004);
    const nb = topStyle === 'Polo' ? 2 : 5;
    for (let i = 0; i < nb; i++) add(B, sphG(0.012, 5, 4), shade(top, 50), 0, 1.5 - i * 0.1, front + 0.008);
    if (topStyle === 'Chemise') add(B, boxG(0.1, 0.08, 0.01), shade(top, -15), 0.12 * bw, 1.4, front - 0.01);
  } else if (topStyle === 'Col roulé') {
    add(B, cylG(0.095, 0.11, 0.13, 9), shade(top, -10), 0, 1.6, 0);
    for (let i = 0; i < 3; i++) add(B, torG(0.1, 0.012, 4, 10), shade(top, -25), 0, 1.56 + i * 0.035, 0, { r: [Math.PI / 2, 0, 0] });
  } else if (topStyle === 'Blazer') {
    add(B, boxG(0.16, 0.56, 0.01), top2, 0, 1.27, front + 0.002);
    for (const s of [-1, 1]) {
      add(B, boxG(0.07, 0.34, 0.025), shade(top, -18), s * 0.1, 1.42, front + 0.006, { r: [0, 0, -s * 0.3] });
      add(B, boxG(0.1, 0.02, 0.02), shade(top, -25), s * 0.15, 1.08, front); // poches
    }
    add(B, cylG(0.302 * bw, 0.27 * bw, 0.12, 9), top, 0, 0.98, 0, { s: [1, 1, 0.68] }); // basque
    add(B, sphG(0.014, 5, 4), '#C9B27A', 0.04, 1.12, front + 0.012);
    add(B, coneG(0.04, 0.03, 3), top2, -0.17 * bw, 1.43, front + 0.004, { r: [0, 0, Math.PI] }); // pochette
  } else if (topStyle === 'Sweat à capuche') {
    add(B, sphG(0.17, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), shade(top, -14), 0, 1.58, -0.12, { s: [1.15, 0.7, 0.9], r: [-0.5, 0, 0] });
    add(B, boxG(0.3, 0.12, 0.012), shade(top, -15), 0, 1.07, front - 0.012);
    for (const s of [-1, 1]) add(B, cylG(0.007, 0.007, 0.2, 4), top2, s * 0.05, 1.45, front + 0.004);
    add(B, cylG(0.262 * bw, 0.25 * bw, 0.07, 9), shade(top, -20), 0, 0.99, 0, { s: [1, 1, 0.7] });
  } else {
    add(B, torG(0.085, 0.015, 4, 10, Math.PI), shade(top, -22), 0, 1.565, 0.02, { r: [Math.PI / 2 + 0.25, 0, 0] });
  }
  // badge
  if (OPTIONS.acc[g('acc')] === 'Badge Work&You') {
    for (const s of [-1, 1]) add(B, boxG(0.022, 0.32, 0.008), BRAND.rose, s * 0.08, 1.39, front + 0.012, { r: [0, 0, s * 0.28] });
    add(B, boxG(0.13, 0.17, 0.012), '#ffffff', 0, 1.15, front + 0.02, { rough: 0.4 });
    add(B, boxG(0.09, 0.03, 0.004), BRAND.navy, 0, 1.19, front + 0.028);
    add(B, boxG(0.05, 0.015, 0.004), BRAND.rose, 0, 1.15, front + 0.028);
    add(B, sphG(0.025, 6, 4), '#E9ECF7', 0, 1.1, front + 0.026);
  }

  // ===== Bras =====
  const long = !['T-shirt', 'Polo'].includes(topStyle);
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set((0.27 * bw + 0.06) * side, 1.47, 0); B.add(sh);
    add(sh, sphG(0.095 * bw, 7, 5), top, 0, 0, 0);
    add(sh, cylG(0.08 * bw, 0.07, 0.3, 7), top, 0, -0.16, 0);
    const elbowCol = long ? top : skin;
    add(sh, sphG(0.068, 6, 4), elbowCol, 0, -0.31, 0);
    add(sh, cylG(0.068, 0.056, 0.26, 7), long ? top : skin, 0, -0.44, 0);
    if (!long) add(sh, cylG(0.084 * bw, 0.084 * bw, 0.04, 7), shade(top, -18), 0, -0.29, 0); // revers manche
    if (long) add(sh, cylG(0.06, 0.06, 0.04, 7), topStyle === 'Blazer' ? top2 : shade(top, -15), 0, -0.56, 0);
    const hand = add(sh, icoG(0.062, 1), skin, 0, -0.62, 0.01, { s: [0.85, 1.1, 0.9] });
    add(hand, sphG(0.022, 5, 4), skinD, -0.045 * side, 0.01, 0.03); // pouce
    P[side < 0 ? 'armL' : 'armR'] = sh;
  }

  // ===== Tête =====
  const head = new THREE.Group(); head.position.y = 1.64; B.add(head); P.head = head;
  const HR = 0.235;
  add(head, sphG(HR, 10, 7), skin, 0, HR, 0, { s: [1, 1.06, 0.98] });
  add(head, sphG(HR * 0.82, 10, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), skin, 0, HR * 0.92, 0.02, { s: [1, 1, 1.05] }); // mâchoire
  for (const s of [-1, 1]) add(head, sphG(0.05, 6, 5), skin, s * HR * 0.98, HR * 0.98, -0.01, { s: [0.6, 1, 0.8] });
  add(head, coneG(0.034, 0.08, 5), skinD, 0, HR * 0.92, HR * 0.98, { r: [Math.PI / 2 - 0.25, 0, 0] }); // nez
  const ez = HR * 0.88, ey = HR * 1.12;
  const eyeStyle = OPTIONS.eyes[g('eyes')];
  for (const s of [-1, 1]) {
    const ex = s * 0.085;
    if (eyeStyle === 'Rieurs') add(head, torG(0.028, 0.008, 4, 8, Math.PI), '#1a1a2a', ex, ey - 0.01, ez + 0.03);
    else if (eyeStyle === 'Fins') add(head, boxG(0.06, 0.016, 0.01), '#1a1a2a', ex, ey, ez + 0.035, { r: [0, s * 0.25, 0] });
    else {
      const big = eyeStyle === 'Grands';
      add(head, sphG(big ? 0.042 : 0.034, 6, 4), '#ffffff', ex, ey, ez, { s: [1, 1.2, 0.6], rough: 0.3, flat: false });
      add(head, sphG(big ? 0.028 : 0.022, 6, 4), '#2a1c14', ex, ey - 0.003, ez + 0.02, { s: [1, 1.2, 0.6], rough: 0.2, flat: false });
      add(head, sphG(0.007, 4, 3), '#ffffff', ex + 0.008, ey + 0.012, ez + 0.033);
      if (eyeStyle === 'Cils') for (let k = 0; k < 2; k++) add(head, boxG(0.03, 0.008, 0.008), '#1a1a2a', ex + s * (0.03 + k * 0.012), ey + 0.03 - k * 0.012, ez + 0.02, { r: [0, 0, -s * (0.6 + k * 0.3)] });
    }
  }
  const browStyle = OPTIONS.brows[g('brows')];
  for (const s of [-1, 1]) add(head, boxG(0.085, browStyle === 'Épais' ? 0.028 : 0.016, 0.02), hair, s * 0.088, ey + 0.065, ez + 0.02, { r: [0, s * 0.25, browStyle === 'Arqués' ? -s * 0.22 : -s * 0.05] });
  for (const s of [-1, 1]) { const ck = add(head, sphG(0.035, 6, 4), '#FF8FA3', s * 0.12, ey - 0.075, ez - 0.015, { s: [1, 0.6, 0.3] }); ck.material = new THREE.MeshStandardMaterial({ color: '#FF8FA3', transparent: true, opacity: 0.45, roughness: 1 }); }
  const mouth = add(head, torG(0.04, 0.009, 4, 8, Math.PI), '#8a3a3a', 0, HR * 0.6, HR * 0.86, { r: [0, 0, Math.PI] }); P.mouth = mouth;
  // pilosité
  const facial = OPTIONS.facial[g('facial')];
  if (facial === 'Barbe courte' || facial === 'Barbe longue') {
    const lg = facial === 'Barbe longue';
    add(head, sphG(HR * 1.02, 12, 8, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.5, Math.PI * 0.42), hair, 0, HR * 1.0, 0.0, { s: [1.01, lg ? 1.35 : 1.04, 1.06], r: [0, Math.PI, 0] });
    add(head, boxG(0.12, 0.025, 0.03), hair, 0, HR * 0.72, HR * 0.93);
    mouth.position.z = HR * 0.98;
  } else if (facial === 'Moustache') { for (const s of [-1, 1]) add(head, sphG(0.035, 6, 4), hair, s * 0.032, HR * 0.72, HR * 0.94, { s: [1.3, 0.6, 0.6], r: [0, 0, s * 0.3] }); }
  else if (facial === 'Bouc') { add(head, coneG(0.045, 0.09, 6), hair, 0, HR * 0.38, HR * 0.84, { r: [Math.PI + 0.2, 0, 0] }); for (const s of [-1, 1]) add(head, sphG(0.03, 6, 4), hair, s * 0.028, HR * 0.72, HR * 0.94, { s: [1.3, 0.55, 0.6] }); }

  // ===== Cheveux =====
  const HC = HR * 1.07;
  const cap = (tl = Math.PI * 0.5, sy = 1.08, col = hair) => add(head, sphG(HC, 10, 6, 0, Math.PI * 2, 0, tl), col, 0, HR, -0.012, { s: [1.02, sy, 1.03], rough: 0.6 });
  const back = (len) => add(head, halfCylG(HC * 0.98, HC * 0.92, len, Math.PI * 0.55, Math.PI * 0.9), hair, 0, HR - len / 2 + 0.02, -0.01, { rough: 0.6 });
  const fringe = () => { for (let i = -2; i <= 2; i++) add(head, coneG(0.05, 0.12, 4), hair, i * 0.07, HR * 1.42, HR * 0.86, { r: [Math.PI - 0.5, 0, i * 0.12] }); };
  switch (OPTIONS.hair[g('hair')]) {
    case 'Court': cap(Math.PI * 0.52); back(0.18); fringe(); break;
    case 'Long': cap(Math.PI * 0.55); back(0.62); for (const s of [-1, 1]) add(head, halfCylG(0.06, 0.07, 0.5, 0, Math.PI * 2, 6), hair, s * HC * 0.9, HR - 0.08, 0.02); fringe(); break;
    case 'Crête': cap(Math.PI * 0.42, 1.0, shade(hair, 30)); for (let i = 0; i < 6; i++) add(head, coneG(0.05, 0.16 + (i % 2) * 0.04, 4), hair, 0, HR * 2.05, 0.15 - i * 0.07, { r: [-0.3 + i * 0.12, 0, 0] }); break;
    case 'Chignon': cap(Math.PI * 0.55); back(0.2); add(head, icoG(0.1, 1), hair, 0, HR * 2.0, -0.13); add(head, torG(0.07, 0.016, 4, 10), accC, 0, HR * 1.88, -0.12, { r: [1.1, 0, 0] }); break;
    case 'Rasé': cap(Math.PI * 0.5, 1.02, shade(hair, 20)); break;
    case 'Bouclé': cap(Math.PI * 0.55); back(0.22); for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, r = i % 2 ? 0.17 : 0.1; add(head, icoG(0.075, 0), hair, Math.cos(a) * r, HR * 1.75 + (i % 3) * 0.03, Math.sin(a) * r - 0.02); } for (let i = 0; i < 10; i++) { const a = Math.PI * 0.15 + (i / 9) * Math.PI * 0.7; add(head, icoG(0.07, 0), hair, Math.cos(a) * HC, HR * 1.25, -Math.sin(a) * HC); } break;
    case 'Carré': cap(Math.PI * 0.55); add(head, halfCylG(HC * 1.02, HC * 1.12, 0.36, Math.PI * 0.32, Math.PI * 1.36, 12), hair, 0, HR * 0.86, -0.01, { rough: 0.6 }); fringe(); break;
    case 'Queue': cap(Math.PI * 0.55); back(0.18); add(head, sphG(0.05, 6, 4), accC, 0, HR * 1.25, -HC); add(head, coneG(0.08, 0.42, 6), hair, 0, HR * 0.95, -HC - 0.08, { r: [Math.PI - 0.35, 0, 0] }); fringe(); break;
    case 'Dégradé': cap(Math.PI * 0.55, 1.02, shade(hair, 28)); add(head, sphG(HC * 0.86, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0, HR * 1.12, 0, { s: [1, 1.2, 1.05] }); break;
    case 'Mèche': cap(Math.PI * 0.52); back(0.2); add(head, coneG(0.1, 0.32, 5), hair, 0.06, HR * 1.6, HR * 0.72, { r: [0.4, 0, -1.2] }); add(head, coneG(0.07, 0.2, 5), hair, -0.08, HR * 1.75, HR * 0.6, { r: [0.5, 0, -1.0] }); break;
  }
  // ===== Accessoires =====
  const gy = ey + 0.005, gz = ez + 0.045;
  switch (OPTIONS.acc[g('acc')]) {
    case 'Lunettes':
      for (const s of [-1, 1]) { add(head, torG(0.045, 0.008, 4, 12), accC, s * 0.085, gy, gz, { rough: 0.3 }); add(head, boxG(0.008, 0.008, 0.22), accC, s * 0.205, gy + 0.01, gz - 0.11); }
      add(head, boxG(0.04, 0.008, 0.008), accC, 0, gy + 0.01, gz); break;
    case 'Lunettes de soleil':
      for (const s of [-1, 1]) { add(head, cylG(0.05, 0.05, 0.01, 12), '#151522', s * 0.085, gy, gz, { r: [Math.PI / 2, 0, 0], rough: 0.1, flat: false }); add(head, boxG(0.008, 0.008, 0.22), accC, s * 0.205, gy + 0.01, gz - 0.11); }
      add(head, boxG(0.22, 0.012, 0.01), accC, 0, gy + 0.04, gz); break;
    case 'Casquette':
      add(head, sphG(HC * 1.03, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), accC, 0, HR * 1.05, 0, { rough: 0.8 });
      add(head, cylG(0.17, 0.18, 0.02, 12, 1), accC, 0, HR * 1.16, HC * 0.95, { s: [1.1, 1, 0.75] });
      add(head, sphG(0.02, 5, 4), shade(accC, -40), 0, HR * 2.1, 0); break;
    case 'Casque audio':
      add(head, torG(HC * 1.05, 0.02, 5, 14, Math.PI), '#22242e', 0, HR, 0, { rough: 0.4 });
      for (const s of [-1, 1]) { add(head, cylG(0.075, 0.075, 0.05, 12), '#22242e', s * HC * 1.03, HR * 0.98, 0, { r: [0, 0, Math.PI / 2] }); add(head, cylG(0.05, 0.05, 0.012, 12), accC, s * (HC * 1.03 + 0.03), HR * 0.98, 0, { r: [0, 0, Math.PI / 2] }); }
      break;
    case 'Bonnet':
      add(head, sphG(HC * 1.06, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), accC, 0, HR * 1.02, 0, { s: [1, 1.18, 1], rough: 1 });
      add(head, torG(HC * 1.02, 0.035, 5, 14), shade(accC, -25), 0, HR * 1.12, 0, { r: [Math.PI / 2, 0, 0], rough: 1 });
      add(head, icoG(0.06, 1), '#F4F3F7', 0, HR * 2.25, 0, { rough: 1 }); break;
    case 'Boucles d\'oreilles':
      for (const s of [-1, 1]) { add(head, torG(0.025, 0.006, 4, 10), '#E8C25A', s * HR * 1.0, HR * 0.72, 0, { r: [0, Math.PI / 2, 0], rough: 0.2 }); add(head, icoG(0.018, 0), accC, s * HR * 1.0, HR * 0.6, 0); }
      break;
  }
  av.parts = P;
  // Fusion : un seul maillage (couleurs par sommet) par partie articulée → ~9 appels de dessin par avatar
  av.root.updateMatrixWorld(true);
  const keep = new Set([P.mouth]);
  head.traverse((o) => { if (o.isMesh && o.material.transparent) keep.add(o); });
  for (const grp of [B, P.hipL, P.hipR, P.kneeL, P.kneeR, P.armL, P.armR, head]) bake(grp, keep);
}

const avMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, flatShading: true });
const _inv = new THREE.Matrix4(), _mm = new THREE.Matrix4();
function bake(group, keep) {
  const meshes = [];
  const walk = (o) => { for (const c of o.children) { if (c.isGroup) continue; if (c.isMesh && !keep.has(c)) { meshes.push(c); walk(c); } } };
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
    lerp(P.armL.rotation, 'x', -0.55); lerp(P.armR.rotation, 'x', -0.55);
    lerp(P.armL.rotation, 'z', 0); lerp(P.armR.rotation, 'z', 0);
    lerp(av.body.position, 'y', -0.39 * av.body.scale.y);
  } else {
    lerp(P.hipL.rotation, 'x', sw); lerp(P.hipR.rotation, 'x', -sw);
    lerp(P.kneeL.rotation, 'x', Math.max(0, -sw) * 0.6); lerp(P.kneeR.rotation, 'x', Math.max(0, sw) * 0.6);
    lerp(P.armL.rotation, 'x', -sw * 0.8); lerp(P.armR.rotation, 'x', sw * 0.8);
    lerp(P.armL.rotation, 'z', -0.08); lerp(P.armR.rotation, 'z', 0.08);
    const breathe = Math.sin(performance.now() / 700) * 0.006;
    av.body.position.y = st.moving ? Math.abs(Math.cos(av.t)) * 0.05 : av.body.position.y * 0.8 + breathe;
  }
  const now = performance.now();
  const tk = st.talking ? Math.sin(now / 90) * 0.05 : Math.sin(now / 1500) * 0.02;
  P.head.rotation.x += (tk - P.head.rotation.x) * 0.3;
  if (P.mouth) P.mouth.scale.y = st.talking ? 1 + Math.abs(Math.sin(now / 70)) * 1.6 : 1;
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
