/**
 * Dojo : sept leçons courtes contre un apprenti, une par technique (dash, départ, garde, feinte,
 * tenir au bord, utchari, hanches basses). Les leçons elles-mêmes sont dans dojolessons.js.
 */
import { Sound } from '../audio/sound.js';
import { LESSONS } from './dojolessons.js';
import { persist, save } from './save.js';
import { G } from './state.js';
import { resetMatchFx } from './match.js';
import { careerHub } from '../ui/career.js';
import { PAD_GLYPHS } from '../input/gamepad.js';
import { BIND, PAD, keyName } from '../input/keyboard.js';
import { handleEvents } from '../render/effects.js';
import { newMatch } from '../sim/simulation.js';
import { $ } from '../ui/dom.js';
import { setNames, updateScore } from '../ui/hud.js';
import { menu } from '../ui/menus.js';
import { el, hideOverlay, list, mbtn, showScreen } from '../ui/widgets.js';

const WAIT_OK = 0.9, WAIT_FAIL = 1.0;      // secondes avant de remettre les lutteurs en place
const doneIds = () => (save.dojo && Array.isArray(save.dojo.done) ? save.dojo.done : []);
const isDone = L => doneIds().includes(L.id);

/** Nom de la touche d'une action pour le joueur rouge : clavier, manette ou écran tactile. */
function keyLabel(action) {
  const touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches && !G.padFamily;
  if (action === 'move') {
    if (G.padFamily) return 'le stick';
    if (touchOnly) return 'ton doigt';
    const b = BIND[0];
    return [b.up[0], b.left[0], b.down[0], b.right[0]].map(keyName).join(' ');
  }
  if (G.padFamily) return (PAD_GLYPHS[G.padFamily][PAD[action][0]] || ['?'])[0];
  if (touchOnly) return { dash: 'le bouton Dash', guard: 'le bouton Garde', feint: 'le bouton Feinte' }[action];
  return keyName(BIND[0][action][0]);
}

/** Liste des leçons. */
function dojoMenu() {
  if (G.dojo) G.dojo = null;
  G.screen = 'menu'; G.mode = null; G.paused = false;
  setNames('Rouge', 'Est', 'Bleu', 'Ouest'); updateScore();
  const next = LESSONS.findIndex(L => !isDone(L));
  const btns = LESSONS.map((L, i) => mbtn(`${i + 1}. ${L.title}`, isDone(L) ? 'Réussie' : i === next ? 'À faire' : null, i === next, () => startLesson(i)));
  showScreen({
    kanji: '道場',
    title: 'Dojo',
    lead: 'Sept leçons courtes contre un apprenti. Chacune t’apprend une technique qui sert en combat.',
    body: [list(...btns, mbtn('Retour', null, false, menu, 'quiet'))],
    focus: next >= 0 ? '.mbtn.primary' : undefined,
    back: menu,
  });
}

/** Lance (ou relance) une leçon. */
function startLesson(i) {
  const L = LESSONS[i];
  G.mode = 'dojo'; G.opp = null;
  G.names = ['Toi', 'Apprenti']; G.skins[0] = save.skin;
  setNames('Toi', 'Dojo', 'Apprenti', `Leçon ${i + 1}`);
  resetMatchFx();
  G.dojo = { i, L, count: 0, mem: {}, wait: 0, then: null, msg: '', frozen: false, ui: '' };
  setupAttempt();
  hideOverlay(); updateScore();
}
/** Nouvelle tentative : partie neuve, lutteurs en place. Les réussites déjà faites restent. */
function setupAttempt() {
  const D = G.dojo;
  const S = newMatch({ seed: (Math.random() * 2 ** 31) | 0, win: 99, ai: [null, null] });
  D.mem = { count: D.mem.count };            // la leçon garde son compteur (blocages de la garde)
  D.L.setup(S, D.mem);
  G.S = S; G.rec = []; G.labels = []; G.particles = []; G.flash = null; G.acc = 0;
  handleEvents(S);
}
function dojoRestart() {
  if (!G.dojo) return;
  startLesson(G.dojo.i);
}

