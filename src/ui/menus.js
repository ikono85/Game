/**
 * Menu principal et choix de l'adversaire IA.
 */
import { RANKS, SHIKONA } from '../game/career.js';
import { startMatch } from '../game/match.js';
import { save } from '../game/save.js';
import { G } from '../game/state.js';
import { closeNet } from '../net/netcode.js';
import { onlineMenu, setPauseLabel } from '../net/screens.js';
import { STYLES, STYLE_ORDER } from '../sim/ai.js';
import { careerHub, wardrobe } from './career.js';
import { dojoMenu } from '../game/dojo.js';
import { LESSONS } from '../game/dojolessons.js';
import { setNames, updateScore } from './hud.js';
import { titleScreen } from './title.js';
import { dots, el, list, mbtn, showScreen } from './widgets.js';

function menu() {
  if (G.net) closeNet();
  G.screen = 'menu'; G.mode = null; G.paused = false; G.zabuton.length = 0;
  G.watch = null; G.dojo = null; G.recorder = null;
  setNames('Rouge', 'Est', 'Bleu', 'Ouest'); updateScore(); setPauseLabel();
  const c = save.career;
  showScreen({
    kanji: '相撲',
    title: 'Menu principal',
    body: [list(
      mbtn('Carrière', c ? `${RANKS[c.rank].name}, basho ${c.bashoNo} : monte du Jonokuchi au Yokozuna` : 'Monte le banzuke du Jonokuchi au Yokozuna, un basho après l’autre', true, careerHub),
      mbtn('Combat', 'Contre l’IA ou à deux sur le même écran', false, combatMenu),
      mbtn('En ligne', 'Partie rapide ou duel privé avec un ami', false, onlineMenu),
      mbtn('Dojo', dojoSub(), false, () => dojoMenu()),
      mbtn('Vestiaire', 'Ta ceinture et ton arène', false, () => wardrobe(menu)),
    )],
    back: titleScreen,
  });
}

/** Combat libre : contre l'IA, ou à deux sur le même écran. */
function combatMenu() {
  showScreen({
    kanji: '勝負',
    title: 'Combat',
    body: [list(
      mbtn("Contre l'IA", 'Cinq adversaires, cinq styles. Premier à trois manches', true, aiSelect),
      mbtn('2 joueurs', 'Même clavier ou deux manettes. Premier à trois manches', false, () => startMatch({ mode: 'versus' })),
    )],
    back: menu,
  });
}

/** Sous-titre du Dojo : progression des leçons. */
function dojoSub() {
  const done = (save.dojo && save.dojo.done || []).length;
  return done === 0 ? 'Apprendre les techniques, pas à pas' : done >= LESSONS.length ? 'Toutes les leçons réussies' : `${done} leçon${done > 1 ? 's' : ''} sur ${LESSONS.length} réussie${done > 1 ? 's' : ''}`;
}

function aiSelect() {
  const btns = STYLE_ORDER.map((id, k) => {
    const s = STYLES[id], name = SHIKONA[k * 3];
    const lab = el('span', 'opp-name');
    lab.append(document.createTextNode(name), el('span', 'opp-style', s.label), el('span', 'opp-desc', s.desc));
    const b = mbtn('', dots(s.stars), false, () => startMatch({ mode: 'ai', opp: { name, style: id, level: 0.35 + s.stars * 0.12 } }), 'opp');
    b.firstChild.replaceWith(lab);
    return b;
  });
  showScreen({
    kanji: '稽古',
    title: "Contre l'IA",
    lead: 'Premier à trois manches. Chaque lutteur a sa façon de combattre.',
    body: [list(...btns)],
    back: combatMenu,
  });
}

export { menu };
