// Espace virtuel Work&You — POC
import * as THREE from 'three';
import { buildWorld, BRAND, BULLES, ROOMS, ENCLOSED, zoneAt, heightAt, onStage, collide, drawTextCanvas, FONT_TITLE, FONT_TEXT } from './world.js';
import { buildAvatar, applyLook, animateAvatar, makeLabel, normLook, randomLook, lookKey, PALETTE, OPTIONS, SLIDERS, DEFAULT_LOOK } from './avatar.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SpatialAudio, computeGain } from './audio.js';
import { waitForGis, renderGoogleButton } from './auth.js';
import { demoAgenda, requestCalendarToken, fetchAgenda, currentAndNext, fmtTime, fmtDay } from './calendar.js';
import { Net } from './net.js';
import { createQuiz, THEMES } from './quiz.js';

const CFG = Object.assign({ ALLOWED_DOMAIN: 'workandyou.fr', ALLOW_TEST_MODE: true, SPACE_ID: 'workandyou-poc', PEER_SERVER: {}, ICE_SERVERS: [{ urls: 'stun:stun.l.google.com:19302' }] }, window.WY_CONFIG || {});
const qs = new URLSearchParams(location.search);
const IN_FRAME = (() => { try { return window.self !== window.top; } catch { return true; } })();
const SOLO_FORCED = qs.has('solo') || IN_FRAME || !window.RTCPeerConnection || !window.Peer;
const NORENDER = qs.has('norender'); // tests automatisés
const SPACE = (qs.get('salle') || CFG.SPACE_ID).replace(/[^a-z0-9-]/gi, '').toLowerCase();
const peerOpts = qs.get('peer') === 'local'
  ? { host: location.hostname, port: 9000, path: '/peer', secure: false }
  : { ...(CFG.PEER_SERVER || {}) };
peerOpts.config = { iceServers: CFG.ICE_SERVERS };
peerOpts.debug = 1;

