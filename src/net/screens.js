/**
 * Écrans du mode En ligne : partie rapide, duel privé, rejoindre, résultat, revanche, coupure.
 */
import { Sound } from '../audio/sound.js';
import { statsTable } from '../game/match.js';
import { shareButton } from '../game/watch.js';
import { persist, save } from '../game/save.js';
import { G } from '../game/state.js';
import { held } from '../input/keyboard.js';
import {
  NET_VER, PEER_PREFIX, QUICK_SLOTS, QUICK_WIN, askRematch, attachConn, cleanName, closeNet,
  fmtLabel, guestGotStart, helloMsg, hostStart, leaveOnline, loadPeerJS, newNet, openPeer,
  randomCode, setNetStatus, tryConnect,
} from './netcode.js';
import { $, ctx } from '../ui/dom.js';
import { setNames, updateScore } from '../ui/hud.js';
import { menu } from '../ui/menus.js';
import { keyOrPad } from '../ui/pause.js';
import { el, hideOverlay, list, mbtn, showScreen } from '../ui/widgets.js';

function onlineMenu() {
  if (G.net) closeNet();
  G.screen = 'menu'; G.mode = null; G.paused = false; setPauseLabel();
  setNames('Rouge', 'Est', 'Bleu', 'Ouest'); updateScore();
  const [nameRow, keep] = nameField();
  const fmt = el('div', 'seg');
  fmt.setAttribute('role', 'radiogroup'); fmt.setAttribute('aria-label', 'Format du duel privé');
  const cur = save.netWin || 3;
  [[1, '1 manche'], [2, 'Premier à 2'], [3, 'Premier à 3']].forEach(([w, l]) => {
    const b = el('button', 'seg-btn' + (cur === w ? ' sel' : ''), l);
    b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(cur === w));
    b.addEventListener('click', () => {
      save.netWin = w; persist(); Sound.init(); Sound.click();
      fmt.querySelectorAll('.seg-btn').forEach(x => { x.classList.toggle('sel', x === b); x.setAttribute('aria-checked', String(x === b)); });
    });
    fmt.append(b);
  });
  const fmtRow = el('div', 'net-field');
  fmtRow.append(el('span', null, 'Format du duel privé'), fmt);
  const go = fn => () => { keep(); fn(); };
  const soon = el('small');
  soon.append(el('span', 'soon', 'Bientôt'), document.createTextNode('Comptes et classement'));
  const ranked = mbtn('Classé', soon, false, () => {}, 'locked');
  ranked.disabled = true;
  showScreen({
    kanji: '対戦',
    title: 'En ligne',
    lead: 'Affronte un ami ou un inconnu, chacun sur son écran. Vos deux navigateurs se connectent directement.',
    body: [nameRow, fmtRow, list(
      mbtn('Partie rapide', `Adversaire au hasard, ${fmtLabel(QUICK_WIN)}`, true, go(quickMatch)),
      mbtn('Créer un duel privé', 'Tu reçois un code à donner à ton ami', false, go(hostPrivate)),
      mbtn('Rejoindre avec un code', 'Ton ami t’a donné un code', false, go(() => joinScreen())),
      ranked,
      mbtn('Retour', null, false, menu, 'quiet'),
    )],
    focus: '.menu-btns .mbtn',
    back: menu,
  });
}
/** Champ « Ton nom de lutteur », mémorisé. Renvoie [élément, fonction qui enregistre]. */
function nameField() {
  const name = el('input', 'net-input');
  Object.assign(name, { type: 'text', maxLength: 14, value: save.netName || '', placeholder: 'Rikishi', autocomplete: 'off', spellcheck: false, id: 'netName' });
  const keep = () => { save.netName = cleanName(name.value); persist(); };
  name.addEventListener('change', keep);
  const row = el('div', 'net-field');
  const lab = el('label', null, 'Ton nom de lutteur'); lab.htmlFor = 'netName';
  row.append(lab, name);
  return [row, keep];
}
const NET_ERR = {
  lib: ['Module réseau indisponible', 'Le module de connexion n’a pas pu démarrer dans ce navigateur. Recharge la page et réessaie.'],
  'browser-incompatible': ['Navigateur incompatible', 'Ce navigateur ne gère pas les connexions directes (WebRTC). Essaie un Chrome, Firefox, Edge ou Safari récent.'],
  server: ['Serveur injoignable', 'Le serveur de mise en relation ne répond pas. Vérifie ta connexion internet, puis réessaie dans un moment.'],
  none: ['Code introuvable', 'Aucun duel n’est ouvert avec ce code. Vérifie le code, ou demande à ton ami d’en créer un nouveau.'],
  busy: ['Duel complet', 'Quelqu’un a déjà rejoint ce duel.'],
  version: ['Versions différentes', 'Vous n’avez pas la même version du jeu. Rechargez la page tous les deux, puis recommencez.'],
  closed: ['Connexion impossible', 'Impossible d’établir la connexion directe entre vos deux appareils. Certains réseaux (école, entreprise) la bloquent : essayez depuis un autre réseau, par exemple le partage de connexion d’un téléphone.'],
  full: ['Trop de monde', 'Tous les emplacements de partie rapide sont pris. Réessaie dans un instant, ou crée un duel privé.'],
};
function netError(N, code) {
  if (G.net !== N) return;
  closeNet(N);
  const key = NET_ERR[code] ? code : code === 'timeout' && N.role === 'guest' && N.kind === 'private' ? 'closed'
    : ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected', 'timeout', 'unavailable-id', 'invalid-id', 'invalid-key'].includes(code) ? 'server' : 'closed';
  const [title, lead] = NET_ERR[key];
  const retry = N.kind === 'quick' ? quickMatch : N.role === 'host' ? hostPrivate : () => joinScreen(N.code || '');
  showScreen({
    kanji: '断', title, lead,
    body: [list(mbtn('Réessayer', null, true, retry), mbtn('Retour', null, false, onlineMenu, 'quiet'))],
    back: onlineMenu,
  });
}
/** Écran d'attente générique : un message d'état qui change, et Annuler. */
function netWaitScreen(N, { kanji, title, lead, status, extra = [], btns = [] }) {
  N.statusEl = el('p', 'net-status busy', status);
  N.statusEl.setAttribute('role', 'status');
  showScreen({ kanji, title, lead, body: [...extra, N.statusEl, list(...btns, mbtn('Annuler', null, false, onlineMenu, 'quiet'))], back: onlineMenu });
}

