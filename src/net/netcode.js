/**
 * EN LIGNE : duel entre deux navigateurs (WebRTC via PeerJS), netcode à rollback.
 */
import { Sound } from '../audio/sound.js';
import { resetMatchFx, setArena } from '../game/match.js';
import { pickArena } from '../game/career.js';
import { ARENA_IDS } from '../game/arenalist.js';
import { save } from '../game/save.js';
import { G } from '../game/state.js';
import { humanCmd } from '../input/human.js';
import { onlineMenu, onlineResult, searchingScreen, setPauseLabel, waitingScreen } from './screens.js';
import { VFX, handleEvents, throwZabuton } from '../render/effects.js';
import { REC_MAX, snapPlayer, startReplay } from '../render/replay.js';
import { SKINS } from '../render/sprites.js';
import { DT, SIM_HZ, clamp } from '../sim/constants.js';
import { NO_IN, localCmd, packIn, unpackIn } from '../sim/cmd.js';
import { newMatch, step } from '../sim/simulation.js';
import { recordingFromTicks, roundHead } from '../game/replayfile.js';
import { setNames, updateScore } from '../ui/hud.js';
import { menu } from '../ui/menus.js';
import { hideOverlay, list, mbtn, showScreen } from '../ui/widgets.js';

// Pas de serveur de jeu. PeerJS (intégré au fichier, chargé seulement quand on joue en ligne) passe
// par un serveur public gratuit juste pour que les deux joueurs se trouvent ; ensuite les deux
// navigateurs se parlent en direct (WebRTC). Chacun simule la même partie (simu déterministe) et
// on ne s'échange que les commandes. Celle de l'adversaire arrive en retard : en attendant, on la
// prédit (il continue ce qu'il faisait) ; quand la vraie diffère, on revient à l'état sauvegardé et
// on resimule jusqu'à maintenant (rollback). Math.sin, Math.exp… peuvent différer d'un navigateur
// à l'autre au dernier chiffre près : l'hôte envoie donc son état toutes les 0,5 s pour corriger.
const NET_VER = 1;
const NET_DELAY = 2;           // mes commandes s'appliquent 2 ticks plus tard (17 ms) : moins de corrections
const NET_MAX_AHEAD = 40;      // plus de 0,33 s d'avance sur ce qu'on sait de l'adversaire : on l'attend
const NET_SYNC_EVERY = 60;     // l'hôte envoie son état toutes les 0,5 s
const NET_KEEP = 360;          // états gardés pour revenir en arrière (3 s)
const NET_TIMEOUT = 8000;      // ms sans aucun message : connexion perdue
const PEER_PREFIX = 'dohyo-duel-v1-';
const QUICK_SLOTS = 6;         // partie rapide : jusqu'à 6 joueurs en attente en même temps
const QUICK_WIN = 3;           // partie rapide : premier à 3 manches
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // ni 0/O ni 1/I/L
const fmtLabel = w => (w === 1 ? 'une manche' : `premier à ${w} manches`);
const cleanName = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 14);

function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  const src = document.getElementById('peerjs-lib');
  if (src) {
    const s = document.createElement('script');
    s.textContent = src.textContent;
    document.head.appendChild(s);                    // exécuté tout de suite
  }
  return window.Peer ? Promise.resolve(window.Peer) : Promise.reject(new Error('peerjs'));
}
function randomCode() {
  const b = new Uint8Array(5);
  crypto.getRandomValues(b);
  return Array.from(b, x => CODE_CHARS[x % CODE_CHARS.length]).join('');
}

const predictIn = v => v & ~3;          // il garde sa direction et sa garde ; un dash ou une feinte ne se devine pas