const $ = (id) => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ---------------- Rendu ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let PIX = store.get('wy-pix2', 1);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#E7E9F5');
scene.fog = new THREE.Fog('#E7E9F5', 45, 95);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 220);
scene.add(new THREE.HemisphereLight('#FFFFFF', '#B9BEDA', 0.9));
const sun = new THREE.DirectionalLight('#FFF1DF', 2.3);
sun.position.set(18, 34, 14); sun.target.position.set(4, 0, -6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 36, bottom: -36, near: 5, far: 110 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
// Qualité adaptative : on baisse la résolution puis l'effet verre si le PC rame
let QL = 0; const QL_DPR = [Math.min(devicePixelRatio || 1, 1.75), 1, 0.8, 0.8, 0.65];
const ecoGlass = new THREE.MeshStandardMaterial({ color: '#F4F6FF', transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0 });
function applyQuality() {
  if (QL >= 2) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  if (QL >= 3 && world.glassMat !== ecoGlass) {
    for (const f of world.fadeables) { const w = f.userData.wall; if (w?.glass && !w.faded) w.mesh.material = ecoGlass; }
    world.glassMat = ecoGlass;
  }
  resize();
}
let perfT = 0, perfN = 0, perfWarm = 0;
function perfTick(dt) {
  if (!inGame || PIX > 1 || QL >= QL_DPR.length - 1 || qs.has('hd')) return;
  perfWarm += dt; if (perfWarm < 3) return;
  perfT += dt; perfN++;
  if (perfT >= 2) { const fps = perfN / perfT; perfT = 0; perfN = 0; if (fps < 38) { QL++; applyQuality(); console.info('[qualité] niveau', QL, Math.round(fps) + ' fps'); } }
}
function resize() {
  const dpr = PIX === 1 ? QL_DPR[QL] : 1 / PIX;
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  canvas.classList.toggle('pix', PIX > 1);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const world = buildWorld(scene);
Promise.all(['800 40px Poppins', '700 40px Poppins', '600 40px Poppins', '500 40px Poppins'].map((f) => document.fonts?.load(f))).then(() => { world.redrawSigns(); drawAmphiScreen(); world.drawBoard(notes); }).catch(() => {});

// ---------------- État local ----------------
const ME = {
  id: 'moi', name: '', email: '', token: '', look: normLook(store.get('wy-look3', null) || randomLook()),
  x: (Math.random() - 0.5) * 4, y: 0, z: 12.5, r: Math.PI, seat: null,
  zone: 'accueil', micOn: true, visio: false, whisper: false, talking: false, share: null, joinedAt: Date.now(),
  calling: false, queue: null, lock: null,
};
let meAv = null, meLabel = null, inGame = false, solo = false, net = null, audio = null;
const remotes = new Map();
let notes = [];
let wins = store.get('wy-wins', []);
let duels = store.get('wy-duels', []);
let quiz = null;
let chatMsgs = [];
let agenda = demoAgenda(), agendaReal = false;
let editorOpen = false;

const cam = { yaw: 0, pitch: 0.82, dist: 11, target: new THREE.Vector3(0, 1, 8), pos: new THREE.Vector3(0, 9, 20) };

function myState() {
  const seat = ME.seat;
  return {
    n: ME.name, l: ME.look, x: +ME.x.toFixed(2), y: +ME.y.toFixed(2), z: +ME.z.toFixed(2), r: +ME.r.toFixed(2),
    seat: seat?.id || null, sg: seat?.group || null, zone: ME.zone,
    mic: !!(audio?.hasMic && ME.micOn), tk: ME.talking, vi: ME.visio, wh: ME.whisper,
    cd: !!ME.calling, q: ME.queue, lk: ME.lock && ME.zone === ME.lock ? ME.lock : null, st: onStage(ME.x, ME.z), sh: ME.share, j: ME.joinedAt,
  };
}

// ---------------- Connexion ----------------
async function initLogin() {
  const note = $('loginNote');
  if (CFG.GOOGLE_CLIENT_ID && !IN_FRAME) {
    const ok = await waitForGis();
    if (ok) {
      renderGoogleButton($('gbtn'), CFG, (u) => enter(u), (msg) => { $('loginMsg').textContent = msg; });
      note.textContent = `Réservé aux comptes Google @${CFG.ALLOWED_DOMAIN}. Autorise le micro à l'entrée.`;
      return;
    }
    $('loginMsg').textContent = 'Google Identity indisponible.';
  }
  if (CFG.GOOGLE_CLIENT_ID && !IN_FRAME) return;
  $('testForm').classList.remove('hidden');
  $('testName').value = store.get('wy-name', '');
  note.innerHTML = IN_FRAME
    ? 'Aperçu solo : dans cet aperçu, la voix, le partage d\'écran et le multijoueur sont désactivés (des collègues « bots » se promènent pour la démo).'
    : 'Mode test : SSO Google pas encore configuré (renseigne GOOGLE_CLIENT_ID dans config.js).<br>Autorise le micro à l\'entrée. Casque conseillé.';
  $('testForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = $('testName').value.trim().slice(0, 20);
    if (!n) { $('loginMsg').textContent = 'Indique ton prénom'; return; }
    store.set('wy-name', n);
    enter({ name: n, email: '', token: '' });
  });
  $('testName').focus();
}

async function enter(user) {
  $('login').classList.add('hidden');
  $('hud').classList.remove('hidden');
  ME.name = user.name; ME.email = user.email; ME.token = user.token;
  audio = new SpatialAudio();
  await audio.resume();
  if (!SOLO_FORCED) await audio.initMic(); else audio.localStream = null;
  meAv = buildAvatar(ME.look); meLabel = makeLabel(ME.name); meAv.root.add(meLabel.sprite); scene.add(meAv.root);
  inGame = true;
  cam.yaw = 0;
  updateMicBtn();
  sysMsg(`Bienvenue ${ME.name} ! Direction le couloir au nord pour visiter les pièces.`);
  if (!SOLO_FORCED) {
    try {
      setStatus('Connexion au réseau…');
      net = new Net({ cfg: CFG, peerOpts, space: SPACE, auth: { token: ME.token }, localStream: audio.localStream, getState: myState, on: netHandlers() });
      net.wins = wins.slice();
      net.duels = duels.slice();
      await net.start();
    } catch (e) {
      console.warn(e); net = null; goSolo('Connexion P2P impossible : mode solo');
    }
  } else goSolo(IN_FRAME ? 'Aperçu solo (bots de démo)' : 'Mode solo');
  if (qs.has('bots') && !solo) spawnBots();
  if (!audio.hasMic && !solo) toast('Micro non disponible : tu peux écouter, pas parler');
  onZoneChange();
  drawAmphiScreen();
  world.drawWins(wins);
  world.drawDuels(duels);
}
function goSolo(msg) { solo = true; setStatus(msg); spawnBots(); }
function setStatus(s) { $('netStatus').textContent = s; }

function netHandlers() {
  return {
    status: setStatus,
    roster: (map) => { for (const s of map.values()) upsertRemote(s); },
    leave: (id) => removeRemote(id),
    stream: (id, kind, stream, meta) => {
      if (kind === 'mic') audio.attach(id, stream);
      else if (kind === 'screen' && world.tvs[meta.tv]) world.tvs[meta.tv].setStream(stream, id);
    },
    streamEnd: (id, kind, meta) => {
      if (kind === 'mic') audio.detach(id);
      else if (kind === 'screen') { const tv = world.tvs[meta.tv]; if (tv && tv.sharer === id) tv.clear(); }
    },
    chat: (d) => addChat({ from: d.from, text: d.text, zone: d.zone, ts: d.ts, mine: d.fid === net?.myId }),
    knock: (d) => onKnock(d),
    wins: (list, d) => onWins(list, d),
    duel: (d) => quiz?.onNet(d),
    duels: (list, d) => onDuels(list, d),
    admit: (d) => onAdmit(d),
    notes: (n) => { notes = n.slice(); world.drawBoard(notes); },
    denied: (reason) => { toast('Accès refusé : ' + reason, 8000); setStatus('Accès refusé (' + reason + ')'); },
    shareEnded: () => { if (ME.share) { world.tvs[ME.share]?.clear(); ME.share = null; renderActions(); } },
  };
}

// ---------------- Avatars distants ----------------
function upsertRemote(s) {
  let r = remotes.get(s.id);
  if (!r) {
    const av = buildAvatar(s.l); const label = makeLabel(s.n || '?'); av.root.add(label.sprite); scene.add(av.root);
    r = { id: s.id, av, label, s, cur: { x: s.x, y: s.y, z: s.z, r: s.r }, lookKey: lookKey(s.l), speed: 0, bot: !!s.bot };
    remotes.set(s.id, r);
    if (inGame && !s.bot) sysMsg(`${s.n} est arrivé·e dans l'espace`);
  }
  if (s.l === undefined && r.s) s.l = r.s.l;
  r.s = s;
  const lk = lookKey(s.l); if (lk && lk !== r.lookKey) { r.lookKey = lk; applyLook(r.av, s.l); }
}
function removeRemote(id) {
  const r = remotes.get(id); if (!r) return;
  scene.remove(r.av.root); remotes.delete(id); audio?.detach(id);
  for (const tv of Object.values(world.tvs)) if (tv.sharer === id) tv.clear();
  if (!r.bot) sysMsg(`${r.s.n} est parti·e`);
}

// ---------------- Bots (aperçu / démo) ----------------
const BOT_ROUTES = {
  accueil: { spine: [0, -1], out: [[0, 3]], spots: [[2, 6], [-2, 10], [5, 7], [-4, 13], [3, 13]] },
  reunion: { spine: [0, -6.5], out: [[-3.5, -6.5]], spots: [[-11, -10.5], [-5, -10.5], [-6, -2], [-12, -3]] },
  prospection: { spine: [0, -20.5], out: [[-3.5, -20.5]], spots: [[-6, -16.5], [-11, -16.5], [-5, -23], [-12, -23.5]] },
  dressing: { spine: [0, -5], out: [[3.5, -5]], spots: [[8, -5], [6, -3], [10, -2]] },
  amphi: { spine: [0, -19], out: [[3.5, -19]], spots: [[16, -15], [16, -23], [5, -13], [5, -25]] },
  jardin: { spine: [0, -1], out: [[0, 17.5], [0, 13], [0, 3]], spots: [[-4, 21], [4, 23.5], [[8, 19.1], [18.3, 19.1], [19.5, 9]], [[8, 19.1], [18.3, 19.1], [16.2, 13.5]], [-10, 20]] },
};
const bots = [];
function spawnBots() {
  if (bots.length) return;
  const names = ['Julie', 'Karim', 'Sophie', 'Lucas', 'Inès', 'Hugo'];
  const rooms = Object.keys(BOT_ROUTES);
  names.forEach((n, i) => {
    const room = rooms[(i + 1) % rooms.length]; const sp = BOT_ROUTES[room].spots[i % BOT_ROUTES[room].spots.length];
    const p0 = Array.isArray(sp[0]) ? sp[sp.length - 1] : sp;
    const b = { id: 'bot-' + i, name: n + ' (bot)', room, x: p0[0], z: p0[1], path: [], wait: 2 + Math.random() * 6, look: randomLook() };
    bots.push(b);
    upsertRemote(botState(b));
  });
}
function botState(b) { return { id: b.id, bot: true, n: b.name, l: b.look, x: b.x, y: heightAt(b.x, b.z), z: b.z, r: b.r || 0, zone: zoneAt(b.x, b.z), mic: false }; }
function tickBots(dt) {
  for (const b of bots) {
    if (b.path.length === 0) {
      b.wait -= dt;
      if (b.wait <= 0) {
        const rooms = Object.keys(BOT_ROUTES); const to = rooms[Math.floor(Math.random() * rooms.length)];
        const A = BOT_ROUTES[b.room], B = BOT_ROUTES[to];
        const spot = B.spots[Math.floor(Math.random() * B.spots.length)];
        const sp2 = Array.isArray(spot[0]) ? spot : [spot];
        b.path = to === b.room ? sp2 : [...A.out, A.spine, B.spine, ...B.out.slice().reverse(), ...sp2];
        b.room = to; b.wait = 6 + Math.random() * 12;
      }
    } else {
      const [tx, tz] = b.path[0]; const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
      if (d < 0.1) b.path.shift();
      else { const s = Math.min(d, 2.4 * dt); b.x += dx / d * s; b.z += dz / d * s; b.r = Math.atan2(dx, dz); }
    }
    upsertRemote(botState(b));
  }
}

// ---------------- Entrées ----------------
const keys = new Set();
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
addEventListener('keydown', (e) => {
  if (!inGame) return;
  if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (quiz?.open) { if (e.key === 'Escape' && !quiz.busy) quiz.close(); return; }
  keys.add(e.code);
  const k = e.key.toLowerCase();
  if (e.code === 'KeyE' && !e.repeat) interact();
  else if (k === 'm' && !e.repeat) toggleMic();
  else if (e.key === 'Enter') { e.preventDefault(); $('chatInput').focus(); }
  else if (e.code === 'KeyH') $('help').classList.toggle('hidden');
  else if (e.code === 'KeyP' && !e.repeat) { PIX = PIX >= 3 ? 1 : PIX + 1; store.set('wy-pix2', PIX); resize(); toast(PIX === 1 ? 'Rendu HD' : 'Mode rétro pixel ×' + PIX); }
  else if (e.key === 'Escape') { closeScreen(); closeModal(); $('help').classList.add('hidden'); if (editorOpen) closeEditor(); }
  if (e.code === 'KeyV') ME.whisper = !!(ME.micOn && audio?.hasMic);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'KeyV') ME.whisper = false; });
