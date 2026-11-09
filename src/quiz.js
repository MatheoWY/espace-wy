// Salle Quiz : entraînement solo (correction immédiate) et duel 1 contre 1 en temps réel.
import { QUESTIONS } from './quiz-data.js';

export const THEMES = [...new Set(QUESTIONS.map((q) => q.th))];
const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
const DUEL_N = 10, DUEL_MS = 20000, REVEAL_MS = 5000;
const TYPE_LABEL = { u: 'Une seule réponse', m: 'Plusieurs réponses possibles', vf: 'Vrai ou faux', o: 'Remets dans l\'ordre' };

const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function isCorrect(q, ans) {
  if (!Array.isArray(ans)) return false;
  if (q.t === 'o') return ans.length === q.a.length && ans.every((v, i) => v === q.a[i]);
  const A = [...new Set(ans)].sort(), B = q.a.slice().sort();
  return A.length === B.length && A.every((v, i) => v === B[i]);
}
function pick(theme, n) {
  const pool = QUESTIONS.filter((q) => !theme || theme === 'Tous' || q.th === theme);
  return shuffle(pool).slice(0, n);
}

export function createQuiz(ctx) {
  // ctx: { esc, toast, ding, sysMsg, getNet, getMe, isSolo, getPeople, onLive }
  const { esc } = ctx;
  const el = document.getElementById('quiz');
  let mode = null;           // 'train' | 'duel' | null
  let T = null;              // état entraînement
  let D = null;              // état duel
  let pendingInvite = null;  // invitation envoyée
  let incoming = null;       // invitation reçue
  let timerRaf = 0;

  const open = () => el.classList.remove('hidden');
  function close() {
    if (D && !D.over) { send({ k: 'quit', id: D.id }); }
    if (pendingInvite) send({ k: 'cancel', id: pendingInvite.id, to: pendingInvite.to });
    pendingInvite = null; D = null; T = null; mode = null; cancelAnimationFrame(timerRaf);
    el.classList.add('hidden'); el.innerHTML = '';
  }
  const send = (m) => ctx.getNet()?.send({ t: 'duel', ...m });
  const me = () => ctx.getMe();

  // ---------- rendu d'une question ----------
  function questionHTML(q, perm, head) {
    const opts = perm.map((oi, k) => `<button class="qopt" data-oi="${oi}"><span class="qk">${q.t === 'o' ? '' : String.fromCharCode(65 + k)}</span><span class="qt">${esc(q.o[oi])}</span></button>`).join('');
    const foot = q.t === 'm' ? `<div class="qfoot"><button id="qValid" disabled>Valider</button></div>`
      : q.t === 'o' ? `<div class="qfoot"><button class="ghost" id="qReset">↺ Recommencer</button><button id="qValid" disabled>Valider l'ordre</button></div>` : '';
    return `${head}<div class="qtheme">${esc(q.th)} · ${TYPE_LABEL[q.t]}</div><div class="qq">${esc(q.q)}</div><div class="qopts ${q.t === 'vf' ? 'vf' : ''}">${opts}</div>${foot}<div id="qReveal"></div>`;
  }
  function bindQuestion(q, onSubmit) {
    const btns = [...el.querySelectorAll('.qopt')];
    let sel = [];
    const done = (ans) => { btns.forEach((b) => (b.disabled = true)); el.querySelectorAll('#qValid,#qReset').forEach((b) => (b.disabled = true)); onSubmit(ans); };
    const valid = el.querySelector('#qValid');
    btns.forEach((b) => (b.onclick = () => {
      const oi = +b.dataset.oi;
      if (q.t === 'u' || q.t === 'vf') { b.classList.add('sel'); done([oi]); return; }
      if (q.t === 'm') { sel = sel.includes(oi) ? sel.filter((x) => x !== oi) : [...sel, oi]; b.classList.toggle('sel'); valid.disabled = !sel.length; return; }
      if (q.t === 'o') { if (sel.includes(oi)) return; sel.push(oi); b.classList.add('sel'); b.querySelector('.qk').textContent = sel.length; valid.disabled = sel.length !== q.o.length; }
    }));
    if (valid) valid.onclick = () => done(sel.slice());
    const reset = el.querySelector('#qReset');
    if (reset) reset.onclick = () => { sel = []; btns.forEach((b) => { b.classList.remove('sel'); b.querySelector('.qk').textContent = ''; }); valid.disabled = true; };
  }
  function revealHTML(q, ans, extra = '') {
    const ok = isCorrect(q, ans);
    el.querySelectorAll('.qopt').forEach((b) => {
      const oi = +b.dataset.oi;
      if (q.t === 'o') { const pos = q.a.indexOf(oi); b.querySelector('.qk').textContent = pos + 1; b.classList.add((ans || [])[pos] === oi ? 'ok' : 'ko'); }
      else if (q.a.includes(oi)) b.classList.add('ok');
      else if ((ans || []).includes(oi)) b.classList.add('ko');
      b.disabled = true;
    });
    el.querySelectorAll('#qValid,#qReset').forEach((b) => b.remove());
    return `<div class="qres ${ok ? 'good' : 'bad'}"><b>${ok ? '✅ Bonne réponse' : ans ? '❌ Raté' : '⏱️ Temps écoulé'}</b>${q.t === 'o' ? ' · les numéros indiquent le bon ordre' : ''}<p>${esc(q.x)}</p>${extra}</div>`;
  }

  // ---------- ENTRAÎNEMENT ----------
  function openTraining(preset) {
    if (D) { ctx.toast('Termine ton duel d\'abord'); return; }
    mode = 'train'; open();
    const sel = new Set(preset?.themes || THEMES);
    const best = JSON.parse(localStorage.getItem('wy-quiz-best') || '{}');
    const draw = () => {
      const n = QUESTIONS.filter((q) => sel.has(q.th)).length;
      el.innerHTML = `<div class="qhead"><h3>🎯 Entraînement</h3><button class="ghost" id="qClose">✕</button></div>
        <p class="qsub">Choisis tes thèmes et le nombre de questions. La correction s'affiche après chaque réponse.</p>
        <div class="row">Thèmes</div><div>${THEMES.map((t) => `<span class="opt ${sel.has(t) ? 'sel' : ''}" data-th="${esc(t)}">${esc(t)} <small>(${QUESTIONS.filter((q) => q.th === t).length})</small></span>`).join('')}</div>
        <div class="row">Nombre de questions</div><div>${[10, 20, 0].map((k) => `<button class="${k === 10 ? '' : 'ghost'} qn" data-n="${k}" ${!n ? 'disabled' : ''}>${k || `Toutes (${n})`}</button>`).join(' ')}</div>
        ${Object.keys(best).length ? `<div class="row">Mes meilleurs scores</div><div class="qsub">${Object.entries(best).map(([k, v]) => `${esc(k)} : <b>${v}%</b>`).join(' · ')}</div>` : ''}`;
      el.querySelectorAll('[data-th]').forEach((b) => (b.onclick = () => { const t = b.dataset.th; sel.has(t) ? sel.delete(t) : sel.add(t); draw(); }));
      el.querySelectorAll('.qn').forEach((b) => (b.onclick = () => startTraining([...sel], +b.dataset.n)));
      el.querySelector('#qClose').onclick = close;
    };
    if (preset?.qs) return startTraining(null, 0, preset.qs);
    draw();
  }
  function startTraining(themes, n, fixed) {
    const pool = fixed || shuffle(QUESTIONS.filter((q) => themes.includes(q.th)));
    T = { qs: n ? pool.slice(0, n) : pool, i: 0, score: 0, wrong: [], themes: themes || ['Révision'] };
    showTrain();
  }
  function showTrain() {
    const q = T.qs[T.i];
    const perm = q.t === 'vf' ? q.o.map((_, i) => i) : shuffle(q.o.map((_, i) => i));
    const pct = Math.round((T.i / T.qs.length) * 100);
    el.innerHTML = questionHTML(q, perm, `<div class="qhead"><h3>🎯 Question ${T.i + 1}/${T.qs.length}</h3><span class="qscore">${T.score} ✓</span><button class="ghost" id="qClose">✕</button></div><div class="qbar"><i style="width:${pct}%"></i></div>`);
    el.querySelector('#qClose').onclick = close;
    bindQuestion(q, (ans) => {
      const ok = isCorrect(q, ans); if (ok) T.score++; else T.wrong.push(q);
      el.querySelector('#qReveal').innerHTML = revealHTML(q, ans, `<div class="qfoot"><button id="qNext">${T.i + 1 < T.qs.length ? 'Question suivante →' : 'Voir mon score'}</button></div>`);
      el.querySelector('.qscore').textContent = `${T.score} ✓`;
      const nx = el.querySelector('#qNext'); nx.focus();
      nx.onclick = () => { T.i++; T.i < T.qs.length ? showTrain() : endTrain(); };
    });
  }
  function endTrain() {
    const pct = Math.round((T.score / T.qs.length) * 100);
    const key = T.themes.length === THEMES.length ? 'Tous thèmes' : T.themes.join(' + ');
    const best = JSON.parse(localStorage.getItem('wy-quiz-best') || '{}');
    const isBest = T.themes[0] !== 'Révision' && T.qs.length >= 10 && (!(key in best) || pct > best[key]);
    if (isBest) { best[key] = pct; localStorage.setItem('wy-quiz-best', JSON.stringify(best)); }
    const byTh = {};
    for (const q of T.qs) { byTh[q.th] = byTh[q.th] || [0, 0]; byTh[q.th][1]++; if (!T.wrong.includes(q)) byTh[q.th][0]++; }
    el.innerHTML = `<div class="qhead"><h3>Résultat</h3><button class="ghost" id="qClose">✕</button></div>
      <div class="qbig ${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'bad'}">${pct}%<small>${T.score} / ${T.qs.length} bonnes réponses${isBest ? ' · 🏅 nouveau record' : ''}</small></div>
      ${Object.entries(byTh).map(([t, [a, b]]) => `<div class="qth"><span>${esc(t)}</span><div class="qbar"><i style="width:${(a / b) * 100}%"></i></div><b>${a}/${b}</b></div>`).join('')}
      <div class="qfoot">${T.wrong.length ? `<button class="alt" id="qWrong">Revoir mes ${T.wrong.length} erreur${T.wrong.length > 1 ? 's' : ''}</button>` : ''}<button class="ghost" id="qAgain">Nouvel entraînement</button><button id="qEnd">Terminer</button></div>`;
    el.querySelector('#qClose').onclick = close; el.querySelector('#qEnd').onclick = close;
    el.querySelector('#qAgain').onclick = () => openTraining();
    const w = el.querySelector('#qWrong'); if (w) { const list = T.wrong.slice(); w.onclick = () => openTraining({ qs: shuffle(list) }); }
  }

  // ---------- DUEL ----------
  function openDuelMenu() {
    if (ctx.isSolo()) { ctx.toast('Le duel fonctionne en multijoueur'); return; }
    if (D) { open(); return; }
    mode = 'duel'; open();
    let theme = 'Tous';
    const draw = () => {
      const people = ctx.getPeople();
      el.innerHTML = `<div class="qhead"><h3>⚔️ Défier un collègue</h3><button class="ghost" id="qClose">✕</button></div>
        <p class="qsub">Duel en ${DUEL_N} questions identiques, ${DUEL_MS / 1000} s par question. Bonne réponse = 100 pts + bonus de rapidité (jusqu'à 50).</p>
        <div class="row">Thème</div><div>${['Tous', ...THEMES].map((t) => `<span class="opt ${t === theme ? 'sel' : ''}" data-th="${esc(t)}">${esc(t)}</span>`).join('')}</div>
        <div class="row">Collègues en ligne</div>
        ${pendingInvite ? `<p class="qsub">⏳ Invitation envoyée à <b>${esc(pendingInvite.name)}</b>… <button class="ghost" id="qCancel">Annuler</button></p>` : people.length ? people.map((p) => `<div class="qpeer"><span>${esc(p.name)}<small>${esc(p.where)}</small></span>${p.busy ? '<small>en duel</small>' : `<button data-id="${esc(p.id)}" data-name="${esc(p.name)}">Défier</button>`}</div>`).join('') : '<p class="qsub">Personne d\'autre n\'est connecté pour le moment.</p>'}`;
      el.querySelector('#qClose').onclick = close;
      el.querySelectorAll('[data-th]').forEach((b) => (b.onclick = () => { theme = b.dataset.th; draw(); }));
      el.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => invite(b.dataset.id, b.dataset.name, theme, draw)));
      const c = el.querySelector('#qCancel'); if (c) c.onclick = () => { send({ k: 'cancel', id: pendingInvite.id, to: pendingInvite.to }); pendingInvite = null; draw(); };
    };
    draw();
    D_menuRedraw = draw;
  }
  let D_menuRedraw = null;
  function invite(to, name, theme, redraw) {
    const id = Math.random().toString(36).slice(2, 10);
    pendingInvite = { id, to, name, theme };
    send({ k: 'inv', id, to, theme });
    setTimeout(() => { if (pendingInvite?.id === id) { pendingInvite = null; ctx.toast(`${name} n'a pas répondu`); if (mode === 'duel' && !D) redraw(); } }, 30000);
    redraw();
  }
  function showInvite(d) {
    incoming = d; mode = 'duel'; open();
    el.innerHTML = `<div class="qhead"><h3>⚔️ Défi reçu</h3></div>
      <div class="qbig mid">${esc(d.from)}<small>te défie en duel quiz · thème : ${esc(d.theme)}</small></div>
      <div class="qfoot"><button class="ghost" id="qDec">Refuser</button><button id="qAcc">Accepter ⚔️</button></div>`;
    el.querySelector('#qAcc').onclick = () => { send({ k: 'acc', id: d.id, to: d.fid }); el.innerHTML = '<div class="qbig mid">⏳<small>Lancement du duel…</small></div>'; incoming = null; };
    el.querySelector('#qDec').onclick = () => { send({ k: 'dec', id: d.id, to: d.fid }); incoming = null; close(); };
    setTimeout(() => { if (incoming?.id === d.id) { incoming = null; close(); } }, 30000);
  }

  // l'hôte (celui qui invite) pilote le déroulé
  const H = { duel: null, answers: {}, timer: 0 };
  function hostStart(d) {
    const qs = pick(pendingInvite.theme, DUEL_N).map((q) => q.id);
    const st = { k: 'start', id: d.id, a: me().id, b: d.fid, an: me().name, bn: d.from, qs, theme: pendingInvite.theme };
    pendingInvite = null;
    H.duel = { ...st, i: -1, tot: { a: 0, b: 0 } };
    send(st);
    setTimeout(() => hostNext(), 2500);
  }
  function hostNext() {
    const h = H.duel; if (!h) return;
    h.i++;
    if (h.i >= h.qs.length) { send({ k: 'end', id: h.id, an: h.an, bn: h.bn, sa: h.tot.a, sb: h.tot.b, theme: h.theme, ts: Date.now() }); H.duel = null; return; }
    H.answers = {};
    send({ k: 'q', id: h.id, i: h.i });
    clearTimeout(H.timer); H.timer = setTimeout(() => hostReveal(h.i), DUEL_MS + 1500);
  }
  function hostAnswer(d) {
    const h = H.duel; if (!h || d.i !== h.i) return;
    const who = d.fid === h.a ? 'a' : d.fid === h.b ? 'b' : null; if (!who || H.answers[who]) return;
    H.answers[who] = { ok: !!d.ok, ms: Math.max(0, Math.min(DUEL_MS, +d.ms || DUEL_MS)), ans: d.ans };
    if (H.answers.a && H.answers.b) hostReveal(h.i);
  }
  function hostReveal(i) {
    const h = H.duel; if (!h || i !== h.i || h.revealed === i) return;
    h.revealed = i; clearTimeout(H.timer);
    const pts = {};
    for (const w of ['a', 'b']) { const r = H.answers[w]; pts[w] = r?.ok ? 100 + Math.round(50 * (1 - r.ms / DUEL_MS)) : 0; h.tot[w] += pts[w]; }
    send({ k: 'rev', id: h.id, i, pts, ok: { a: !!H.answers.a?.ok, b: !!H.answers.b?.ok }, tot: { ...h.tot }, an: h.an, bn: h.bn, n: h.qs.length });
    setTimeout(() => hostNext(), REVEAL_MS);
  }
  function hostQuit(d) { const h = H.duel; if (!h || d.id !== h.id) return; clearTimeout(H.timer); const forfeitA = d.fid === h.a; send({ k: 'end', id: h.id, an: h.an, bn: h.bn, sa: forfeitA ? 0 : Math.max(h.tot.a, 1), sb: forfeitA ? Math.max(h.tot.b, 1) : 0, theme: h.theme, forfeit: forfeitA ? h.an : h.bn, ts: Date.now() }); H.duel = null; }

  // côté joueur (hôte compris)
  function playerQuestion(d) {
    const q = BY_ID.get(D.qs[d.i]); if (!q) return;
    D.i = d.i; D.answered = false; D.t0 = performance.now();
    const perm = q.t === 'vf' ? q.o.map((_, k) => k) : shuffle(q.o.map((_, k) => k));
    const youA = D.side === 'a';
    el.innerHTML = questionHTML(q, perm, `<div class="qhead"><h3>⚔️ ${d.i + 1}/${D.qs.length}</h3><span class="qvs"><b>${esc(youA ? D.an : D.bn)}</b> ${youA ? D.tot.a : D.tot.b} – ${youA ? D.tot.b : D.tot.a} <b>${esc(youA ? D.bn : D.an)}</b></span><button class="ghost" id="qClose" title="Abandonner">✕</button></div><div class="qbar timer"><i id="qTimer" style="width:100%"></i></div>`);
    el.querySelector('#qClose').onclick = () => { if (confirmQuit()) close(); };
    const tick = () => { const left = Math.max(0, 1 - (performance.now() - D.t0) / DUEL_MS); const t = el.querySelector('#qTimer'); if (!t) return; t.style.width = left * 100 + '%'; t.classList.toggle('hot', left < 0.25); if (left > 0 && !D.answered) timerRaf = requestAnimationFrame(tick); };
    cancelAnimationFrame(timerRaf); timerRaf = requestAnimationFrame(tick);
    bindQuestion(q, (ans) => {
      if (D.answered) return; D.answered = true; D.myAns = ans;
      send({ k: 'ans', id: D.id, i: d.i, ok: isCorrect(q, ans), ms: Math.round(performance.now() - D.t0) });
      el.querySelector('#qReveal').innerHTML = '<div class="qwait">Réponse envoyée · en attente de ton adversaire…</div>';
    });
    D.lockTimer = setTimeout(() => { if (!D || D.i !== d.i || D.answered) return; D.answered = true; D.myAns = null; el.querySelectorAll('.qopt,#qValid,#qReset').forEach((b) => (b.disabled = true)); send({ k: 'ans', id: D.id, i: d.i, ok: false, ms: DUEL_MS }); }, DUEL_MS);
  }
  let quitAsked = 0;
  function confirmQuit() { if (Date.now() - quitAsked < 3000) return true; quitAsked = Date.now(); ctx.toast('Clique à nouveau sur ✕ pour abandonner le duel'); return false; }
  function playerReveal(d) {
    const q = BY_ID.get(D.qs[d.i]); if (!q) return;
    clearTimeout(D.lockTimer); cancelAnimationFrame(timerRaf);
    D.tot = d.tot;
    const mine = D.side, other = mine === 'a' ? 'b' : 'a', oname = mine === 'a' ? D.bn : D.an;
    const extra = `<div class="qduelres"><span>Toi : <b>${d.ok[mine] ? '+' + d.pts[mine] : '0'}</b></span><span>${esc(oname)} : <b>${d.ok[other] ? '+' + d.pts[other] : '0'}</b></span></div>`;
    el.querySelector('#qReveal').innerHTML = revealHTML(q, D.myAns ?? null, extra);
    const vs = el.querySelector('.qvs'); if (vs) vs.innerHTML = `<b>${esc(mine === 'a' ? D.an : D.bn)}</b> ${d.tot[mine]} – ${d.tot[other]} <b>${esc(oname)}</b>`;
  }
  function playerEnd(d) {
    clearTimeout(D?.lockTimer); cancelAnimationFrame(timerRaf);
    const mine = D.side, sMe = mine === 'a' ? d.sa : d.sb, sOt = mine === 'a' ? d.sb : d.sa, oname = mine === 'a' ? d.bn : d.an;
    const res = sMe > sOt ? 'Victoire ! 🏆' : sMe < sOt ? 'Défaite…' : 'Égalité';
    D.over = true;
    el.innerHTML = `<div class="qhead"><h3>⚔️ Fin du duel</h3></div>
      <div class="qbig ${sMe > sOt ? 'good' : sMe < sOt ? 'bad' : 'mid'}">${res}<small>${sMe} pts – ${sOt} pts contre ${esc(oname)}${d.forfeit ? ` · abandon de ${esc(d.forfeit)}` : ''}</small></div>
      <div class="qfoot"><button class="ghost" id="qTrain">S'entraîner</button><button id="qEnd">Fermer</button></div>`;
    el.querySelector('#qEnd').onclick = () => { D = null; close(); };
    el.querySelector('#qTrain').onclick = () => { D = null; openTraining(); };
    if (sMe > sOt) ctx.ding('ok');
  }

  // duel interrompu (adversaire ou hôte déconnecté)
  setInterval(() => {
    if (D && !D.over && Date.now() - (D.last || Date.now()) > 30000) {
      D.over = true; clearTimeout(D.lockTimer); cancelAnimationFrame(timerRaf);
      el.innerHTML = `<div class="qbig bad">Duel interrompu<small>La connexion avec ton adversaire a été perdue.</small></div><div class="qfoot"><button id="qEnd">Fermer</button></div>`;
      el.querySelector('#qEnd').onclick = () => { D = null; close(); };
    }
  }, 3000);

  // ---------- réseau ----------
  function onNet(d) {
    const myId = ctx.getNet()?.myId; if (!myId) return;
    if (D && D.id === d.id) D.last = Date.now();
    const mine = d.fid === myId;
    switch (d.k) {
      case 'inv':
        if (d.to !== myId) return;
        if (D || incoming || mode === 'train' || pendingInvite) { send({ k: 'dec', id: d.id, to: d.fid, busy: true }); return; }
        ctx.ding('knock'); ctx.toast(`⚔️ ${d.from} te défie au quiz !`, 5000); showInvite(d); return;
      case 'cancel': if (d.to === myId && incoming?.id === d.id) { incoming = null; close(); ctx.toast(`${d.from} a annulé le défi`); } return;
      case 'dec': if (d.to === myId && pendingInvite?.id === d.id) { ctx.toast(`${d.from} ${d.busy ? 'est occupé·e' : 'a refusé le défi'}`); pendingInvite = null; D_menuRedraw?.(); } return;
      case 'acc': if (d.to === myId && pendingInvite?.id === d.id) hostStart(d); return;
      case 'ans': if (H.duel && H.duel.id === d.id) hostAnswer(d); return;
      case 'quit': if (H.duel && H.duel.id === d.id) hostQuit(d); if (D && D.id === d.id && !mine) ctx.toast('Ton adversaire a abandonné'); return;
    }
    // messages de déroulé : aussi utiles aux spectateurs (écran de la salle)
    if (d.k === 'start' || d.k === 'rev' || d.k === 'end') ctx.onLive?.(d);
    const involved = d.a === myId || d.b === myId || (D && D.id === d.id);
    if (d.k === 'start' && involved) {
      D = { id: d.id, qs: d.qs, side: d.a === myId ? 'a' : 'b', an: d.an, bn: d.bn, tot: { a: 0, b: 0 }, i: -1, last: Date.now() };
      mode = 'duel'; open();
      el.innerHTML = `<div class="qbig mid">⚔️<small>${esc(d.an)} contre ${esc(d.bn)} · ${d.qs.length} questions · thème ${esc(d.theme)}</small></div><div class="qwait">C'est parti dans 2 secondes…</div>`;
      return;
    }
    if (!D || D.id !== d.id) return;
    if (d.k === 'q') playerQuestion(d);
    else if (d.k === 'rev') playerReveal(d);
    else if (d.k === 'end') playerEnd(d);
  }

  return {
    openTraining, openDuelMenu, onNet, close,
    get busy() { return !!D || !!pendingInvite; },
    get open() { return !el.classList.contains('hidden'); },
  };
}
