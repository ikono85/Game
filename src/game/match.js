/**
 * Match local : départ, tableau des stats, ralenti puis écran de résultat.
 */
import { Sound } from '../audio/sound.js';
import { RANKS, career } from './career.js';
import { save } from './save.js';
import { G, newStats } from './state.js';
import { latch } from '../input/keyboard.js';
import { setPauseLabel } from '../net/screens.js';
import { fmtSec, handleEvents, throwZabuton } from '../render/effects.js';
import { startReplay } from '../render/replay.js';
import { STYLES, makeProfile } from '../sim/ai.js';
import { newMatch } from '../sim/simulation.js';
import { careerBoutResult } from '../ui/career.js';
import { setNames, updateScore } from '../ui/hud.js';
import { menu } from '../ui/menus.js';
import { el, hideOverlay, list, mbtn, showScreen } from '../ui/widgets.js';

function startMatch(opts) {
  G.mode = opts.mode; G.opp = opts.opp || null;
  G.skins[0] = save.skin;
  const win = opts.mode === 'career' ? 1 : 3;
  let ai = [null, null];
  if (G.opp) ai[1] = makeProfile(G.opp.style, G.opp.level);
  if (opts.mode === 'versus') { G.names = ['Rouge', 'Bleu']; setNames('Rouge', 'Est', 'Bleu', 'Ouest'); }
  else if (opts.mode === 'ai') { G.names = ['Rouge', G.opp.name]; setNames('Rouge', 'Est', G.opp.name, STYLES[G.opp.style].label); }
  else {
    const c = career();
    G.names = ['Toi', G.opp.name];
    setNames(RANKS[c.rank].name, 'Est', G.opp.name, RANKS[G.opp.rank].name);
  }
  G.S = newMatch({ seed: (Math.random() * 2 ** 31) | 0, win, ai });
  resetMatchFx();
  hideOverlay(); updateScore(); setPauseLabel();
  handleEvents(G.S);
}
function resetMatchFx() {
  G.screen = 'match'; G.paused = false; G.acc = 0; G.particles = []; G.flash = null; G.zabuton.length = 0;
  G.down = [false, false];
  G.stats = [newStats(), newStats()]; G.dashOpen = [false, false]; G.labels = []; G.rec = []; G.replay = null; G.kimarite = null;
  latch.forEach(l => { l.dash = l.feint = false; });
}

/** Tableau des stats du match, joueur par joueur. */
function statsTable() {
  const t = el('table', 'stats');
  const head = el('tr');
  head.append(el('th'), el('th', 'e', G.names[0]), el('th', 'w', G.names[1]));
  t.append(head);
  const rows = [
    ['Dashs qui ont touché', st => `${st.dashHit} sur ${st.dash}`],
    ['Coups bloqués', st => st.block],
    ['Feintes', st => st.feint],
    ['Faux départs', st => st.matta],
    ['Résistances au bord', st => st.hold],
    ['Utchari', st => st.utchari],
    ['Utchari contrés', st => st.counter],
    ['Meilleur départ', st => st.best == null ? '–' : fmtSec(st.best)],
  ];
  for (const [label, f] of rows) {
    const tr = el('tr');
    tr.append(el('td', null, label), el('td', null, String(f(G.stats[0]))), el('td', null, String(f(G.stats[1]))));
    t.append(tr);
  }
  return t;
}

function onMatchEnd(w) {
  // d'abord le ralenti du coup gagnant, ensuite les coussins éventuels et l'écran de résultat
  startReplay(() => afterReplay(w));
}
function afterReplay(w) {
  const S = G.S;
  // Exploit : battre un lutteur mieux classé, le Yokozuna, ou remonter de 0–2.
  // Les coussins volent dans l'arène avant que l'écran de résultat ne la recouvre.
  let upset;
  if (G.mode === 'career') { const c = career(); upset = w === 0 && (G.opp.rank > c.rank || G.opp.style === 'yokozuna'); }
  else upset = G.down[w] || (G.mode === 'ai' && w === 0 && G.opp.style === 'yokozuna');
  if (upset) throwZabuton();
  Sound.roll();
  const delay = upset ? 2000 : 450;
  if (G.mode === 'career') { setTimeout(() => careerBoutResult(w === 0), delay); return; }
  const fin = el('div', 'final');
  fin.setAttribute('aria-label', `Score ${S.score[0]} à ${S.score[1]}`);
  fin.append(el('span', 'e', S.score[0]), el('span', null, '–'), el('span', 'w', S.score[1]));
  setTimeout(() => showScreen({
    kanji: '勝', seal: w === 0 ? 'shu' : 'blue',
    title: `${G.names[w]} gagne`,
    lead: (w === 0 ? "Victoire à l'est" : "Victoire à l'ouest") + (G.kimarite === 'utchari' ? ', par utchari.' : '.'),
    body: [fin, statsTable(), list(
      mbtn('Revanche', G.mode === 'versus' ? 'Mêmes joueurs' : `Contre ${G.opp.name}`, true, () => startMatch({ mode: G.mode, opp: G.opp })),
      mbtn('Menu', null, false, menu, 'quiet'),
    )],
  }), delay);
}

export { onMatchEnd, resetMatchFx, startMatch, statsTable };