addEventListener('blur', () => { keys.clear(); ME.whisper = false; });
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); document.activeElement?.blur?.(); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  cam.yaw -= (e.clientX - drag.x) * 0.006; cam.pitch = Math.max(0.3, Math.min(1.35, cam.pitch + (e.clientY - drag.y) * 0.004));
  drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(4.5, Math.min(22, cam.dist + Math.sign(e.deltaY) * 1.1)); e.preventDefault(); }, { passive: false });
$('micBtn').onclick = toggleMic;
$('winsBtn').onclick = () => (winsOpen ? closeModal() : openWins());
$('helpBtn').onclick = () => $('help').classList.toggle('hidden');
$('helpClose').onclick = () => $('help').classList.add('hidden');
function toggleMic() { ME.micOn = !ME.micOn; updateMicBtn(); toast(ME.micOn ? 'Micro activé' : 'Micro coupé'); }
function updateMicBtn() {
  const b = $('micBtn');
  if (!audio?.hasMic) { b.textContent = solo ? '🎙 (aperçu)' : '🎙 Indispo'; b.classList.add('off'); return; }
  b.textContent = ME.micOn ? '🎙 Micro' : '🔇 Coupé'; b.classList.toggle('off', !ME.micOn);
}

// ---------------- Bulles : fermeture, frapper ----------------
const admitted = {}; // salle -> date limite d'accès accordé
function lockedRooms() {
  const L = {};
  if (ME.lock && ME.zone === ME.lock) L[ME.lock] = true;
  for (const r of remotes.values()) if (r.s.lk && r.s.zone === r.s.lk) L[r.s.lk] = true;
  return L;
}
function activeColliders() {
  const L = lockedRooms(), extra = [];
  for (const id of BULLES) if (L[id] && ME.zone !== id && !((admitted[id] || 0) > Date.now())) extra.push(world.bulleDoors[id].box);
  return extra.length ? world.colliders.concat(extra) : world.colliders;
}
function nearLockedDoor() {
  if (ME.zone !== 'bulles') return null;
  const L = lockedRooms();
  for (const id of BULLES) { const d = world.bulleDoors[id]; if (L[id] && Math.hypot(d.x - ME.x, d.z - ME.z) < 2.2 && !((admitted[id] || 0) > Date.now())) return id; }
  return null;
}
let lastKnock = 0;
function knock(room) {
  if (Date.now() - lastKnock < 5000) { toast('Patiente un peu avant de frapper à nouveau'); return; }
  lastKnock = Date.now();
  if (!net || solo) { toast('Frapper fonctionne en multijoueur'); return; }
  net.send({ t: 'knock', room });
  toast(`Tu as frappé à la porte de la ${ROOMS[room].short.toLowerCase()} 🚪`);
}
function ding(kind = 'knock') {
  try {
    const ctx = audio?.ctx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'knock' ? [[660, 0], [880, 0.14]] : [[523, 0], [659, 0.12], [784, 0.24]];
    for (const [f, t] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, ctx.currentTime + t); g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
    }
  } catch {}
}
function onKnock(d) {
  if (ME.zone !== d.room) return;
  ding('knock');
  addChat({ knock: true, from: d.from, fid: d.fid, room: d.room, zone: d.room, ts: d.ts });
  toast(`🚪 ${d.from} frappe à la porte`, 4000);
}
function onAdmit(d) {
  if (d.who === net?.myId) { admitted[d.room] = Date.now() + 25000; ding('ok'); toast(`✅ ${d.from} t'ouvre la porte, tu peux entrer`, 5000); }
  else if (ME.zone === d.room) addChat({ sys: true, text: `${d.from} a ouvert à ${d.whoName || 'un collègue'}`, zone: d.room });
}
$('chatLog').addEventListener('click', (e) => {
  const b = e.target.closest('[data-admit]'); if (!b || !net) return;
  net.send({ t: 'admit', room: b.dataset.room, who: b.dataset.admit, whoName: b.dataset.name });
  b.disabled = true; b.textContent = 'Ouvert ✔';
});

// ---------------- Interactions ----------------
function occupiedSeats() { const s = new Set(); for (const r of remotes.values()) if (r.s.seat) s.add(r.s.seat); return s; }
function nearestSeat() {
  const occ = occupiedSeats(); let best = null, bd = 1.4;
  for (const s of world.seats) {
    if (occ.has(s.id)) continue;
    const d = Math.hypot(s.x - ME.x, s.z - ME.z); if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function nearBoard() { return ME.zone === 'reunion' && Math.hypot(world.board.pos.x - ME.x, world.board.pos.z - ME.z) < 3.2; }
function nearMirror() { return ME.zone === 'dressing' && Math.hypot(world.dressing.pos.x - ME.x, world.dressing.pos.z - ME.z) < 3; }
function nearTV() {
  let best = null, bd = 7;
  for (const tv of Object.values(world.tvs)) {
    if (tv.zone !== ME.zone) continue;
    if (tv.id === 'tv-amphi' && !onStage(ME.x, ME.z)) continue;
    const d = Math.hypot(tv.pos.x - ME.x, tv.pos.z - ME.z); if (d < bd) { bd = d; best = tv; }
  }
  return best;
}
function sit(seat) {
  ME.seat = seat; ME.x = seat.x; ME.z = seat.z; ME.r = seat.ry;
  if (seat.kind === 'prospect') renderSide(true);
  if (seat.group === 'quiz-train') setTimeout(() => quiz.openTraining(), 400);
}
function stand() {
  const s = ME.seat; if (!s) return; ME.seat = null;
  if (ME.calling || ME.queue) { ME.calling = false; ME.queue = null; renderSide(true); }
  ME.x += Math.sin(s.ry) * 0.7; ME.z += Math.cos(s.ry) * 0.7;
  collide(ME, 0.32, world.colliders);
}
function interact() {
  if (editorOpen) return;
  const ld = nearLockedDoor(); if (ld) { knock(ld); return; }
  if (ME.seat) { stand(); return; }
  if (nearMirror()) { openEditor(); return; }
  if (nearWins()) { openWins(); return; }
  if (nearLecterns()) { quiz.openDuelMenu(); return; }
  if (nearBoard()) { openNoteModal(); return; }
  const s = nearestSeat(); if (s) sit(s);
}

// ---------------- Mise à jour du joueur ----------------
const tmpV = new THREE.Vector3();
function updateMe(dt) {
  let ix = 0, iz = 0;
  if (!editorOpen && !typing() && !quiz?.open) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  }
  let moving = false, speed = 0;
  if ((ix || iz) && ME.seat) stand();
  if (ix || iz) {
    const l = Math.hypot(ix, iz); ix /= l; iz /= l;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const dx = ix * cy + iz * sy, dz = -ix * sy + iz * cy;
    speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6 : 3.6;
    ME.x += dx * speed * dt; ME.z += dz * speed * dt;
    collide(ME, 0.32, activeColliders());
    const target = Math.atan2(dx, dz);
    let diff = target - ME.r; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    ME.r += diff * Math.min(1, dt * 14);
    moving = true;
  }
  const gy = ME.seat ? ME.seat.y - 0.45 : heightAt(ME.x, ME.z);
  ME.y += (gy - ME.y) * Math.min(1, dt * 12);
  const z = zoneAt(ME.x, ME.z);
  if (z !== ME.zone) { ME.zone = z; onZoneChange(); }
  // micro effectif
  const effMic = !!(audio?.hasMic && ME.micOn && (!ME.visio || ME.whisper));
  audio?.setMicEnabled(effMic);
  ME.talking = effMic && audio.level() > 0.018;
  meAv.root.position.set(ME.x, ME.y, ME.z); meAv.root.rotation.y = ME.r;
  animateAvatar(meAv, dt, { moving, sitting: !!ME.seat, speed, talking: ME.talking });
  meLabel.set(ME.name + (ME.whisper ? ' (chut)' : ''), ME.talking ? 'talk' : !effMic && !ME.visio ? 'muted' : ME.visio ? 'visio' : '');
}

function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const s = r.s, c = r.cur;
    const k = Math.min(1, dt * 10);
    const ox = c.x, oz = c.z;
    c.x += (s.x - c.x) * k; c.z += (s.z - c.z) * k; c.y += ((s.y || 0) - c.y) * k;
    let d = (s.r || 0) - c.r; d = Math.atan2(Math.sin(d), Math.cos(d)); c.r += d * k;
    const sp = Math.hypot(c.x - ox, c.z - oz) / Math.max(dt, 1e-3);
    r.speed += (sp - r.speed) * 0.3;
    r.av.root.position.set(c.x, c.y, c.z); r.av.root.rotation.y = c.r;
    animateAvatar(r.av, dt, { moving: r.speed > 0.4, sitting: !!s.seat, speed: r.speed, talking: s.tk });
    r.label.set((s.n || '?') + (s.wh ? ' (chut)' : ''), s.tk ? 'talk' : s.vi ? 'visio' : !s.mic && !s.bot ? 'muted' : '');
  }
}

