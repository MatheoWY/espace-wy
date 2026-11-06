// Audio spatialisé : micro local, mixage des voix distantes avec gain + panoramique par personne.
export class SpatialAudio {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.nodes = new Map();
    this.hasMic = false;
    this.localStream = null;
    this.analyser = null;
    this.buf = null;
    // Sortie via un élément <audio> (meilleure prise en charge de l'annulation d'écho par Chrome)
    this.mix = this.ctx.createGain();
    try {
      this.dest = this.ctx.createMediaStreamDestination();
      this.mix.connect(this.dest);
      this.out = new Audio(); this.out.autoplay = true; this.out.srcObject = this.dest.stream;
    } catch { this.mix.connect(this.ctx.destination); }
  }
  async resume() {
    try { await this.ctx.resume(); } catch {}
    try { await this.out?.play(); } catch {}
  }
  async initMic() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no getUserMedia');
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      this.hasMic = true;
      const src = this.ctx.createMediaStreamSource(this.localStream);
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 512;
      this.buf = new Float32Array(this.analyser.fftSize);
      src.connect(this.analyser);
    } catch (e) {
      // Pas de micro : flux silencieux pour pouvoir quand même recevoir les appels
      const d = this.ctx.createMediaStreamDestination();
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); g.gain.value = 0; o.connect(g).connect(d); o.start();
      this.localStream = d.stream; this.hasMic = false;
    }
    return this.localStream;
  }
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0; for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    return Math.sqrt(s / this.buf.length);
  }
  setMicEnabled(on) {
    if (!this.hasMic || !this.localStream) return;
    for (const t of this.localStream.getAudioTracks()) if (t.enabled !== on) t.enabled = on;
  }
  attach(id, stream) {
    this.detach(id);
    const el = new Audio(); el.muted = true; el.srcObject = stream; el.play().catch(() => {});
    const src = this.ctx.createMediaStreamSource(stream);
    const gain = this.ctx.createGain(); gain.gain.value = 0;
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pan) src.connect(gain).connect(pan).connect(this.mix); else src.connect(gain).connect(this.mix);
    this.nodes.set(id, { el, src, gain, pan, stream, g: 0 });
  }
  detach(id) {
    const n = this.nodes.get(id); if (!n) return;
    try { n.src.disconnect(); n.gain.disconnect(); n.pan?.disconnect(); } catch {}
    n.el.srcObject = null; this.nodes.delete(id);
  }
  set(id, g, p = 0) {
    const n = this.nodes.get(id); if (!n) return;
    const t = this.ctx.currentTime;
    n.gain.gain.setTargetAtTime(g, t, 0.08); n.g = g;
    if (n.pan) n.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), t, 0.1);
  }
}

// Règles de volume entre "moi" (écouteur) et "lui" (orateur)
const OPEN = new Set(['accueil', 'couloir', 'dehors', 'jardin']);
const fall = (d, near, far) => (d <= near ? 1 : d >= far ? 0 : Math.pow(1 - (d - near) / (far - near), 1.6));

export function computeGain(me, o, d) {
  if (!o.mic) return 0;
  if (o.wh) return d < 3 ? 1 : 0;                     // chuchotement : ~3 m
  if (o.vi) return 0;                                  // en visio Meet sans chuchoter
  const za = me.zone, zb = o.zone;
  if (za !== zb) return OPEN.has(za) && OPEN.has(zb) ? fall(d, 2, 9) : 0; // les vitres isolent le son
  switch (za) {
    case 'prospection':
      if (me.cd) return 0;                             // l'appelant n'entend pas la salle (le client non plus)
      if (o.cd) return 1;                              // tout le monde entend l'appel
      return fall(d, 1.5, 6) * 0.8;
    case 'amphi':
      if (o.st) return 1;                              // orateur sur scène
      return fall(d, 1.5, 5);
    case 'reunion': case 'dressing':
      return 1;                                        // toute la pièce
    default:
      if (me.sg && me.sg === o.sg) return 1;           // même canapé / même table
      return fall(d, 2, 9);
  }
}