// --- Connexion PeerJS ---
function peerOpts() { return Object.assign({ debug: 0 }, window.__peerOpts || {}); }
/** Ouvre une connexion au serveur de mise en relation. id null = identifiant au hasard. */
function openPeer(id) {
  return new Promise(res => {
    let done = false, p;
    const fin = r => { if (!done) { done = true; clearTimeout(to); res(r); } };
    const to = setTimeout(() => { try { p.destroy(); } catch { /* déjà fermé */ } fin({ error: 'timeout' }); }, 15000);
    try { p = id ? new window.Peer(id, peerOpts()) : new window.Peer(peerOpts()); } catch { fin({ error: 'browser-incompatible' }); return; }
    p.on('open', () => fin({ peer: p }));
    p.on('error', err => { if (!done) { try { p.destroy(); } catch { /* déjà fermé */ } fin({ error: (err && err.type) || 'unknown' }); } });
  });
}
const helloMsg = N => ({ t: 'hello', v: NET_VER, kind: N.kind, name: N.myName, skin: save.skin });
/**
 * Tente de rejoindre l'hôte `target` : connexion directe, « hello », puis attend son « start ».
 * Résout { conn, start } ou { error: 'none' | 'busy' | 'version' | 'closed' | 'timeout' }.
 */
function tryConnect(peer, target, hello) {
  return new Promise(res => {
    let done = false, conn;
    const fin = r => {
      if (done) return;
      done = true; clearTimeout(to); peer.off('error', onErr);
      if (!r.conn && conn) try { conn.close(); } catch { /* déjà fermé */ }
      res(r);
    };
    const onErr = err => {
      if (err && err.type === 'peer-unavailable' && String(err.message || '').endsWith(target)) fin({ error: 'none' });
    };
    peer.on('error', onErr);
    const to = setTimeout(() => fin({ error: 'timeout' }), 15000);
    try { conn = peer.connect(target, { reliable: true, serialization: 'json' }); } catch { fin({ error: 'closed' }); return; }
    if (!conn) { fin({ error: 'closed' }); return; }
    conn.on('open', () => { try { conn.send(hello); } catch { fin({ error: 'closed' }); } });
    conn.on('data', m => {
      if (!m || done) return;
      if (m.t === 'start') fin({ conn, start: m });
      else if (m.t === 'busy') fin({ error: 'busy' });
      else if (m.t === 'err') fin({ error: m.code === 'version' ? 'version' : 'closed' });
    });
    conn.on('close', () => fin({ error: 'closed' }));
    conn.on('error', () => fin({ error: 'closed' }));
  });
}

/** Session en ligne : une connexion, un ou plusieurs matchs (revanches). */
function newNet(role, kind) {
  if (G.net) closeNet();
  const N = {
    role, me: role === 'guest' ? 1 : 0, kind, code: null, peer: null, conn: null, pendingConn: null,
    myName: cleanName(save.netName) || 'Rikishi', foeName: 'Adversaire',
    win: kind === 'quick' ? QUICK_WIN : save.netWin || 3,
    rtt: null, lastRecv: 0, timer: null, uiTimer: null, pingK: 0,
    mid: null, midSeq: 0, pendingStart: null, M: null, early: [],
    phase: 'lobby', rematch: [false, false], resultW: -1, resultShown: false, gone: false, closing: false,
    rc: null, rcAt: 0, adv: 0, statusEl: null,
  };
  G.net = N;
  return N;
}
function closeNet(N = G.net, delay = 0) {
  if (!N) return;
  N.closing = true;
  if (G.net === N) G.net = null;
  if (G.mode === 'online') G.mode = null;
  clearInterval(N.timer); clearInterval(N.uiTimer);
  const shut = () => {
    for (const c of [N.conn, N.pendingConn]) if (c) try { c.close(); } catch { /* déjà fermé */ }
    if (N.peer) try { N.peer.destroy(); } catch { /* déjà fermé */ }
  };
  if (delay) setTimeout(shut, delay); else shut();
}
function netSend(m, N = G.net) {
  if (!N || !N.conn || !N.conn.open) return;
  const lag = window.__netLag;                       // tests : latence simulée (l'ordre des messages est conservé)
  if (!lag) { try { N.conn.send(m); } catch { /* canal fermé */ } return; }
  // file d'attente : des setTimeout séparés peuvent se déclencher dans le désordre (délais arrondis)
  const now = performance.now(), at = Math.max(now + lag.ms + Math.random() * (lag.jitter || 0), N.lagAt || 0);
  N.lagAt = at;
  (N.lagQ || (N.lagQ = [])).push({ at, m });
  if (N.lagQ.length === 1) lagFlush(N);
}
function lagFlush(N) {
  const q = N.lagQ;
  while (q.length && q[0].at <= performance.now()) {
    const { m } = q.shift();
    if (N.conn && N.conn.open) try { N.conn.send(m); } catch { /* canal fermé */ }
  }
  if (q.length) setTimeout(() => lagFlush(N), Math.max(0, q[0].at - performance.now()));
}
const setNetStatus = (N, text) => { if (N.statusEl) N.statusEl.textContent = text; };