let gainT = 0;
function updateGains(dt) {
  gainT += dt; if (gainT < 0.1 || !audio) return; gainT = 0;
  const me = myState();
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  for (const r of remotes.values()) {
    if (r.bot) continue;
    const dx = r.cur.x - ME.x, dz = r.cur.z - ME.z, d = Math.hypot(dx, dz);
    const g = computeGain(me, r.s, d);
    const pan = d > 0.5 ? ((dx * rx + dz * rz) / d) * 0.6 : 0;
    audio.set(r.id, g, pan);
  }
}

// ---------------- Caméra ----------------
const ray = new THREE.Raycaster();
let faded = new Set();
function updateCamera(dt) {
  if (inGame) {
    const ty = ME.y + (editorOpen ? 1.3 : 1.2);
    cam.target.lerp(tmpV.set(ME.x, ty, ME.z), Math.min(1, dt * 8));
  } else { cam.yaw += dt * 0.08; cam.target.set(0, 1, 6); }
  const dist = editorOpen ? 4.6 : cam.dist, pitch = editorOpen ? 0.22 : cam.pitch;
  const want = tmpV.set(
    cam.target.x + Math.sin(cam.yaw) * Math.cos(pitch) * dist,
    cam.target.y + Math.sin(pitch) * dist,
    cam.target.z + Math.cos(cam.yaw) * Math.cos(pitch) * dist);
  cam.pos.lerp(want, Math.min(1, dt * 7));
  camera.position.copy(cam.pos); camera.lookAt(cam.target);
  // murs entre la caméra et le joueur : on les estompe
  const now = new Set();
  for (const dy of [0, -0.9]) {
    const dir = tmpV.copy(cam.target); dir.y += dy; dir.sub(cam.pos); const len = dir.length(); dir.normalize();
    ray.set(cam.pos, dir); ray.far = len - 0.3;
    for (const h of ray.intersectObjects(world.fadeables, false)) now.add(h.object.userData.wall);
  }
  for (const w of faded) if (!now.has(w)) setFade(w, false);
  for (const w of now) if (!faded.has(w)) setFade(w, true);
  faded = now;
}
function setFade(w, on) {
  w.faded = on;
  if (w.glass) { w.mesh.material = on ? world.glassClear : world.glassMat; return; }
  for (const m of w.mats) { m.opacity = on ? 0.15 : 1; m.depthWrite = !on; }
}

// ---------------- Zones & panneaux ----------------
function counts() {
  const c = {}; const add = (z) => (c[z] = (c[z] || 0) + 1);
  if (inGame) add(ME.zone);
  for (const r of remotes.values()) add(r.s.zone);
  return c;
}
function onZoneChange() {
  const room = ROOMS[ME.zone];
  $('zoneName').textContent = room ? room.label : 'Dehors';
  $('zoneName').style.color = room?.color || '#2E3484';
  $('chatTitle').textContent = 'Chat · ' + (chatScope(ME.zone) === 'commun' ? 'Espaces communs' : room.label);
  if (ME.zone !== 'amphi' && ME.visio) { ME.visio = false; toast('Mode visio désactivé (tu as quitté l\'amphi)'); }
  if (ME.zone !== 'dressing' && editorOpen) closeEditor();
  renderChat(); renderSide(); renderActions();
}
const chatScope = (z) => (ENCLOSED.has(z) ? z : 'commun');