async function hostPrivate() {
  const N = newNet('host', 'private');
  netWaitScreen(N, { kanji: '待', title: 'Duel privé', lead: 'Ouverture du duel…', status: 'Connexion au serveur de mise en relation' });
  try { await loadPeerJS(); } catch { netError(N, 'lib'); return; }
  let r;
  for (let k = 0; k < 5; k++) {
    N.code = randomCode();
    r = await openPeer(PEER_PREFIX + N.code);
    if (G.net !== N) { if (r.peer) r.peer.destroy(); return; }
    if (r.peer || r.error !== 'unavailable-id') break;   // code déjà pris : on en tire un autre
  }
  if (!r.peer) { netError(N, r.error); return; }
  listenAsHost(N, r.peer);
  waitingScreen(N);
}
function listenAsHost(N, peer) {
  N.role = 'host'; N.me = 0; N.peer = peer;
  peer.on('connection', c => hostIncoming(N, c));
  peer.on('disconnected', () => {          // coupure du serveur pendant l'attente : on se reconnecte
    if (G.net === N && N.phase === 'lobby' && !N.conn && !peer.destroyed) setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch { /* réessaiera */ } }, 1500);
  });
}
function waitingScreen(N) {
  const codeEl = el('div', 'netcode', N.code);
  codeEl.setAttribute('aria-label', 'Code : ' + N.code.split('').join(' '));
  const copy = (txt, b) => {
    const sub = b.querySelector('small');
    const ok = () => { sub.textContent = 'Copié !'; }, ko = () => { sub.textContent = 'Copie impossible : recopie-le à la main'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, ko); else ko();
  };
  const btns = [];
  if (/^https?:$/.test(location.protocol)) {
    const link = location.href.split('#')[0] + '#duel=' + N.code;
    const b1 = mbtn('Copier le lien', 'Ton ami l’ouvre et rejoint le duel', true, () => copy(link, b1));
    btns.push(b1);
  }
  const b2 = mbtn('Copier le code', N.code, btns.length === 0, () => copy(N.code, b2));
  btns.push(b2);
  netWaitScreen(N, {
    kanji: '待', title: 'Duel privé',
    lead: `Envoie le lien à ton ami, ou dis-lui le code : il choisit « Rejoindre avec un code ». Format : ${fmtLabel(N.win)}.`,
    status: 'En attente de ton ami', extra: [codeEl], btns,
  });
}
function hostIncoming(N, c) {
  const refuse = () => c.on('open', () => { try { c.send({ t: 'busy' }); } catch { /* fermé */ } setTimeout(() => c.close(), 300); });
  if (G.net !== N || N.conn || N.pendingConn || N.phase !== 'lobby') { refuse(); return; }
  N.pendingConn = c;
  const to = setTimeout(() => { if (N.pendingConn === c) { N.pendingConn = null; c.close(); } }, 12000);
  c.on('data', m => {
    if (N.pendingConn !== c || !m || m.t !== 'hello') return;
    clearTimeout(to); N.pendingConn = null;
    if (G.net !== N || N.conn) { c.close(); return; }
    if (m.v !== NET_VER) { try { c.send({ t: 'err', code: 'version' }); } catch { /* fermé */ } setTimeout(() => c.close(), 300); return; }
    N.foeName = cleanName(m.name) || 'Adversaire';
    attachConn(N, c);
    setNetStatus(N, `${N.foeName} arrive`);
    hostStart();
  });
  c.on('close', () => { if (N.pendingConn === c) N.pendingConn = null; });
}

