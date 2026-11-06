// Réseau P2P sans serveur à nous : PeerJS (broker public gratuit) pour la signalisation.
// Un navigateur est élu "hub" (ID fixe) : il vérifie les connexions SSO et relaie l'état + le chat.
// La voix et les partages d'écran passent en direct entre navigateurs (WebRTC maillé).
import { verifyIdToken } from './auth.js';

// Qualité du partage d'écran : débit élevé et résolution maintenue (le texte reste lisible)
function tuneScreenSender(call) {
  let tries = 0;
  const apply = () => {
    const pc = call.peerConnection; if (!pc) { if (tries++ < 20) setTimeout(apply, 300); return; }
    for (const sd of pc.getSenders()) {
      if (sd.track?.kind !== 'video') continue;
      const p = sd.getParameters();
      if (!p.encodings || !p.encodings.length) { if (tries++ < 20) setTimeout(apply, 400); return; }
      p.encodings[0].maxBitrate = 2500000; p.encodings[0].maxFramerate = 15; p.encodings[0].scaleResolutionDownBy = 1;
      p.degradationPreference = 'maintain-resolution';
      sd.setParameters(p).catch(() => {});
    }
  };
  setTimeout(apply, 300);
  call.peerConnection?.addEventListener?.('connectionstatechange', () => { if (call.peerConnection.connectionState === 'connected') { tries = 0; apply(); } });
}

export class Net {
  constructor({ cfg, peerOpts, space, auth, localStream, getState, on }) {
    this.cfg = cfg; this.peerOpts = peerOpts || {}; this.auth = auth; this.localStream = localStream;
    this.getState = getState; this.on = on;
    this.prefix = `wyespace-${space}-`;
    this.HUB = this.prefix + 'hub';
    this.me = null; this.myId = null;
    this.hubPeer = null; this.isHub = false; this.hubClients = new Map();
    this.link = null; this.linkOpen = false;
    this.roster = new Map(); this.lastSeen = new Map();
    this.micCalls = new Map(); this.retryAt = new Map();
    this.share = null; // {tv, zone, stream, calls: Map}
    this.notes = [];
    this.wins = [];
    this.joinedAt = Date.now();
    this.closed = false;
  }
  status(s) { this.on.status?.(s); }

  start() {
    return new Promise((resolve, reject) => {
      const id = this.prefix + Math.random().toString(36).slice(2, 10);
      const t = setTimeout(() => reject(new Error('timeout')), 12000);
      this.me = new Peer(id, this.peerOpts);
      this.me.on('open', (pid) => { clearTimeout(t); this.myId = pid; this.status('Connexion au salon…'); this.connectHub(); this.startWatchdog(); resolve(pid); });
      this.me.on('error', (e) => this.onPeerError(e, reject, t));
      this.me.on('disconnected', () => { if (!this.closed) setTimeout(() => { try { this.me.reconnect(); } catch {} }, 1000); });
      this.me.on('call', (call) => this.onIncomingCall(call));
    });
  }
  onPeerError(e, reject, t) {
    if (e.type === 'peer-unavailable') {
      const msg = String(e.message || '');
      if (msg.includes(this.HUB)) { this.dropLink(); this.scheduleHub(200 + Math.random() * 800); }
      return;
    }
    if (!this.myId && ['browser-incompatible', 'server-error', 'socket-error', 'network', 'ssl-unavailable'].includes(e.type)) { clearTimeout(t); reject(e); return; }
    console.warn('[net]', e.type, e.message);
  }

  // Détection des pertes : hub silencieux, participants disparus
  startWatchdog() {
    clearInterval(this._wd);
    this._wd = setInterval(() => {
      const now = Date.now();
      if (this.linkOpen && now - (this.lastR || 0) > 3000) {
        const c = this.link; this.dropLink(); try { c?.close(); } catch {}
        this.status('Reconnexion…'); this.scheduleHub(300 + Math.random() * 1500);
      }
      for (const [id, t] of this.lastSeen) {
        if (now - t > 5000) { this.lastSeen.delete(id); this.roster.delete(id); this.closeMic(id); this.on.leave?.(id); }
      }
      if (this.isHub) for (const [id, v] of this.hubClients) if (now - (v.last || 0) > 6000) { this.hubClients.delete(id); try { v.conn.close(); } catch {} }
    }, 1000);
  }

