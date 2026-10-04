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
import { controlsCard } from './controls.js';
import { setNames, updateScore } from './hud.js';
import { dots, el, list, mbtn, showScreen } from './widgets.js';

function menu() {
  if (G.net) closeNet();
  G.screen = 'menu'; G.mode = null; G.paused = false; G.zabuton.length = 0;
  G.watch = null; G.dojo = null; G.recorder = null;
  setNames('Rouge', 'Est', 'Bleu', 'Ouest'); updateScore(); setPauseLabel();
  const c = save.career;
  showScreen({
    kanji: '相撲',
    title: 'Dohyō Duel',
    lead: "Pousse ton adversaire hors du cercle avant qu'il ne te sorte. Le cercle rétrécit à chaque instant.",
    body: [list(
      mbtn('Carrière', c ? `${RANKS[c.rank].name}, basho ${c.bashoNo}` : 'Du Jonokuchi au Yokozuna', true, careerHub),
      mbtn('Dojo', dojoSub(), false, () => dojoMenu()),
      mbtn('En ligne', 'Partie rapide ou duel privé avec un code', false, onlineMenu),
      mbtn('2 joueurs', 'Même clavier ou deux manettes', false, () => startMatch({ mode: 'versus' })),
      mbtn("Contre l'IA", 'Cinq adversaires, cinq styles', false, aiSelect),
      mbtn('Vestiaire', 'Ceinture et arène', false, () => wardrobe(menu)),
      mbtn('Commandes', 'Clavier, manette, tactile', false, () => controlsCard(menu)),
    )],
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
    lab.append(document.createTextNode(`${name}, ${s.label}`), el('span', 'opp-desc', s.desc));
    const b = mbtn('', dots(s.stars), false, () => startMatch({ mode: 'ai', opp: { name, style: id, level: 0.35 + s.stars * 0.12 } }), 'opp');
    b.firstChild.replaceWith(lab);
    return b;
  });
  showScreen({
    kanji: '稽古',
    title: "Contre l'IA",
    lead: 'Premier à trois manches. Chaque lutteur a sa façon de combattre.',
    body: [list(...btns, mbtn('Retour', null, false, menu, 'quiet'))],
    back: menu,
  });
}

export { menu };