/** La connexion directe est établie : on écoute, on mesure le ping, on surveille le silence. */
function attachConn(N, conn) {
  N.conn = conn;
  N.lastRecv = performance.now();
  conn.on('data', m => { if (G.net === N) onNetData(m); });
  const lost = () => { if (G.net === N && N.conn === conn && !N.closing) onPeerLeft(false); };
  conn.on('close', lost);
  conn.on('error', lost);
  clearInterval(N.timer);
  N.timer = setInterval(() => netTimer(N), 250);
}
function netTimer(N) {
  if (G.net !== N || !N.conn) return;
  const now = performance.now();
  if (++N.pingK % 2 === 0) netSend({ t: 'ping', ts: now });
  if (now - N.lastRecv > NET_TIMEOUT) { onPeerLeft(false); return; }
  if (document.hidden) hiddenStep();
}
/** Onglet caché : plus d'images, mais le combat continue (sinon l'adversaire resterait figé). */
function hiddenStep() {
  if (G.mode !== 'online' || G.screen !== 'match' || G.replay || !G.net || !G.net.M) return;
  const now = performance.now();
  if (now - G.last < 8) return;
  const dt = Math.min(2, (now - G.last) / 1000);
  G.last = now;
  netFrame(dt);
}

function onNetData(m) {
  const N = G.net;
  if (!N || !m || typeof m !== 'object') return;
  N.lastRecv = performance.now();
  const M = N.M;
  switch (m.t) {
    case 'in': case 'sync': case 'end':
      if (m.mid !== N.mid || !M) { if (N.early.length < 4000 && (N.mid == null || m.mid > N.mid)) N.early.push(m); return; }
      if (m.t === 'in') {
        onRemoteInputs(M, m.s | 0, Array.isArray(m.v) ? m.v : []);
        if (Number.isFinite(m.c)) { N.rc = m.c; N.rcAt = performance.now(); }
        if (document.hidden) hiddenStep();
      } else if (N.role === 'guest') {
        if (m.t === 'sync' && typeof m.s === 'string') M.pendingSync.push(m);
        if (m.t === 'end') M.hostEnd = m;
      }
      break;
    case 'start': if (N.role === 'guest' && N.phase !== 'match') guestGotStart(m); break;
    case 'go':
      if (N.role === 'host' && N.pendingStart && m.mid === N.pendingStart.mid) {
        const st = N.pendingStart; N.pendingStart = null; startOnlineMatch(st);
      }
      break;
    case 'ping': netSend({ t: 'pong', ts: m.ts }); break;
    case 'pong': {
      const r = performance.now() - m.ts;
      if (r >= 0 && r < 10000) N.rtt = N.rtt == null ? r : N.rtt * 0.8 + r * 0.2;
      break;
    }
    case 'rematch': N.rematch[1 - N.me] = true; onRematchChange(); break;
    case 'bye': onPeerLeft(true); break;
  }
}