function joinScreen(prefill = '') {
  if (G.net) closeNet();
  G.screen = 'menu'; G.mode = null;
  const inp = el('input', 'net-input code');
  Object.assign(inp, { type: 'text', maxLength: 5, value: prefill, placeholder: 'ABCDE', autocomplete: 'off', spellcheck: false, autocapitalize: 'characters', id: 'netCode' });
  const msg = el('p', 'net-msg');
  msg.setAttribute('role', 'alert');
  const [nameRow, keep] = nameField();
  const codeRow = el('div', 'net-field');
  const lab = el('label', null, 'Code du duel'); lab.htmlFor = 'netCode';
  codeRow.append(lab, inp);
  const clean = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); };
  inp.addEventListener('input', clean);
  const submit = () => {
    clean();
    if (inp.value.length !== 5) { msg.textContent = 'Le code fait 5 caractères.'; inp.focus(); return; }
    keep();
    joinPrivate(inp.value);
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); Sound.init(); submit(); } });
  showScreen({
    kanji: '入',
    title: 'Rejoindre',
    lead: prefill ? 'Ton ami t’invite à un duel : choisis ton nom et c’est parti.' : 'Entre le code que ton ami voit sur son écran.',
    body: [nameRow, codeRow, msg, list(mbtn('Rejoindre', null, true, submit), mbtn('Retour', null, false, onlineMenu, 'quiet'))],
    focus: prefill ? '.mbtn.primary' : 'input',
    back: onlineMenu,
  });
}
async function joinPrivate(code) {
  const N = newNet('guest', 'private');
  N.code = code;
  netWaitScreen(N, { kanji: '入', title: 'Rejoindre', lead: `Duel ${code}`, status: 'Connexion au serveur de mise en relation' });
  try { await loadPeerJS(); } catch { netError(N, 'lib'); return; }
  const r = await openPeer(null);
  if (G.net !== N) { if (r.peer) r.peer.destroy(); return; }
  if (!r.peer) { netError(N, r.error); return; }
  N.peer = r.peer;
  setNetStatus(N, 'Recherche du duel');
  const c = await tryConnect(N.peer, PEER_PREFIX + code, helloMsg(N));
  if (G.net !== N) { if (c.conn) c.conn.close(); return; }
  if (!c.conn) { netError(N, c.error); return; }
  attachConn(N, c.conn);
  guestGotStart(c.start);
}