  // ---------- Élection / lien vers le hub ----------
  scheduleHub(ms) { clearTimeout(this._hubT); this._hubT = setTimeout(() => this.connectHub(), ms); }
  async connectHub() {
    if (this.closed || this.linkOpen) return;
    if (!this.isHub) await this.tryClaimHub();
    this.openLink();
  }
  tryClaimHub() {
    return new Promise((res) => {
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      const hp = new Peer(this.HUB, { ...this.peerOpts, debug: 0 });
      const to = setTimeout(() => { try { hp.destroy(); } catch {} fin(); }, 8000);
      hp.on('open', () => { clearTimeout(to); this.becomeHub(hp); fin(); });
      hp.on('error', (e) => {
        if (this.hubPeer === hp) { console.warn('[hub]', e.type); return; }
        clearTimeout(to); try { hp.destroy(); } catch {} fin();
      });
    });
  }
  becomeHub(hp) {
    this.hubPeer = hp; this.isHub = true;
    this.status('Tu héberges le salon (hub)');
    hp.on('connection', (c) => {
      c.on('data', (d) => this.hubHandle(c, d));
      c.on('close', () => this.hubClients.delete(c.peer));
      c.on('error', () => this.hubClients.delete(c.peer));
    });
    hp.on('disconnected', () => { if (!this.closed) setTimeout(() => { try { hp.reconnect(); } catch {} }, 800); });
    hp.on('close', () => { this.isHub = false; this.hubPeer = null; });
    clearInterval(this._bcast);
    this._bcast = setInterval(() => {
      this._bn = (this._bn || 0) + 1; const full = this._bn % 10 === 0;
      const list = [];
      for (const v of this.hubClients.values()) if (v.ok && v.state) {
        if (full || v.lookDirty || v.fresh !== false) list.push(v.state); else { const { l, ...rest } = v.state; list.push(rest); }
        v.lookDirty = false; v.fresh = false;
      }
      const msg = { t: 'r', l: list };
      for (const v of this.hubClients.values()) if (v.ok && v.conn.open) v.conn.send(msg);
    }, 200);
  }
  async hubHandle(c, d) {
    if (!d || typeof d !== 'object') return;
    let entry = this.hubClients.get(c.peer);
    if (d.t === 'hello') {
      let ok = true, reason = '';
      if (this.cfg.GOOGLE_CLIENT_ID) {
        const v = await verifyIdToken(d.token || '', this.cfg);
        ok = v.ok; reason = v.reason || '';
        if (ok) d.s.n = v.payload.given_name || v.payload.name || d.s.n;
      } else if (!this.cfg.ALLOW_TEST_MODE) { ok = false; reason = 'SSO requis'; }
      if (!ok) { c.send({ t: 'deny', reason }); setTimeout(() => c.close(), 400); return; }
      entry = { conn: c, ok: true, state: { ...d.s, id: c.peer }, last: Date.now() };
      this.hubClients.set(c.peer, entry);
      const changed = this.mergeWins(d.wins);
      c.send({ t: 'welcome', notes: this.notes, wins: this.wins });
      if (changed) for (const v of this.hubClients.values()) if (v.ok && v.conn.open && v.conn !== c) v.conn.send({ t: 'wins', list: this.wins });
      return;
    }
    if (!entry?.ok) return;
    entry.last = Date.now();
    if (d.t === 's') { if (d.s.l !== undefined) entry.lookDirty = true; entry.state = { ...entry.state, ...d.s, id: c.peer, n: entry.state.n }; return; }
    if (d.t === 'win') { if (!d.w || typeof d.w.text !== 'string') return; d.w = { id: String(d.w.id).slice(0, 20), type: String(d.w.type).slice(0, 30), text: d.w.text.slice(0, 140), who: entry.state.n, ts: Date.now() }; this.mergeWins([d.w]); }
    if (d.t === 'chat' || d.t === 'note' || d.t === 'clear' || d.t === 'knock' || d.t === 'admit' || d.t === 'win') {
      const out = { ...d, from: entry.state.n, fid: c.peer, ts: Date.now() };
      if (d.t === 'note') { this.notes.push(d.n); this.notes = this.notes.slice(-40); }
      if (d.t === 'clear') this.notes = [];
      for (const v of this.hubClients.values()) if (v.ok && v.conn.open) v.conn.send(out);
    }
  }
  openLink() {
    if (this.closed || this.linkOpen || this._opening) return;
    this._opening = true;
    const c = this.me.connect(this.HUB, { reliable: true, serialization: 'json' });
    this._attempt = c;
    const to = setTimeout(() => { if (!c.open && this._attempt === c) { this._attempt = null; this._opening = false; try { c.close(); } catch {} this.scheduleHub(1000 + Math.random() * 2000); } }, 7000);
    c.on('open', () => {
      if (this._attempt !== c) { try { c.close(); } catch {} return; }
      clearTimeout(to); this._attempt = null; this._opening = false; this.link = c; this.linkOpen = true; this.lastR = Date.now();
      c.send({ t: 'hello', token: this.auth.token || '', s: this.getState(), wins: this.wins });
      this.status(this.isHub ? 'Connecté (tu héberges le salon)' : 'Connecté');
      clearInterval(this._stateT);
      this._stateT = setInterval(() => {
        if (!this.linkOpen) return;
        const st = this.getState(); const lk = JSON.stringify(st.l);
        // l'apparence n'est renvoyée que si elle change (ou toutes les ~2 s)
        this._lt = (this._lt || 0) + 1;
        if (lk === this._lk && this._lt % 13) delete st.l; else this._lk = lk;
        try { c.send({ t: 's', s: st }); } catch {}
      }, 150);
    });
    c.on('data', (d) => this.clientHandle(d));
    const lost = () => {
      clearTimeout(to);
      if (this.link !== c && this._attempt !== c) return; // ancien lien déjà remplacé
      if (this._attempt === c) { this._opening = false; this._attempt = null; }
      if (this.link === c) this.dropLink();
      this.status('Reconnexion…'); this.scheduleHub(500 + Math.random() * 2000);
    };
    c.on('close', lost); c.on('error', lost);
  }
  dropLink() { this.linkOpen = false; this.link = null; clearInterval(this._stateT); }

