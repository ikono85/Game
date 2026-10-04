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
import { Sound } from '../audio/sound.js';
import { LOOKS, portrait } from '../render/portrait.js';

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

/**
 * Choix de l'adversaire, façon jeu de combat : une rangée de portraits, la fiche du lutteur choisi
 * en grand (portrait, nom, style, difficulté, description). Flèches ou survol pour choisir, Entrée
 * ou clic pour combattre ; au doigt, un premier appui choisit, un second lance le combat.
 */
let lastPick = 0;
function aiSelect() {
  const opps = STYLE_ORDER.map((id, k) => ({ id, name: SHIKONA[k * 3], s: STYLES[id], look: LOOKS[id] }));
  const hero = el('div', 'pick-hero');
  const go = i => { lastPick = i; const o = opps[i]; startMatch({ mode: 'ai', opp: { name: o.name, style: o.id, level: 0.35 + o.s.stars * 0.12 } }); };
  let cur = -1;
  const show = i => {
    if (i === cur) return;
    cur = i;
    const o = opps[i];
    hero.style.setProperty('--style', o.look.color);
    const info = el('div', 'pick-info');
    info.append(el('p', 'pick-style', o.s.label.replace(/^l[ea] /, '')), Object.assign(el('h2', 'pick-name', o.name), { style: `--len:${o.name.length}` }), dots(o.s.stars), el('p', 'pick-desc', o.s.desc),
      mbtn('Combattre', null, true, () => go(cur), 'pick-go'));
    const k = el('div', 'pick-kanji', o.look.kanji);
    k.setAttribute('aria-hidden', 'true');
    hero.replaceChildren(k, portrait('bleu', o.id, 300, Math.PI * 0.75, 0.98), info);
    cards.forEach((c, j) => c.classList.toggle('cur', j === i));
  };
  let pointer = 'mouse', before = -1;
  const cards = opps.map((o, i) => {
    const c = el('button', 'pick-card');
    c.type = 'button';
    c.style.setProperty('--style', o.look.color);
    c.setAttribute('aria-label', `${o.name}, ${o.s.label}, difficulté ${o.s.stars} sur 5`);
    const k = el('span', 'pc-kanji', o.look.kanji);
    c.append(k, portrait('bleu', o.id, 120, Math.PI * 0.75, 1.2), el('span', 'pc-name', o.name), dots(o.s.stars));
    c.addEventListener('pointerdown', e => { pointer = e.pointerType; before = cur; });
    c.addEventListener('focus', () => show(i));
    c.addEventListener('click', () => {
      Sound.init();
      if (pointer === 'touch' && before !== i) { show(i); Sound.click(); pointer = 'mouse'; return; }   // au doigt : d'abord choisir
      Sound.click(); go(i);
    });
    return c;
  });
  const row = el('div', 'pick-row');
  row.append(...cards);
  show(Math.min(lastPick, opps.length - 1));
  showScreen({
    kanji: '稽古',
    title: 'Choisis ton adversaire',
    lead: 'Premier à trois manches. Chaque lutteur a sa façon de combattre.',
    body: [row, hero],                      // la rangée d'abord : les flèches vont de portrait en portrait, puis « Combattre »
    focus: `.pick-card:nth-child(${cur + 1})`,
    back: combatMenu,
    cls: 'pick',
  });
}

export { menu };