let sideKey = '';
function renderSide(force) {
  const el = $('side'); const z = ME.zone;
  const caller = callerName();
  const { cur, next } = currentAndNext(agenda);
  const key = [z, !!ME.seat, ME.seat?.kind, caller, ME.calling, ME.queue, ME.lock, JSON.stringify(lockedRooms()), queueList().join(), ME.visio, editorOpen, agendaReal, cur?.title, next.length].join('|');
  if (key === sideKey && !force) return; sideKey = key;
  if (editorOpen) return renderEditor();
  let h = '';
  if (z === 'amphi') {
    h += `<h3>AMPHITHÉÂTRE</h3>`;
    if (cur) h += `<div class="ev cur"><div class="tm">● EN COURS · ${fmtTime(cur.start)}–${fmtTime(cur.end)}</div>${esc(cur.title)}<div style="margin-top:6px">${cur.meet ? `<a class="btn" id="joinMeet" href="${esc(cur.meet)}" target="_blank" rel="noopener">▶ Rejoindre la visio</a>` : '<i>Pas de lien Meet</i>'}</div></div>`;
    else h += `<p>Aucune réunion en cours.</p>`;
    for (const e of next) h += `<div class="ev"><div class="tm">${fmtDay(e.start)} · ${fmtTime(e.start)}</div>${esc(e.title)}</div>`;
    h += `<p style="margin-top:10px"><button id="visioBtn" class="${ME.visio ? 'on' : 'ghost'}">${ME.visio ? '🎧 En visio (voix coupée)' : '🎧 Je suis en visio'}</button></p>`;
    h += `<p style="color:var(--mut)">En visio, ta voix de proximité est coupée. Maintiens <b>V</b> pour chuchoter à tes voisins (~3 m), en coupant ton micro dans Meet.</p>`;
    if (!agendaReal) h += CFG.GOOGLE_CLIENT_ID && window.google?.accounts?.oauth2 ? `<p><button id="agendaBtn" class="alt">📅 Connecter l'agenda Google</button></p>` : `<p style="color:var(--mut)">Agenda de démonstration (SSO non configuré).</p>`;
    h += `<p style="color:var(--mut)">Monte sur la scène pour parler à toute la salle et partager ton écran sur le grand écran.</p>`;
  } else if (z === 'prospection') {
    h += `<h3>PROSPECTION</h3>`;
    const seated = ME.seat?.kind === 'prospect';
    const queue = queueList();
    if (ME.calling) h += `<p>🔴 <b>Tu es en appel.</b> Téléphone sur haut-parleur près de ton micro : toute la table t'entend.</p><p>Tu n'entends pas la table (ton client non plus). Les conseils arrivent dans le chat ↙</p><p><button id="callBtn" class="red">⏹ Terminer mon appel</button></p><p style="color:var(--mut)">⚠️ Préviens ton interlocuteur que des collègues écoutent.</p>`;
    else if (caller) h += `<p>🎧 <b>${esc(caller)}</b> est en appel. Tu l'entends, il ne t'entend pas : coache-le par écrit dans le chat ↙</p>` + (seated ? `<p><button id="queueBtn" class="${ME.queue ? 'on' : 'alt'}">${ME.queue ? '✋ Inscrit·e dans la file' : '✋ Je passe après'}</button></p>` : '');
    else if (seated) h += `<p>La ligne est libre.</p><p><button id="callBtn">📞 Lancer mon appel</button></p>`;
    else h += `<p>Installe-toi à la <b>table d'appels</b> (touche E sur une chaise). Chacun appelle à son tour depuis sa place, les autres écoutent et coachent par écrit.</p>`;
    if (queue.length) h += `<div class="row">File d'attente</div>` + queue.map((n, i) => `<div class="ev"><div class="tm">${i + 1}.</div>${esc(n)}</div>`).join('');
  } else if (BULLES.includes(z)) {
    const r = ROOMS[z], L = lockedRooms(), n = counts()[z] || 0;
    h += `<h3>${esc(r.label)}</h3><p>Petite salle au calme : seules les personnes présentes vous entendent. Partage d'écran possible sur la télé.</p>`;
    h += ME.lock === z ? `<p><button id="lockBtn" class="ghost">🔓 Rouvrir la bulle</button></p><p style="color:var(--mut)">Bulle fermée : les autres doivent frapper (E) pour entrer, tu recevras une notification.</p>`
      : L[z] ? `<p>🔒 Bulle fermée par un collègue.</p>` : `<p><button id="lockBtn" class="alt">🔒 Fermer la bulle</button></p>`;
    if (n > r.cap) h += `<p style="color:#E11D48">Vous êtes ${n} pour ${r.cap} places.</p>`;
  } else if (z === 'quiz') {
    h += `<h3>Salle Quiz</h3><p>${QCOUNT} questions sur le réseau Work&You : ${THEMES.join(', ')}.</p>
      <p><button id="trainBtn">🎯 S'entraîner</button> <button id="duelBtn" class="alt">⚔️ Défier un collègue</button></p>
      <p style="color:var(--mut)">Entraînement : correction après chaque question. Duel : 10 questions en face à face, points selon la rapidité, résultat affiché sur le podium.</p>`;
  } else if (z === 'bulles') {
    h += `<h3>Espace bulles</h3><p>5 petites salles pour travailler à 2 ou 3 au calme (3 bulles pour 2, 2 bulles pour 3).</p><p>Une bulle fermée affiche « Ne pas déranger » : approche-toi de la porte et appuie sur <b>E</b> pour frapper.</p>`;
  } else if (z === 'dressing') {
    h += `<h3>DRESSING</h3><p>Monte sur le podium face au miroir et appuie sur <b>E</b> (ou le bouton ci-dessous) pour personnaliser ton avatar.</p><p><button id="openEd">👕 Personnaliser</button></p>`;
  } else if (z === 'reunion') {
    h += `<h3>RÉUNION · BRAINSTORM</h3><p>Tout le monde dans la pièce s'entend. Partage ton écran sur la télé, ajoute des post-it au tableau (E près du tableau).</p><p><button id="noteBtn">📝 Ajouter un post-it</button> <button id="clearBtn" class="ghost">Effacer</button></p>`;
  } else { el.classList.add('hidden'); return; }
  el.innerHTML = h; el.classList.remove('hidden');
  $('visioBtn') && ($('visioBtn').onclick = () => { ME.visio = !ME.visio; renderSide(true); toast(ME.visio ? 'Mode visio : ta voix de proximité est coupée (V pour chuchoter)' : 'Mode visio désactivé'); });
  $('joinMeet') && ($('joinMeet').onclick = () => { ME.visio = true; setTimeout(() => renderSide(true), 50); toast('Meet s\'ouvre dans un nouvel onglet · mode visio activé'); });
  $('agendaBtn') && ($('agendaBtn').onclick = connectAgenda);
  $('openEd') && ($('openEd').onclick = openEditor);
  $('trainBtn') && ($('trainBtn').onclick = () => quiz.openTraining());
  $('duelBtn') && ($('duelBtn').onclick = () => quiz.openDuelMenu());
  $('callBtn') && ($('callBtn').onclick = () => { if (ME.calling) { ME.calling = false; } else { if (callerName()) { toast('Quelqu\'un est déjà en appel'); return; } ME.calling = true; ME.queue = null; } renderSide(true); });
  $('queueBtn') && ($('queueBtn').onclick = () => { ME.queue = ME.queue ? null : Date.now(); renderSide(true); });
  $('lockBtn') && ($('lockBtn').onclick = () => { ME.lock = ME.lock === ME.zone ? null : ME.zone; renderSide(true); toast(ME.lock ? '🔒 Bulle fermée' : '🔓 Bulle ouverte'); });
  $('noteBtn') && ($('noteBtn').onclick = openNoteModal);
  $('clearBtn') && ($('clearBtn').onclick = () => { if (net) net.clearNotes(); else { notes = []; world.drawBoard(notes); } });
}
function callerName() {
  if (ME.calling) return ME.name;
  for (const r of remotes.values()) if (r.s.cd && r.s.zone === 'prospection') return r.s.n;
  return null;
}
function queueList() {
  const q = [];
  if (ME.queue) q.push([ME.queue, ME.name, 'moi']);
  for (const r of remotes.values()) if (r.s.q && r.s.zone === 'prospection') q.push([r.s.q, r.s.n, r.id]);
  return q.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}