  clientHandle(d) {
    if (!d) return;
    switch (d.t) {
      case 'welcome': if (this.mergeWins(d.wins) || d.wins) this.on.wins?.(this.wins, null); if (!this.isHub && Array.isArray(d.notes)) { this.notes = d.notes; } else if (this.isHub && d.notes.length === 0 && this.notes.length) { /* hub garde ses notes */ } this.on.notes?.(this.notes); break;
      case 'r': this.lastR = Date.now(); this.handleRoster(d.l || []); break;
      case 'chat': this.on.chat?.(d); break;
      case 'knock': this.on.knock?.(d); break;
      case 'wins': this.mergeWins(d.list); this.on.wins?.(this.wins, null); break;
      case 'win': this.mergeWins([d.w]); this.on.wins?.(this.wins, d); break;
      case 'admit': this.on.admit?.(d); break;
      case 'note': if (!this.isHub) { this.notes.push(d.n); this.notes = this.notes.slice(-40); } this.on.notes?.(this.notes); break;
      case 'clear': if (!this.isHub) this.notes = []; this.on.notes?.(this.notes); break;
      case 'deny': this.closed = true; this.on.denied?.(d.reason); break;
    }
  }
  // Victoires : fusion par id (chaque navigateur garde une copie → l'historique survit aux départs)
  mergeWins(list) {
    if (!Array.isArray(list)) return false;
    const ids = new Set(this.wins.map((w) => w.id)); let changed = false;
    for (const w of list) if (w && w.id && typeof w.text === 'string' && !ids.has(w.id)) { this.wins.push({ id: String(w.id).slice(0, 20), type: String(w.type || '').slice(0, 30), text: w.text.slice(0, 140), who: String(w.who || '').slice(0, 30), ts: +w.ts || Date.now() }); ids.add(w.id); changed = true; }
    if (changed) { this.wins.sort((a, b) => a.ts - b.ts); this.wins = this.wins.slice(-80); }
    return changed;
  }
  send(msg) { if (this.linkOpen) try { this.link.send(msg); } catch {} }
  sendChat(text, zone) { this.send({ t: 'chat', text, zone }); }
  sendNote(n) { this.send({ t: 'note', n }); }
  clearNotes() { this.send({ t: 'clear' }); }

