/**
 * Ralentis partagés : bouton « Partager le ralenti » (copie un lien) et lecteur qui rejoue tout le
 * combat à partir du lien (pause, vitesse, manche suivante).
 */
import { Sound } from '../audio/sound.js';
import { kimariteText } from '../sim/kimarite.js';
import { decodeReplay, encodeReplay, newPlayback, playbackStep, replayReady } from './replayfile.js';
import { G } from './state.js';
import { resetMatchFx, statsTable } from './match.js';
import { handleEvents } from '../render/effects.js';
import { $ } from '../ui/dom.js';
import { setNames, updateScore } from '../ui/hud.js';
import { menu } from '../ui/menus.js';
import { el, hideOverlay, list, mbtn, showScreen } from '../ui/widgets.js';

const PUBLIC_URL = 'https://ikono85.github.io/Game/';   // le jeu publié (pour un lien créé depuis le fichier local)
const SPEEDS = [1, 2, 0.5];

/** Adresse à partager : la page actuelle si elle est en ligne, sinon le jeu publié. */
function replayUrl(text) {
  const base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : PUBLIC_URL;
  return base + '#replay=' + text;
}
async function replayLink(R) {
  if (!R.text) R.text = await encodeReplay(R);
  return replayUrl(R.text);
}

/**
 * Bouton « Partager le ralenti » pour un écran de fin. R : l'enregistrement du match.
 * Copie le lien ; si la copie est refusée, affiche le lien sélectionné, prêt à copier à la main.
 */
function shareButton(R) {
  if (!replayReady(R) || typeof CompressionStream === 'undefined') return null;
  R.meta.kimarite = G.kimarite;
  const box = el('div', 'share');
  const b = mbtn('Partager le ralenti', 'Copie un lien qui rejoue tout le combat', false, async () => {
    const sub = b.querySelector('small');
    let url;
    try { url = await replayLink(R); } catch { sub.textContent = 'Impossible de créer le lien'; return; }
    const manual = () => {
      sub.textContent = 'Copie le lien ci-dessous';
      if (box.querySelector('input')) return;
      const inp = el('input', 'net-input share-link');
      Object.assign(inp, { type: 'text', readOnly: true, value: url, spellcheck: false });
      inp.setAttribute('aria-label', 'Lien du ralenti');
      inp.addEventListener('focus', () => inp.select());
      box.append(inp); inp.focus();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => { sub.textContent = `Lien copié ! (${Math.round(url.length / 100) / 10} k caractères)`; }, manual);
    } else manual();
  });
  box.append(b);
  return box;
}

/** Lance la lecture d'un ralenti décodé. */
function startWatch(R) {
  G.mode = 'watch'; G.opp = null;
  G.names = R.meta.names.slice(); G.skins[0] = R.meta.skins[0];
  setNames(G.names[0], 'Est', G.names[1], 'Ouest');
  const P = newPlayback(R);
  G.S = P.S;
  resetMatchFx();
  G.watch = Object.assign(P, { speed: 1, paused: false });
  G.lastReplay = R;
  hideOverlay(); updateScore(); syncWatchBar();
  handleEvents(G.S);
}

/** Ouvre un lien …#replay=… */
async function openReplayLink(text) {
  let R;
  try { R = await decodeReplay(text); } catch (e) {
    const version = e && e.message === 'version';
    showScreen({
      kanji: '映', title: version ? 'Autre version du jeu' : 'Ralenti illisible',
      lead: version ? 'Ce ralenti a été enregistré avec une autre version de Dohyō Duel : il ne rejouerait pas le même combat.'
        : typeof DecompressionStream === 'undefined' ? 'Ce navigateur est trop ancien pour lire les ralentis partagés.'
        : 'Le lien semble coupé ou abîmé. Demande à ton ami de le copier à nouveau.',
      body: [list(mbtn('Menu', null, true, menu))],
      back: menu,
    });
    return;
  }
  const [a, b] = R.meta.names;
  showScreen({
    kanji: '映', title: 'Ralenti partagé',
    lead: `${a} contre ${b}. Tout le combat est rejoué, du premier tachiai au dernier coup.`,
    body: [list(mbtn('Regarder', 'Espace : pause · → : manche suivante · V : vitesse', true, () => startWatch(R)), mbtn('Menu', null, false, menu, 'quiet'))],
    back: menu,
  });
}

// --- Commandes du lecteur ---
function watchPause() { const W = G.watch; if (!W) return; W.paused = !W.paused; G.last = performance.now(); syncWatchBar(); }
function watchSpeed() { const W = G.watch; if (!W) return; W.speed = SPEEDS[(SPEEDS.indexOf(W.speed) + 1) % SPEEDS.length]; syncWatchBar(); }
/** Saute à la manche suivante : on simule vite, sans effets ni sons. */
function watchNext() {
  const W = G.watch;
  if (!W || W.S.phase === 'matchEnd') return;
  const rn0 = W.S.rn;
  let end = false;
  for (let n = 0; n < 120 * 900 && W.S.rn === rn0 && W.S.phase !== 'matchEnd'; n++) {
    playbackStep(W);
    if (W.S.events.some(e => e.type === 'matchWin')) end = true;
    W.S.events = W.S.events.filter(e => e.type === 'matchWin');
  }
  G.rec = []; G.labels = []; G.particles = []; G.flash = null; G.acc = 0;
  updateScore();
  if (end || W.S.phase === 'matchEnd') handleEvents(W.S);
  else W.S.events.length = 0;
}
/** Fin du ralenti : résultat et stats, revoir ou partager. */
function watchEnd(w) {
  const R = G.lastReplay, S = G.S;
  const fin = el('div', 'final');
  fin.setAttribute('aria-label', `Score ${S.score[0]} à ${S.score[1]}`);
  fin.append(el('span', 'e', S.score[0]), el('span', null, '–'), el('span', 'w', S.score[1]));
  showScreen({
    kanji: '映', seal: w === 0 ? 'shu' : 'blue',
    title: `${G.names[w]} gagne`,
    lead: 'Fin du ralenti' + kimariteText(G.kimarite || R.meta.kimarite, 'gagné par'),
    body: [fin, statsTable(), list(
      mbtn('Revoir', 'Depuis le début', true, () => startWatch(R)),
      shareButton(R),
      mbtn('Jouer', 'Retour au menu', false, menu, 'quiet'),
    )],
    back: menu,
  });
}

const bar = $('watchBar'), barPause = $('wPause'), barSpeed = $('wSpeed');
function syncWatchBar() {
  const W = G.watch;
  if (!W) return;
  barPause.firstChild.textContent = W.paused ? 'Lecture' : 'Pause';
  barSpeed.firstChild.textContent = `Vitesse ×${String(W.speed).replace('.', ',')}`;
}
/** Barre du lecteur visible seulement pendant la lecture (pas sur les menus ni pendant le ralenti final). */
function watchHud() {
  const show = !!G.watch && G.mode === 'watch' && G.screen === 'match' && !G.replay && G.S && G.S.phase !== 'matchEnd' && $('ov').hidden;
  if (bar.hidden !== !show) bar.hidden = !show;
}
barPause.addEventListener('click', () => { Sound.init(); watchPause(); });
barSpeed.addEventListener('click', () => { Sound.init(); watchSpeed(); });
$('wNext').addEventListener('click', () => { Sound.init(); watchNext(); });
$('wQuit').addEventListener('click', () => { Sound.init(); menu(); });

export { openReplayLink, shareButton, startWatch, watchEnd, watchHud, watchNext, watchPause, watchSpeed };