let wasCaller = null;
function prospectTick() {
  const c = callerName();
  if (wasCaller && !c && ME.queue) {
    const q = [];
    if (ME.queue) q.push([ME.queue, 'moi']);
    for (const r of remotes.values()) if (r.s.q && r.s.zone === 'prospection') q.push([r.s.q, r.id]);
    q.sort((a, b) => a[0] - b[0]);
    if (q[0]?.[1] === 'moi') { ding('ok'); toast('📞 C\'est ton tour : lance ton appel !', 5000); }
  }
  wasCaller = c;
  if (ME.zone !== 'prospection' && (ME.calling || ME.queue)) { ME.calling = false; ME.queue = null; }
  if (ME.lock && ME.zone !== ME.lock) ME.lock = null;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Boutons contextuels (partage d'écran…)
let actKey = '';
function renderActions(force) {
  const tv = nearTV();
  const live = Object.values(world.tvs).filter((t) => t.zone === ME.zone && t.video);
  const key = [tv?.id, ME.share, live.map((t) => t.id + t.sharer).join()].join('|');
  if (key === actKey && !force) return; actKey = key;
  const el = $('ctxActions'); el.innerHTML = '';
  if (ME.share) {
    const b = document.createElement('button'); b.className = 'red'; b.textContent = '⏹ Arrêter le partage'; b.onclick = stopShare; el.appendChild(b);
  } else if (tv) {
    const b = document.createElement('button'); b.className = 'alt'; b.textContent = '📺 Partager mon écran'; b.onclick = () => startShare(tv); el.appendChild(b);
  }
  for (const t of live) {
    if (t.sharer === 'moi') continue;
    const b = document.createElement('button'); b.textContent = '🔍 Voir l\'écran en grand'; b.onclick = () => openScreen(t); el.appendChild(b);
  }
}
// Visionneuse plein écran (résolution native du partage)
let viewing = null;
function openScreen(tv) {
  if (!tv?.video) return;
  viewing = tv;
  const v = $('svVideo'); v.srcObject = tv.video.srcObject; v.play().catch(() => {});
  const who = tv.sharer === 'moi' ? 'toi' : remotes.get(tv.sharer)?.s.n || 'un collègue';
  $('svTitle').textContent = `Écran partagé par ${who}`;
  $('screenView').classList.remove('hidden');
}
function closeScreen() { viewing = null; $('svVideo').srcObject = null; $('screenView').classList.add('hidden'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
$('svClose').onclick = closeScreen;
$('svFull').onclick = () => { $('svVideo').requestFullscreen?.().catch(() => {}); };
canvas.addEventListener('dblclick', (e) => {
  const r = new THREE.Raycaster(); const m = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  r.setFromCamera(m, camera);
  const tvs = Object.values(world.tvs).filter((t) => t.video);
  const hit = r.intersectObjects(tvs.map((t) => t.screen), false)[0];
  if (hit) openScreen(tvs.find((t) => t.screen === hit.object));
});

async function startShare(tv) {
  if (solo || !net) { toast('Partage d\'écran indisponible en mode solo / aperçu'); return; }
  if (tv.sharer && tv.sharer !== 'moi') { toast('Quelqu\'un partage déjà sur cet écran'); return; }
  try {
    const stream = await net.startShare(tv.id, tv.zone);
    ME.share = tv.id; tv.setStream(stream, 'moi'); renderActions(true);
  } catch (e) { toast('Partage annulé'); }
}
function stopShare() { if (!ME.share) return; world.tvs[ME.share]?.clear(); net?.stopShare(); ME.share = null; renderActions(true); }

// Hint contextuel
let hintKey = '';
function renderHint() {
  let h = '';
  if (editorOpen) h = '<kbd>Échap</kbd> terminer';
  else if (ME.seat) h = '<kbd>E</kbd> se lever' + (ME.calling ? ' · 🔴 en appel' : '');
  else if (nearLockedDoor()) h = '<kbd>E</kbd> frapper à la porte (bulle fermée)';
  else if (nearMirror()) h = '<kbd>E</kbd> personnaliser mon avatar';
  else if (nearWins()) h = '<kbd>E</kbd> tableau des victoires 🏆';
  else if (nearLecterns()) h = '<kbd>E</kbd> défier un collègue ⚔️';
  else if (nearBoard()) h = '<kbd>E</kbd> ajouter un post-it';
  else { const s = nearestSeat(); if (s) h = '<kbd>E</kbd> ' + (s.kind === 'prospect' ? 's\'installer à la table d\'appels' : 's\'asseoir'); }
  if (ME.whisper) h = '🤫 Tu chuchotes (voisins à ~3 m)';
  if (h === hintKey) return; hintKey = h;
  $('hint').innerHTML = h; $('hint').classList.toggle('hidden', !h);
}

// ---------------- Chat ----------------
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('chatInput').value.trim(); if (!t) return;
  $('chatInput').value = '';
  const zone = chatScope(ME.zone);
  if (net && !solo) net.sendChat(t, zone);
  else addChat({ from: ME.name, text: t, zone, ts: Date.now(), mine: true });
  $('chatInput').blur();
});
function addChat(m) { chatMsgs.push(m); chatMsgs = chatMsgs.slice(-200); if (m.zone === chatScope(ME.zone) || m.sys) renderChat(); }
function sysMsg(text) { chatMsgs.push({ sys: true, text, zone: '*' }); renderChat(); }
function renderChat() {
  const sc = chatScope(ME.zone);
  const list = chatMsgs.filter((m) => m.sys || m.zone === sc).slice(-60);
  const tip = ME.zone === 'prospection';
  $('chatLog').innerHTML = list.map((m) => m.knock ? `<div class="m knock">🚪 <b>${esc(m.from)}</b> frappe à la porte <button data-admit="${esc(m.fid)}" data-room="${esc(m.room)}" data-name="${esc(m.from)}">Ouvrir</button></div>` : m.sys ? `<div class="m sys">${esc(m.text)}</div>` : `<div class="m ${tip && !m.mine ? 'tip' : ''}"><b>${esc(m.from)}</b> ${esc(m.text)}</div>`).join('');
  $('chatLog').scrollTop = 1e6;
}

// ---------------- Quiz ----------------
function onDuels(list, d) {
  duels = list.slice(); store.set('wy-duels', duels.slice(-200)); world.drawDuels(duels);
  if (d) sysMsg(`⚔️ Duel quiz : ${d.an} ${d.sa} – ${d.sb} ${d.bn}${d.sa === d.sb ? ' (égalité)' : ''}`);
}
let liveT = 0;
function onLive(d) {
  clearTimeout(liveT);
  world.quizTV.redrawIdle((c) => {
    const g = c.getContext('2d'), w = c.width, h = c.height, u = h / 100;
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#20246A'); gr.addColorStop(1, '#3A1E6A'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#FFD27A'; g.font = `800 ${9 * u}px Poppins`; g.fillText(d.k === 'end' ? 'FIN DU DUEL' : d.k === 'start' ? 'DUEL EN COURS' : `QUESTION ${d.i + 1} / ${d.n}`, w / 2, 16 * u);
    const sa = d.k === 'end' ? d.sa : d.k === 'rev' ? d.tot.a : 0, sb = d.k === 'end' ? d.sb : d.k === 'rev' ? d.tot.b : 0;
    for (const [x, name, sc, col] of [[0.27, d.an, sa, '#FF4D8D'], [0.73, d.bn, sb, '#5C8BFF']]) {
      g.fillStyle = col; g.font = `800 ${10 * u}px Poppins`; g.fillText(name, w * x, 42 * u, w * 0.4);
      g.fillStyle = '#fff'; g.font = `800 ${22 * u}px Poppins`; g.fillText(sc, w * x, 70 * u);
    }
    g.fillStyle = 'rgba(255,255,255,.6)'; g.font = `700 ${10 * u}px Poppins`; g.fillText('VS', w / 2, 56 * u);
    if (d.k === 'end') { g.fillStyle = '#FFD27A'; g.font = `700 ${6 * u}px Poppins`; g.fillText(sa === sb ? 'Égalité !' : `🏆 ${sa > sb ? d.an : d.bn} remporte le duel`, w / 2, 90 * u); }
  });
  if (d.k === 'end') liveT = setTimeout(() => { world.quizTV.custom = null; world.redrawSigns(); }, 25000);
}
function quizPeople() {
  const out = [];
  for (const r of remotes.values()) if (!r.bot) out.push({ id: r.id, name: r.s.n, where: ROOMS[r.s.zone]?.label || '', busy: false });
  return out;
}

// ---------------- Tableau des victoires ----------------
const WIN_TYPES = Object.keys(world.WIN_TYPES);
function onWins(list, d) {
  wins = list.slice(); store.set('wy-wins', wins.slice(-80)); world.drawWins(wins);
  if (d && d.fid !== net?.myId) {
    const w = d.w; ding('ok');
    toast(`🏆 ${w.who} : ${w.type} !`, 5000);
    sysMsg(`🏆 ${w.who} — ${w.type} : ${w.text}`);
  }
  if (winsOpen) openWins();
}
let winsOpen = false;
function nearLecterns() { return ME.zone === 'quiz' && !ME.seat && Math.hypot(world.quizSpot.x - ME.x, world.quizSpot.z - ME.z) < 2.6; }
function nearWins() { return ME.zone === 'accueil' && Math.hypot(world.winsSpot.x - ME.x, world.winsSpot.z - ME.z) < 3.2; }
function openWins() {
  winsOpen = true;
  const m = $('modal');
  const list = wins.slice().reverse().slice(0, 30);
  let type = m.dataset.type || WIN_TYPES[0];
  m.innerHTML = `<h3>🏆 Tableau des victoires</h3>
    <div class="row" style="color:var(--mut);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Ta victoire</div>
    <div id="winTypes">${WIN_TYPES.map((t) => `<span class="opt ${t === type ? 'sel' : ''}" data-wt="${esc(t)}">${world.WIN_TYPES[t][0]} ${esc(t)}</span>`).join('')}</div>
    <input id="winText" maxlength="140" placeholder="Ex : Signature avec la société X pour 3 postes de commerciaux" autocomplete="off" style="width:100%;margin:10px 0">
    <p style="display:flex;gap:8px;justify-content:flex-end;margin:0 0 12px"><button class="ghost" id="winClose">Fermer</button><button id="winOk">Publier 🎉</button></p>
    <div style="max-height:40vh;overflow-y:auto">${list.length ? list.map((w) => `<div class="ev" style="border-color:${world.WIN_TYPES[w.type]?.[1] || '#3A8A5C'}"><div class="tm">${world.WIN_TYPES[w.type]?.[0] || '🏆'} ${esc(w.type)} · ${esc(w.who)} · ${new Date(w.ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>${esc(w.text)}</div>`).join('') : '<p style="color:var(--mut)">Aucune victoire pour l\'instant.</p>'}</div>`;
  m.style.width = 'min(560px, 92vw)';
  m.classList.remove('hidden');
  m.querySelectorAll('[data-wt]').forEach((n) => (n.onclick = () => { m.dataset.type = n.dataset.wt; m.querySelectorAll('[data-wt]').forEach((x) => x.classList.toggle('sel', x === n)); }));
  const ok = () => {
    const t = $('winText').value.trim(); if (!t) { $('winText').focus(); return; }
    const w = { id: Math.random().toString(36).slice(2, 12), type: m.dataset.type || WIN_TYPES[0], text: t, who: ME.name, ts: Date.now() };
    if (net && !solo) net.send({ t: 'win', w });
    else onWins([...wins, w], null);
    toast('🎉 Victoire publiée sur le tableau !');
    $('winText').value = '';
  };
  $('winOk').onclick = ok; $('winClose').onclick = closeModal;
  $('winText').addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') closeModal(); });
}

// ---------------- Post-it ----------------
const NOTE_COLORS = ['#ffe066', '#ffadd2', '#a5d8ff', '#b2f2bb', '#ffc078'];
function openNoteModal() {
  const m = $('modal');
  m.innerHTML = `<h3>NOUVEAU POST-IT</h3><input id="noteText" maxlength="80" placeholder="Ton idée…" autocomplete="off"><div id="noteCols">${NOTE_COLORS.map((c, i) => `<span class="sw ${i === 0 ? 'sel' : ''}" data-c="${c}" style="background:${c}"></span>`).join('')}</div><p style="display:flex;gap:8px;justify-content:flex-end"><button class="ghost" id="noteCancel">Annuler</button><button id="noteOk">Coller ▶</button></p>`;
  m.classList.remove('hidden');
  let col = NOTE_COLORS[0];
  m.querySelectorAll('#noteCols .sw').forEach((s) => (s.onclick = () => { m.querySelectorAll('#noteCols .sw').forEach((x) => x.classList.remove('sel')); s.classList.add('sel'); col = s.dataset.c; }));
  const ok = () => {
    const t = $('noteText').value.trim(); if (!t) return;
    const n = { id: Math.random().toString(36).slice(2), text: t, color: col, author: ME.name };
    if (net && !solo) net.sendNote(n); else { notes.push(n); world.drawBoard(notes); }
    closeModal();
  };
  $('noteOk').onclick = ok; $('noteCancel').onclick = closeModal;
  $('noteText').addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') closeModal(); });
  setTimeout(() => $('noteText').focus(), 30);
}
function closeModal() { winsOpen = false; $('modal').style.width = ''; $('modal').classList.add('hidden'); $('modal').innerHTML = ''; }

// ---------------- Dressing ----------------
function openEditor() {
  if (ME.seat) stand();
  editorOpen = true;
  ME.r = Math.PI / 2; cam.yaw = ME.r; // face au miroir, la caméra se place côté miroir
  renderSide(true); renderHint();
}
function closeEditor() { editorOpen = false; store.set('wy-look3', ME.look); cam.yaw = ME.r + Math.PI; renderSide(true); toast('Avatar enregistré ✔'); }
let edTab = 'silhouette';
const ED_TABS = {
  silhouette: ['Silhouette', [['sl', 'h'], ['sl', 'b'], ['sl', 'sh'], ['sl', 'lg'], ['sl', 'hd'], ['col', 'sk', 'Teint', PALETTE.skin]]],
  visage: ['Visage', [['opt', 'ey', 'Yeux', OPTIONS.eyes], ['col', 'ec', 'Couleur des yeux', PALETTE.eyes], ['sl', 'es'], ['sl', 'ed'], ['opt', 'br', 'Sourcils', OPTIONS.brows], ['opt', 'mo', 'Bouche', OPTIONS.mouth], ['opt', 'fa', 'Pilosité', OPTIONS.facial], ['sl', 'fl']]],
  cheveux: ['Cheveux', [['opt', 'hs', 'Coupe', OPTIONS.hair], ['sl', 'hl'], ['col', 'hc', 'Couleur', PALETTE.hair]]],
  tenue: ['Tenue', [['opt', 'to', 'Haut', OPTIONS.top], ['col', 'tc', 'Couleur du haut', PALETTE.cloth], ['col', 't2', 'Couleur secondaire', PALETTE.cloth], ['opt', 'bo', 'Bas', OPTIONS.bottom], ['col', 'bc', 'Couleur du bas', PALETTE.cloth], ['col', 'so', 'Chaussures', PALETTE.shoes]]],
  acc: ['Accessoires', [['opt', 'gl', 'Lunettes', OPTIONS.glasses], ['opt', 'ht', 'Couvre-chef', OPTIONS.hat], ['tog', 'bd', 'Badge Work&You'], ['tog', 'er', 'Boucles d\'oreilles'], ['col', 'ac', 'Couleur des accessoires', PALETTE.cloth]]],
};
let edRaf = 0;
function refreshLook() { if (edRaf) return; edRaf = requestAnimationFrame(() => { edRaf = 0; applyLook(meAv, ME.look); }); }
function renderEditor() {
  const el = $('side'); el.classList.remove('hidden');
  const LK = ME.look;
  const tabs = Object.entries(ED_TABS).map(([k, [t]]) => `<span class="tab ${k === edTab ? 'sel' : ''}" data-tab="${k}">${t}</span>`).join('');
  const rows = ED_TABS[edTab][1].map(([kind, key, label, arr]) => {
    if (kind === 'sl') return `<div class="row">${SLIDERS[key]}</div><input type="range" class="rng" min="0" max="100" value="${Math.round(LK[key] * 100)}" data-sl="${key}">`;
    if (kind === 'tog') return `<div class="row">${label}</div><span class="opt ${LK[key] ? '' : 'sel'}" data-tog="${key}" data-v="0">Non</span><span class="opt ${LK[key] ? 'sel' : ''}" data-tog="${key}" data-v="1">Oui</span>`;
    if (kind === 'col') return `<div class="row">${label}</div>` + arr.map((c) => `<span class="sw ${LK[key].toLowerCase() === c.toLowerCase() ? 'sel' : ''}" data-col="${key}" data-c="${c}" style="background:${c}"></span>`).join('') +
      `<label class="sw pick ${arr.some((c) => c.toLowerCase() === LK[key].toLowerCase()) ? '' : 'sel'}" title="Couleur libre" style="background:${LK[key]}"><input type="color" value="${LK[key]}" data-pick="${key}"></label>`;
    return `<div class="row">${label}</div>` + arr.map((t, i) => `<span class="opt ${LK[key] === i ? 'sel' : ''}" data-opt="${key}" data-i="${i}">${t}</span>`).join('');
  }).join('');
  el.innerHTML = `<h3>Mon avatar</h3><div class="tabs">${tabs}</div>${rows}
    <p style="margin-top:14px;display:flex;gap:8px"><button id="edRand" class="ghost">🎲 Au hasard</button><button id="edDone">✔ Terminer</button></p>`;
  el.querySelectorAll('[data-tab]').forEach((n) => (n.onclick = () => { edTab = n.dataset.tab; renderEditor(); }));
  el.querySelectorAll('[data-opt]').forEach((n) => (n.onclick = () => { ME.look[n.dataset.opt] = +n.dataset.i; refreshLook(); renderEditor(); }));
  el.querySelectorAll('[data-tog]').forEach((n) => (n.onclick = () => { ME.look[n.dataset.tog] = +n.dataset.v; refreshLook(); renderEditor(); }));
  el.querySelectorAll('[data-col]').forEach((n) => (n.onclick = () => { ME.look[n.dataset.col] = n.dataset.c; refreshLook(); renderEditor(); }));
  el.querySelectorAll('[data-pick]').forEach((n) => { n.oninput = () => { ME.look[n.dataset.pick] = n.value; n.parentElement.style.background = n.value; refreshLook(); }; n.onchange = () => renderEditor(); });
  el.querySelectorAll('[data-sl]').forEach((n) => (n.oninput = () => { ME.look[n.dataset.sl] = +n.value / 100; refreshLook(); }));
  $('edDone').onclick = closeEditor;
  $('edRand').onclick = () => { ME.look = randomLook(); refreshLook(); renderEditor(); };
}

// ---------------- Amphi : agenda ----------------
async function connectAgenda() {
  try {
    const tok = await requestCalendarToken(CFG, ME.email);
    agenda = await fetchAgenda(CFG, tok); agendaReal = true;
    toast(`Agenda chargé : ${agenda.length} événement(s)`);
  } catch (e) { toast('Agenda : ' + e.message, 6000); }
  drawAmphiScreen(); renderSide(true);
}
function drawAmphiScreen() {
  world.amphiTV.redrawIdle((c) => {
    const { cur, next } = currentAndNext(agenda);
    const g = c.getContext('2d'), w = c.width, h = c.height, u = h / 100;
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, BRAND.navy); gr.addColorStop(1, '#1A1E55');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(214,0,108,.16)'; g.beginPath(); g.arc(w * 0.92, h * 0.05, h * 0.55, 0, 7); g.fill();
    const X = w * 0.05; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = BRAND.rose; g.font = `700 ${4.5 * u}px Poppins`; g.fillText('AMPHITHÉÂTRE · ' + (agendaReal ? 'AGENDA GOOGLE' : 'AGENDA DE DÉMO'), X, 12 * u);
    let y = 26 * u;
    if (cur) {
      g.fillStyle = '#fff'; g.font = `500 ${4.5 * u}px Poppins`; g.fillText(`● En cours · ${fmtTime(cur.start)} – ${fmtTime(cur.end)}`, X, y); y += 11 * u;
      g.font = `800 ${8.5 * u}px Poppins`; g.fillText(cur.title.slice(0, 40), X, y, w * 0.9); y += 8 * u;
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `500 ${4 * u}px Poppins`; g.fillText('Rejoins la visio depuis le panneau à droite de ton écran', X, y); y += 12 * u;
    } else { g.fillStyle = '#fff'; g.font = `700 ${7 * u}px Poppins`; g.fillText('Pas de réunion en cours', X, y + 4 * u); y += 18 * u; }
    g.fillStyle = BRAND.rose; g.fillRect(X, y - 2 * u, 10 * u, 0.8 * u); y += 6 * u;
    g.fillStyle = '#fff'; g.font = `700 ${4 * u}px Poppins`; g.fillText('À VENIR', X, y); y += 8 * u;
    g.font = `500 ${4.6 * u}px Poppins`;
    for (const e of next) { g.fillStyle = 'rgba(255,255,255,.65)'; g.fillText(`${fmtDay(e.start)} ${fmtTime(e.start)}`, X, y); g.fillStyle = '#fff'; g.fillText(e.title.slice(0, 50), X + w * 0.22, y, w * 0.7); y += 8 * u; }
  });
}
setInterval(() => { drawAmphiScreen(); if (ME.zone === 'amphi') renderSide(); }, 60000);

// ---------------- Mini-carte ----------------
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const W = 200, H = 200, x0 = -31, z0 = -37, sc = 200 / 64;
  const X = (x) => (x - x0) * sc + 4, Z = (z) => (z - z0) * sc;
  mm.fillStyle = '#ffffff'; mm.fillRect(0, 0, W, H);
  for (const [k, r] of Object.entries(ROOMS)) {
    mm.fillStyle = r.color + (k === ME.zone ? '66' : '22'); mm.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    mm.strokeStyle = r.color; mm.lineWidth = 1; mm.strokeRect(X(r.x0) + 0.5, Z(r.z0) + 0.5, (r.x1 - r.x0) * sc - 1, (r.z1 - r.z0) * sc - 1);
  }
  for (const r of remotes.values()) { mm.fillStyle = r.bot ? '#9AA0B4' : BRAND.navy; mm.fillRect(X(r.cur.x) - 2, Z(r.cur.z) - 2, 4, 4); }
  if (inGame) {
    mm.save(); mm.translate(X(ME.x), Z(ME.z)); mm.rotate(-ME.r + Math.PI);
    mm.fillStyle = BRAND.rose; mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4, 4); mm.lineTo(-4, 4); mm.closePath(); mm.fill(); mm.restore();
  }
}

// ---------------- Toast ----------------
let toastT;
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

// ---------------- Boucle ----------------
const clock = new THREE.Clock();
let slowT = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (inGame) {
    updateMe(dt);
    if (bots.length) tickBots(dt);
    updateRemotes(dt);
    updateGains(dt);
    renderHint();
    slowT += dt;
    if (slowT > 0.5) {
      slowT = 0;
      const LR = lockedRooms();
      world.updateDoorSigns(counts(), LR);
      for (const id of BULLES) world.setBlind(id, !!LR[id]);
      world.setOnAir(callerName()); world.setBeacon(!!callerName());
      prospectTick();
      renderSide(); renderActions();
      // nettoyer un écran si le partageur a arrêté
      for (const tv of Object.values(world.tvs)) if (tv.sharer && tv.sharer !== 'moi') { const r = remotes.get(tv.sharer); if (!r || r.s.sh !== tv.id) tv.clear(); }
      if (viewing && (!viewing.video || viewing.zone !== ME.zone)) closeScreen();
      const n = (counts()[ME.zone] || 1);
      $('zoneInfo').textContent = `${n} personne${n > 1 ? 's' : ''} ici · ${remotes.size - bots.length + 1} en ligne`;
    }
  }
  updateCamera(dt);
  perfTick(dt);
  drawMinimap();
  if (!NORENDER) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
initLogin();

const QCOUNT = 99;
quiz = createQuiz({ esc, toast, ding, sysMsg, getNet: () => net, getMe: () => ({ id: net?.myId, name: ME.name }), isSolo: () => solo || !net, getPeople: quizPeople, onLive });

// pour le débogage / tests
window.__wy = { get quiz() { return quiz; }, ME, remotes, world, renderer, scene, sun, cam, get net() { return net; }, get solo() { return solo; }, get audio() { return audio; }, myState };