  // ---------- Roster & appels voix ----------
  handleRoster(list) {
    const now = Date.now();
    const ids = new Set();
    for (const s of list) {
      if (!s || !s.id || s.id === this.myId) continue;
      ids.add(s.id); this.roster.set(s.id, s); this.lastSeen.set(s.id, now);
    }
    for (const [id, t] of this.lastSeen) {
      if (now - t > 5000) { this.lastSeen.delete(id); this.roster.delete(id); this.closeMic(id); this.on.leave?.(id); }
    }
    this.on.roster?.(this.roster);
    for (const s of this.roster.values()) {
      const older = s.j < this.joinedAt || (s.j === this.joinedAt && s.id < this.myId);
      if (older && !this.micCalls.has(s.id) && (this.retryAt.get(s.id) || 0) < now) this.callMic(s.id);
    }
    if (this.share) this.updateShareTargets();
  }
  callMic(id) {
    const call = this.me.call(id, this.localStream, { metadata: { kind: 'mic' } });
    if (!call) return;
    this.micCalls.set(id, call); this.wire(call, 'mic');
  }
  closeMic(id) { const c = this.micCalls.get(id); if (c) { this.micCalls.delete(id); try { c.close(); } catch {} } this.on.streamEnd?.(id, 'mic', {}); }
  async onIncomingCall(call) {
    const t0 = Date.now();
    while (!this.roster.has(call.peer) && Date.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 150));
    if (!this.roster.has(call.peer)) { try { call.close(); } catch {} return; }
    const kind = call.metadata?.kind || 'mic';
    if (kind === 'mic') {
      const ex = this.micCalls.get(call.peer);
      if (ex) {
        if (call.peer < this.myId) { this.micCalls.delete(call.peer); try { ex.close(); } catch {} }
        else { try { call.close(); } catch {} return; }
      }
      this.micCalls.set(call.peer, call);
      call.answer(this.localStream);
    } else call.answer();
    this.wire(call, kind);
  }
  wire(call, kind) {
    let gotId = null;
    call.on('stream', (s) => { if (gotId === s.id) return; gotId = s.id; this.on.stream?.(call.peer, kind, s, call.metadata || {}); });
    const end = () => {
      if (kind === 'mic' && this.micCalls.get(call.peer) === call) { this.micCalls.delete(call.peer); this.retryAt.set(call.peer, Date.now() + 3000); this.on.streamEnd?.(call.peer, 'mic', {}); }
      if (kind === 'screen') this.on.streamEnd?.(call.peer, 'screen', call.metadata || {});
    };
    call.on('close', end); call.on('error', end);
    const pc = call.peerConnection;
    if (pc) pc.addEventListener('iceconnectionstatechange', () => { if (['failed', 'closed'].includes(pc.iceConnectionState)) { try { call.close(); } catch {} end(); } });
  }

  // ---------- Partage d'écran ----------
  async startShare(tv, zone) {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 15, max: 30 } }, audio: false });
    const vt = stream.getVideoTracks()[0];
    try { vt.contentHint = 'detail'; } catch {} // privilégie la netteté du texte à la fluidité
    this.stopShare();
    this.share = { tv, zone, stream, calls: new Map() };
    stream.getVideoTracks()[0].addEventListener('ended', () => { this.stopShare(); this.on.shareEnded?.(); });
    this.updateShareTargets();
    return stream;
  }
  updateShareTargets() {
    const sh = this.share; if (!sh) return;
    for (const s of this.roster.values()) {
      const inZone = s.zone === sh.zone;
      if (inZone && !sh.calls.has(s.id)) {
        const c = this.me.call(s.id, sh.stream, { metadata: { kind: 'screen', tv: sh.tv } });
        if (c) { sh.calls.set(s.id, c); c.on('close', () => sh.calls.delete(s.id)); c.on('error', () => sh.calls.delete(s.id)); tuneScreenSender(c); }
      } else if (!inZone && sh.calls.has(s.id)) { try { sh.calls.get(s.id).close(); } catch {} sh.calls.delete(s.id); }
    }
  }
  stopShare() {
    const sh = this.share; if (!sh) return;
    this.share = null;
    for (const c of sh.calls.values()) try { c.close(); } catch {}
    for (const t of sh.stream.getTracks()) t.stop();
  }
}