// --- Démarrage d'un match : l'hôte propose (graine, format, noms), l'invité répond « go » ---
function hostStart() {
  const N = G.net;
  if (!N || N.role !== 'host' || N.pendingStart) return;
  const st = { t: 'start', mid: ++N.midSeq, seed: (Math.random() * 2 ** 31) | 0, win: N.win, names: [N.myName, N.foeName], skin: save.skin, arena: pickArena() };
  N.pendingStart = st;
  netSend(st);
}
function guestGotStart(m) {
  const N = G.net;
  if (!N || N.role !== 'guest') return;
  const st = {
    mid: m.mid | 0, seed: m.seed | 0, win: [1, 2, 3].includes(m.win) ? m.win : 3,
    names: [cleanName(m.names && m.names[0]) || 'Adversaire', N.myName],
    skin: SKINS.some(s => s.id === m.skin && !s.hidden) ? m.skin : 'rouge',
    arena: ARENA_IDS.includes(m.arena) ? m.arena : 'ryogoku',
  };
  N.win = st.win; N.foeName = st.names[0];
  netSend({ t: 'go', mid: st.mid });
  // l'hôte démarre en recevant « go » : on attend le temps que le message lui parvienne
  setTimeout(() => { if (G.net === N && !N.gone) startOnlineMatch(st); }, clamp((N.rtt || 60) / 2, 0, 250));
}
function newNetMatch() {
  const M = {
    inp: [[], []],            // commandes par tick (entiers), par joueur
    used: [],                 // commande adverse utilisée pour chaque tick simulé (prédite ou reçue)
    remoteTop: NET_DELAY, localTop: NET_DELAY,   // derniers ticks dont on connaît la commande adverse / la mienne
    out: [], outStart: NET_DELAY + 1,
    snaps: new Map(),         // tick → { s: état après ce tick, c: compteurs d'événements }
    rollFrom: Infinity, evc: {}, shown: new Set(),
    pendingSync: [], nextSync: NET_SYNC_EVERY, hostEnd: null, ended: false,
    stallT: 0, rolls: 0, maxRoll: 0, syncOk: 0, syncFix: 0, cpu: 0,
  };
  for (let t = 1; t <= NET_DELAY; t++) M.inp[0][t] = M.inp[1][t] = NO_IN;
  return M;
}
function startOnlineMatch(st) {
  const N = G.net;
  if (!N) return;
  N.mid = st.mid; N.phase = 'match'; N.rematch = [false, false]; N.resultShown = false; N.statusEl = null;
  clearInterval(N.uiTimer);
  if (N.peer && !N.peer.disconnected) try { N.peer.disconnect(); } catch { /* déjà fait */ }   // libère le code / l'emplacement
  G.mode = 'online'; G.opp = null;
  G.names = st.names.slice(); G.skins[0] = st.skin;
  setNames(st.names[0], N.me === 0 ? 'Toi' : 'Est', st.names[1], N.me === 1 ? 'Toi' : 'Ouest');
  G.S = newMatch({ seed: st.seed, win: st.win, ai: [null, null] });
  resetMatchFx();
  setArena(st.arena || 'ryogoku');                 // l'arène choisie par l'hôte, la même pour les deux
  hideOverlay(); updateScore(); setPauseLabel();
  handleEvents(G.S);
  const M = N.M = newNetMatch();
  M.snaps.set(0, { s: structuredClone(G.S), c: {} });
  // ralenti partageable : commandes et départs de manche, rangés par tick (réécrits si on resimule)
  M.rec = { meta: { mode: 'online', names: G.names.slice(), skins: [st.skin, 'blue'], win: st.win, arena: G.arena }, head0: roundHead(G.S), inp: [], heads: new Map() };
  G.last = performance.now();
  const early = N.early; N.early = [];
  for (const m of early) if (m.mid === N.mid) onNetData(m);
}

// --- Simulation en ligne ---
function onRemoteInputs(M, start, vals) {
  const them = 1 - G.net.me;
  for (let k = 0; k < vals.length && k < 2000; k++) {
    const t = start + k;
    if (t <= M.remoteTop || M.inp[them][t] !== undefined) continue;   // déjà reçue
    if (t > M.remoteTop + NET_KEEP) break;            // beaucoup trop loin : on ne pourrait pas revenir en arrière
    // le canal est fiable et ordonné, mais si un paquet arrivait en avance on le garde quand même :
    // un trou dans les commandes bloquerait la partie pour de bon
    const v = vals[k] & 0xffffff;
    M.inp[them][t] = v;
    if (G.S && t <= G.S.tick && M.used[t] !== v) M.rollFrom = Math.min(M.rollFrom, t);   // on s'était trompé
  }
  while (M.inp[them][M.remoteTop + 1] !== undefined) M.remoteTop++;
}
function netCmds(M, t) {
  const me = G.net.me, them = 1 - me;
  let theirs = M.inp[them][t];
  if (theirs === undefined) theirs = predictIn(M.inp[them][M.remoteTop]);
  M.used[t] = theirs;
  const cmds = [];
  cmds[me] = unpackIn(M.inp[me][t]); cmds[them] = unpackIn(theirs);
  return cmds;
}
/**
 * Un tick de simulation en ligne. Les événements sont présentés une seule fois même si le tick est
 * resimulé : chacun reçoit une clé (type, joueur, manche, n-ième de la manche) mémorisée.
 */