function searchingScreen(N, status = 'Connexion au serveur de mise en relation') {
  netWaitScreen(N, {
    kanji: '探', title: 'Partie rapide',
    lead: `Le combat commence dès qu’un autre joueur lance une partie rapide. Format : ${fmtLabel(QUICK_WIN)}.`,
    status,
    extra: [el('p', 'note', 'Pour jouer tout de suite avec un ami, crée plutôt un duel privé et envoie-lui le code.')],
  });
  if (!N.searchAt) N.searchAt = performance.now();
  clearInterval(N.uiTimer);
  N.uiTimer = setInterval(() => {
    if (G.net !== N || N.phase !== 'lobby' || !N.waiting || N.conn) return;
    const s = Math.floor((performance.now() - N.searchAt) / 1000);
    setNetStatus(N, `Recherche d’un adversaire, ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  }, 500);
}
/** Essaie tous les emplacements à la fois : le premier hôte qui répond gagne, les autres sont refermés. */
function probeSlots(N, peer, slots) {
  return new Promise(res => {
    let left = slots.length, won = false;
    for (const s of slots) tryConnect(peer, PEER_PREFIX + 'q' + s, helloMsg(N)).then(r => {
      left--;
      if (r.conn) { if (won || G.net !== N) r.conn.close(); else { won = true; res(r); } }
      if (!left && !won) res(null);
    });
  });
}
/**
 * Partie rapide sans serveur de jeu : on cherche un hôte en attente dans l'un des emplacements
 * fixes (dohyo-duel-v1-q0…q5). Personne ? On s'installe dans le premier libre et on attend.
 */
async function quickMatch() {
  const N = newNet(null, 'quick');
  searchingScreen(N);
  try { await loadPeerJS(); } catch { netError(N, 'lib'); return; }
  const guestWith = (peer, found) => {
    N.role = 'guest'; N.me = 1; N.peer = peer;
    attachConn(N, found.conn);
    setNetStatus(N, 'Adversaire trouvé');
    guestGotStart(found.start);
  };
  let r = await openPeer(null);
  if (G.net !== N) { if (r.peer) r.peer.destroy(); return; }
  if (!r.peer) { netError(N, r.error); return; }
  setNetStatus(N, 'Recherche d’un adversaire');
  const found = await probeSlots(N, r.peer, [...Array(QUICK_SLOTS).keys()]);
  if (G.net !== N) { r.peer.destroy(); if (found) found.conn.close(); return; }
  if (found) { guestWith(r.peer, found); return; }
  r.peer.destroy();
  for (let s = 0; s < QUICK_SLOTS; s++) {
    const h = await openPeer(PEER_PREFIX + 'q' + s);
    if (G.net !== N) { if (h.peer) h.peer.destroy(); return; }
    if (h.peer) {
      listenAsHost(N, h.peer);
      N.waiting = true;
      return;
    }
    if (h.error !== 'unavailable-id') { netError(N, h.error); return; }
    // quelqu'un vient de s'installer dans cet emplacement : on tente de le rejoindre
    const g = await openPeer(null);
    if (G.net !== N) { if (g.peer) g.peer.destroy(); return; }
    if (!g.peer) continue;
    const f = await probeSlots(N, g.peer, [s]);
    if (G.net !== N) { g.peer.destroy(); if (f) f.conn.close(); return; }
    if (f) { guestWith(g.peer, f); return; }
    g.peer.destroy();
  }
  netError(N, 'full');
}

function onlineResult() {
  const N = G.net;
  if (!N) return;
  const S = G.S, w = N.resultW, won = w === N.me, foe = N.foeName;
  N.resultShown = true;
  const fin = el('div', 'final');
  fin.setAttribute('aria-label', `Score ${S.score[0]} à ${S.score[1]}`);
  fin.append(el('span', 'e', S.score[0]), el('span', null, '–'), el('span', 'w', S.score[1]));
  let rem;
  if (N.gone) { rem = mbtn('Revanche', `${foe} est parti`, false, () => {}); rem.disabled = true; }
  else if (N.rematch[N.me]) rem = mbtn('Revanche demandée', N.rematch[1 - N.me] ? 'C’est parti' : `En attente de ${foe}`, true, () => {});
  else rem = mbtn('Revanche', N.rematch[1 - N.me] ? `${foe} veut une revanche !` : 'Même adversaire, même format', true, askRematch);
  showScreen({
    kanji: won ? '勝' : '負', seal: won ? 'shu' : 'ink',
    title: won ? 'Victoire' : 'Défaite',
    lead: (won ? `Tu as battu ${foe}` : `${foe} t’a battu`) + (G.kimarite === 'utchari' ? ', par utchari.' : '.'),
    body: [fin, statsTable(), list(rem, shareButton(G.lastReplay), mbtn('Quitter', 'Retour au menu en ligne', false, () => leaveOnline(), 'quiet'))],
    focus: N.gone ? '.mbtn.quiet' : undefined,
  });
}
/** Échap pendant un duel : pas de pause en ligne, on propose d'abandonner. */
function onlineQuitScreen() {
  held.clear();
  showScreen({
    kanji: '退',
    title: 'Quitter le duel ?',
    lead: 'Pas de pause en ligne : le combat continue derrière ce menu, et ton lutteur ne bouge plus.',
    body: [list(
      mbtn('Reprendre le combat', keyOrPad('Échap', 9), true, hideOverlay),
      mbtn('Abandonner', 'Ton adversaire gagne par forfait', false, () => leaveOnline(menu), 'quiet'),
    )],
    back: hideOverlay,
  });
}
function setPauseLabel() { $('pauseBtn').firstChild.textContent = G.mode === 'online' ? 'Quitter' : 'Pause'; }
const netInfo = $('netInfo');
function netHud() {
  const N = G.mode === 'online' && G.screen === 'match' ? G.net : null;
  if (netInfo.hidden !== !N) netInfo.hidden = !N;
  if (!N) return;
  const slow = N.M && N.M.stallT > 0.25;
  const t = slow ? 'Connexion instable' : N.rtt != null ? `Ping ${Math.round(N.rtt)} ms` : 'Ping …';
  if (netInfo.textContent !== t) netInfo.textContent = t;
  netInfo.classList.toggle('bad', slow || (N.rtt || 0) > 160);
}
/** « Toi » au-dessus de son lutteur avant le signal : en ligne, on n'a pas forcément le rouge. */
function drawYouMarker(S, alpha) {
  const p = S.p[G.net.me];
  const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha - 92;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '400 30px "Dela Gothic One", "Arial Black", sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText('Toi', x + 2, y + 2);
  ctx.fillStyle = G.net.me === 0 ? '#ff8a73' : '#8cb8ff';
  ctx.fillText('Toi', x, y);
  ctx.beginPath(); ctx.moveTo(x - 11, y + 22); ctx.lineTo(x + 11, y + 22); ctx.lineTo(x, y + 34); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export {
  drawYouMarker, joinScreen, netHud, onlineMenu, onlineQuitScreen, onlineResult, searchingScreen,
  setPauseLabel, waitingScreen,
};