/** Commande de l'apprenti (appelée à chaque tick, avant la simulation). */
function dojoCmd(S) {
  const D = G.dojo;
  if (!D.L.shikiri) S.roundT = Math.min(S.roundT, 2);     // le cercle ne rétrécit pas pendant les leçons
  return D.L.dummy(S, D.mem);
}

/** Après chaque tick : la leçon regarde ce qui s'est passé (ev : événements du tick). */
function dojoAfter(S, ev) {
  const D = G.dojo;
  if (!D || D.frozen) return;
  if (D.wait > 0) {                          // on laisse voir la fin de la tentative, puis on enchaîne
    D.wait -= 1 / 120;
    if (D.wait <= 0) D.then();
    return;
  }
  const r = D.L.check(S, ev, D.mem);
  if (!r) return;
  if (r.info) { D.msg = r.info; return; }
  D.msg = r.msg;
  if (r.ok) {
    D.count = D.L.counter ? D.L.reps : D.count + 1;
    G.flash = { text: D.count >= D.L.reps ? 'Réussi !' : r.msg, color: '#ffd166', t: 1.2 };
    Sound.taiko(0, 110, 0.6); G.cheer = Math.max(G.cheer, 1);
    D.wait = WAIT_OK;
    D.then = D.count >= D.L.reps ? lessonDone : setupAttempt;
  } else {
    G.flash = { text: r.fail ? 'Raté' : 'On recommence', color: '#efe3c8', t: 0.9 };
    D.wait = r.fail ? WAIT_FAIL : 0.6;
    D.then = setupAttempt;
  }
}

/** Leçon réussie : on l'enregistre et on propose la suivante. */
function lessonDone() {
  const D = G.dojo, L = D.L, i = D.i;
  D.frozen = true;
  if (!isDone(L)) { save.dojo = { done: [...doneIds(), L.id] }; persist(); }
  Sound.roll();
  const nextI = i + 1 < LESSONS.length ? i + 1 : -1;
  const all = LESSONS.every(isDone);
  showScreen({
    kanji: L.kanji, seal: 'shu',
    title: 'Réussi !',
    lead: L.learned,
    body: [list(
      nextI >= 0 ? mbtn(`Leçon suivante : ${LESSONS[nextI].title}`, `${nextI + 1} sur ${LESSONS.length}`, true, () => startLesson(nextI))
        : mbtn('Carrière', all ? 'Toutes les leçons sont réussies : place au banzuke' : 'Du Jonokuchi au Yokozuna', true, careerHub),
      mbtn('Refaire cette leçon', null, false, () => startLesson(i)),
      mbtn('Toutes les leçons', null, false, dojoMenu, 'quiet'),
    )],
    back: dojoMenu,
  });
}

// Panneau de la leçon en cours (en bas de l'écran)
const panel = $('dojoPanel'), pStep = $('djStep'), pReps = $('djReps'), pGoal = $('djGoal'), pMsg = $('djMsg');
function dojoHud() {
  const D = G.dojo;
  const show = !!D && G.mode === 'dojo' && G.screen === 'match' && $('ov').hidden;
  if (panel.hidden !== !show) panel.hidden = !show;
  if (!show) return;
  const goal = D.L.goal(keyLabel);
  const done = D.L.counter ? Math.min(D.L.reps, D.mem.count || 0) : D.count;   // la garde compte ses blocages
  const key = [D.i, done, goal, D.msg].join('|');
  if (key === D.ui) return;                  // rien de neuf : on ne touche pas au DOM
  D.ui = key;
  pStep.textContent = `Leçon ${D.i + 1} sur ${LESSONS.length} · ${D.L.title}`;
  pReps.replaceChildren(...Array.from({ length: D.L.reps }, (_, k) => el('i', k < done ? 'on' : '')));
  pReps.setAttribute('aria-label', `${done} réussite${done > 1 ? 's' : ''} sur ${D.L.reps}`);
  pGoal.textContent = goal;
  pMsg.textContent = D.msg;
}

export { dojoAfter, dojoCmd, dojoHud, dojoMenu, dojoRestart, startLesson };