function netStep(M) {
  const S = G.S, t = S.tick + 1, rn0 = S.rn;
  step(S, netCmds(M, t));
  const me = G.net.me;
  M.rec.inp[t] = me === 0 ? [M.inp[0][t], M.used[t]] : [M.used[t], M.inp[1][t]];
  if (S.rn !== rn0) M.rec.heads.set(t, roundHead(S)); else M.rec.heads.delete(t);
  const all = S.events, show = [];
  for (const e of all) {
    if (e.type === 'hit' && e.force <= 200) continue;           // simple contact : aucun effet
    const k0 = e.type + ':' + (e.who == null ? '' : e.who) + ':' + S.rn;
    const key = k0 + ':' + (M.evc[k0] = (M.evc[k0] || 0) + 1);
    if (!M.shown.has(key)) { M.shown.add(key); show.push(e); }
  }
  S.events = show;
  handleEvents(S);
  S.events = [];
  if (all.some(e => e.type === 'roundStart')) G.rec = [];
  if (S.phase === 'play' || S.phase === 'roundEnd') {
    G.rec.push({ tick: S.tick, p: [snapPlayer(S.p[0]), snapPlayer(S.p[1])], ring: S.ring,
      fx: all.filter(e => VFX.has(e.type)), win: all.some(e => e.type === 'roundWin') });
    if (G.rec.length > REC_MAX) G.rec.shift();
  }
  for (let k = 0; k < 2; k++) if (S.score[k] === 0 && S.score[1 - k] === S.win - 1 && S.win > 1) G.down[k] = true;
  M.snaps.set(S.tick, { s: structuredClone(S), c: { ...M.evc } });
  M.snaps.delete(S.tick - NET_KEEP);
}
/** Retour à l'état du tick (rollFrom - 1), puis on resimule jusqu'au tick courant avec les bonnes commandes. */
function rollback(M) {
  const from = M.rollFrom, cur = G.S.tick;
  M.rollFrom = Infinity;
  if (from > cur + 1) return;
  const base = M.snaps.get(from - 1);
  if (!base) { onPeerLeft(false); return; }
  G.S = structuredClone(base.s); M.evc = { ...base.c };
  G.rec = G.rec.filter(f => f.tick < from);
  M.rolls++; M.maxRoll = Math.max(M.maxRoll, cur - from + 1);
  while (G.S.tick < cur && G.S.phase !== 'matchEnd') netStep(M);
  for (let t = G.S.tick + 1; t <= cur; t++) { M.snaps.delete(t); M.used[t] = undefined; }   // fin de match plus tôt que prévu
  updateScore();
}
/** Hôte : envoie l'état de chaque tick confirmé (commandes des deux joueurs connues) multiple de 60. */
function hostSync(N, M) {
  const conf = Math.min(G.S.tick, M.remoteTop);
  for (; M.nextSync <= conf; M.nextSync += NET_SYNC_EVERY) {
    const snap = M.snaps.get(M.nextSync);
    if (snap) netSend({ t: 'sync', mid: N.mid, k: M.nextSync, s: JSON.stringify(snap.s) });
  }
}
/** Invité : compare son état confirmé à celui de l'hôte ; s'il diffère (calculs flottants), on adopte celui de l'hôte. */
function guestSync(M) {
  while (M.pendingSync.length) {
    const m = M.pendingSync[0];
    if (m.k > M.remoteTop) break;
    if (m.k > G.S.tick) {
      if (G.S.phase !== 'matchEnd') break;              // pas encore simulé de notre côté
      // notre simulation s'est arrêtée sur une fin que l'hôte n'a pas vue : on reprend son état
      M.pendingSync.shift();
      try { G.S = JSON.parse(m.s); } catch { continue; }
      M.snaps.set(m.k, { s: structuredClone(G.S), c: { ...M.evc } });
      M.syncFix++; updateScore();
      continue;
    }
    M.pendingSync.shift();
    const snap = M.snaps.get(m.k);
    if (!snap) continue;
    if (JSON.stringify(snap.s) === m.s) { M.syncOk++; continue; }
    try { snap.s = JSON.parse(m.s); } catch { continue; }
    M.syncFix++;
    M.rollFrom = Math.min(M.rollFrom, m.k + 1);
  }
}
/** Avance plus lentement si on est en avance sur l'adversaire (sinon c'est lui qui corrigerait sans cesse). */
function netSpeed(N) {
  if (N.rc == null || N.rtt == null) return 1;
  const est = N.rc + ((performance.now() - N.rcAt) + N.rtt / 2) / 1000 * SIM_HZ;
  N.adv += (G.S.tick - est - N.adv) * 0.05;
  return N.adv > 3 ? 0.85 : N.adv > 1.5 ? 0.95 : 1;
}
function netFrame(dt) {
  const N = G.net, M = N && N.M;
  if (!M || M.ended) return;
  const t0 = performance.now();
  if (M.rollFrom !== Infinity) rollback(M);
  if (N.role === 'guest') { guestSync(M); if (M.rollFrom !== Infinity) rollback(M); }
  else hostSync(N, M);
  if (G.net !== N) return;                            // désynchronisation irrécupérable
  G.acc += dt * netSpeed(N);
  const maxN = document.hidden ? 150 : 40;
  let n = 0, stalled = false;
  while (G.acc >= DT && n < maxN) {
    const S = G.S;
    if (S.phase === 'matchEnd') {
      if (N.role === 'host') { G.acc = 0; break; }
      // invité arrêté sur une fin pas encore confirmée par l'hôte : on continue d'envoyer nos commandes,
      // au cas où l'hôte, lui, poursuivrait le combat (écart de calcul entre navigateurs)
      if (M.localTop - NET_DELAY + 1 - M.remoteTop > NET_MAX_AHEAD) { G.acc = Math.min(G.acc, DT); break; }
      const v = localCmd(window.__netBot ? window.__netBot(S, N.me) : humanCmd(0, S));
      M.inp[N.me][++M.localTop] = v; M.out.push(v);
      G.acc -= DT; n++;
      continue;
    }
    if (S.tick + 1 - M.remoteTop > NET_MAX_AHEAD) { stalled = true; break; }   // on attend ses commandes
    const ti = S.tick + 1 + NET_DELAY;                // ma commande d'aujourd'hui s'applique à ce tick
    if (ti > M.localTop) {
      const v = localCmd(window.__netBot ? window.__netBot(S, N.me) : humanCmd(0, S));
      for (let t = M.localTop + 1; t <= ti; t++) { M.inp[N.me][t] = v; M.out.push(v); }
      M.localTop = ti;
    }
    netStep(M);
    G.acc -= DT; n++;
  }
  if (stalled) { G.acc = Math.min(G.acc, DT); M.stallT += dt; } else M.stallT = 0;
  if (M.out.length) {
    netSend({ t: 'in', mid: N.mid, s: M.outStart, v: M.out, c: G.S.tick });
    M.outStart += M.out.length; M.out = [];
  }
  M.cpu += (performance.now() - t0 - M.cpu) * 0.05;     // coût moyen (ms), pour le débogage
  checkNetEnd(N, M);
}
/** Fin du match : décidée par l'hôte quand toutes les commandes jusqu'à la sortie sont confirmées. */
function checkNetEnd(N, M) {
  const S = G.S;
  if (N.role === 'host') {
    if (S.phase === 'matchEnd' && S.endTick <= M.remoteTop) {
      netSend({ t: 'end', mid: N.mid, k: S.endTick, w: S.matchWinner, sc: S.score.slice() });
      netMatchOver(N, S.matchWinner);
    }
  } else if (M.hostEnd && (S.phase === 'matchEnd' || S.tick >= M.hostEnd.k)) {
    const h = M.hostEnd, w = h.w === 1 ? 1 : 0;
    if (S.phase !== 'matchEnd' || S.matchWinner !== w) {      // calcul divergent : l'hôte fait foi
      S.phase = 'matchEnd'; S.matchWinner = w;
      if (Array.isArray(h.sc)) S.score = [h.sc[0] | 0, h.sc[1] | 0];
      updateScore();
    }
    netMatchOver(N, w);
  }
}
function netMatchOver(N, w) {
  N.M.ended = true; N.phase = 'result'; N.resultW = w;
  const S = G.S;
  G.lastReplay = recordingFromTicks(N.M.rec, S.phase === 'matchEnd' && S.endTick ? Math.min(S.endTick, S.tick) : S.tick, { score: S.score.slice(), w });
  G.acc = 0;
  startReplay(() => {
    if (G.net !== N) return;
    if (G.down[w] && G.kimarite !== 'hatakikomi') throwZabuton();        // remonter de 0–(N-1) : les coussins volent (pas sur un henka)
    Sound.roll();
    setTimeout(() => { if (G.net === N && N.phase === 'result') onlineResult(); }, G.down[w] ? 2000 : 450);
  });
}

// --- Revanche, départ de l'adversaire ---
function askRematch() {
  const N = G.net;
  if (!N || N.gone || N.rematch[N.me]) return;
  N.rematch[N.me] = true;
  netSend({ t: 'rematch' });
  onRematchChange();
}
function onRematchChange() {
  const N = G.net;
  if (!N) return;
  if (N.rematch[0] && N.rematch[1] && N.role === 'host') hostStart();
  if (N.resultShown) onlineResult();
}
/** L'adversaire est parti (bye = il a quitté exprès) ou la connexion est coupée. */
function onPeerLeft(bye) {
  const N = G.net;
  if (!N || N.gone || N.closing) return;
  if (N.phase === 'result') { N.gone = true; if (N.resultShown) onlineResult(); return; }
  if (N.phase === 'lobby' && N.role === 'host' && N.peer && !N.peer.destroyed) {
    // il est parti avant le début : on se remet en attente avec le même code
    const c = N.conn; N.conn = null; N.pendingStart = null; clearInterval(N.timer);
    try { c && c.close(); } catch { /* déjà fermé */ }
    if (N.kind === 'quick') searchingScreen(N, 'Ton adversaire est parti. Recherche d’un autre…');
    else waitingScreen(N);
    return;
  }
  N.gone = true;
  const foe = N.foeName, inMatch = N.phase === 'match';
  closeNet(N);
  if (G.replay) { G.replay = null; document.body.classList.remove('replaying'); }
  G.screen = 'menu'; G.mode = null; setPauseLabel();
  showScreen(bye && inMatch ? {
    kanji: '不戦', title: 'Victoire par forfait',
    lead: `${foe} a quitté le combat.`,
    body: [list(mbtn('Rejouer en ligne', null, true, onlineMenu), mbtn('Menu', null, false, menu, 'quiet'))], back: onlineMenu,
  } : {
    kanji: '断', title: 'Connexion perdue',
    lead: inMatch ? `Le lien avec ${foe} s’est coupé (réseau instable, onglet fermé ou ordinateur en veille). Le combat est annulé.`
      : `Le lien avec ${foe} s’est coupé avant le début du combat.`,
    body: [list(mbtn('Rejouer en ligne', null, true, onlineMenu), mbtn('Menu', null, false, menu, 'quiet'))], back: onlineMenu,
  });
}
function leaveOnline(to = onlineMenu) {
  const N = G.net;
  if (N) { netSend({ t: 'bye' }, N); closeNet(N, 250); }
  to();
}
addEventListener('pagehide', () => { const N = G.net; if (N && N.conn && N.conn.open) try { N.conn.send({ t: 'bye' }); } catch { /* fermeture */ } });

export {
  NET_VER, PEER_PREFIX, QUICK_SLOTS, QUICK_WIN, askRematch, attachConn, cleanName, closeNet,
  fmtLabel, guestGotStart, helloMsg, hostStart, leaveOnline, loadPeerJS, netFrame, newNet, openPeer,
  packIn, randomCode, setNetStatus, tryConnect, unpackIn,
};
