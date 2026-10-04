/**
 * Écran titre : l'illustration en plein écran, avec ses trois boutons dessinés dedans (Jouer,
 * Options, Quitter). De vrais boutons, transparents, sont posés exactement dessus en pourcentage de
 * l'image : ils la suivent quel que soit le cadrage (écran large, tablette, téléphone en hauteur).
 * Souris, tactile, clavier (flèches, Entrée) et manette (croix, A) fonctionnent.
 */
import { ASSETS } from '../assets.js';
import { Sound } from '../audio/sound.js';
import { save } from '../game/save.js';
import { G } from '../game/state.js';
import { wardrobe } from './career.js';
import { controlsCard } from './controls.js';
import { card, ov } from './dom.js';
import { menu } from './menus.js';
import { toggleMute } from './pause.js';
import { el, list, mbtn, showScreen } from './widgets.js';

// Les boutons dessinés dans l'image (1672 × 941 px) : [id, nom, gauche, haut, largeur, hauteur] en %
const HOT = [
  ['play', 'Jouer', 36.6, 61.2, 26.75, 10.85],
  ['opt', 'Options', 44.26, 75.24, 11.96, 5.1],
  ['quit', 'Quitter', 44.26, 80.98, 11.96, 5.1],
];
const ACTIONS = {
  play: () => { Sound.taiko(0, 74, 0.7); Sound.taiko(0.16, 62, 0.8); menu(); },
  opt: () => { Sound.click(); optionsScreen(); },
  quit: () => { Sound.click(); quit(); },
};

document.getElementById('ov').style.setProperty('--art', `url(${ASSETS.title})`);   // l'illustration sert aussi de fond aux menus

function titleScreen() {
  G.back = null; G.capture = null;
  const bg = el('div', 'title-bg');                       // l'image floutée remplit les bords sur un écran en hauteur
  bg.style.backgroundImage = `url(${ASSETS.title})`;
  const art = el('div', 'title-art');
  const img = el('img');
  img.src = ASSETS.title; img.alt = 'Dohyō Duel'; img.draggable = false;
  art.append(img);
  const paper = el('div', 'title-paper');                 // des bouts de papier rouge qui tombent
  paper.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 10; i++) {
    const p = el('i');
    p.style.setProperty('--x', `${(i * 37 + 11) % 100}%`);
    p.style.setProperty('--d', `${8 + (i * 7) % 6}s`);
    p.style.setProperty('--delay', `${-((i * 2.3) % 9)}s`);
    p.style.setProperty('--r', `${(i % 2 ? 1 : -1) * (300 + i * 40)}deg`);
    paper.append(p);
  }
  art.append(paper);
  for (const [id, label, x, y, w, h] of HOT) {
    const b = el('button', 't-hot t-' + id);
    b.type = 'button'; b.setAttribute('aria-label', label);
    Object.assign(b.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' });
    b.addEventListener('click', () => { Sound.init(); ACTIONS[id](); });
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') b.focus({ preventScroll: true }); });   // un seul bouton en surbrillance
    art.append(b);
  }
  card.replaceChildren(bg, art);
  ov.classList.add('title');
  ov.hidden = false; ov.scrollTop = 0;
  document.body.classList.add('menu-open');
  setTimeout(() => { const f = card.querySelector('.t-play'); if (f) f.focus({ preventScroll: true }); }, 0);
}

// Flèches haut et bas pour passer d'un bouton à l'autre (Entrée ou Espace valide)
addEventListener('keydown', e => {
  if (ov.hidden || !ov.classList.contains('title') || (e.code !== 'ArrowUp' && e.code !== 'ArrowDown')) return;
  e.preventDefault();
  const items = Array.from(card.querySelectorAll('.t-hot'));
  const k = items.indexOf(document.activeElement), dir = e.code === 'ArrowUp' ? -1 : 1;
  items[k < 0 ? 0 : (k + dir + items.length) % items.length].focus({ focusVisible: true });
  Sound.click();
});

function optionsScreen() {
  showScreen({
    kanji: '設定',
    title: 'Options',
    body: [list(
      mbtn(save.muted ? 'Son : coupé' : 'Son : activé', 'Touche M, à tout moment', false, () => { toggleMute(); optionsScreen(); }),
      mbtn('Commandes', 'Clavier, manette, tactile', false, () => controlsCard(optionsScreen)),
      mbtn('Vestiaire', 'Ceinture et arène', false, () => wardrobe(optionsScreen)),
      mbtn('Retour', 'Écran titre', false, titleScreen, 'quiet'),
    )],
    back: titleScreen,
  });
}

/** Un navigateur ne laisse une page fermer son onglet que s'il l'a ouvert lui-même : sinon, on le dit. */
function quit() {
  window.close();
  setTimeout(() => {
    if (window.closed) return;
    showScreen({
      kanji: '千秋楽',
      title: 'À bientôt',
      lead: 'Le navigateur ne laisse pas une page fermer son propre onglet : tu peux le fermer toi-même. Ta progression est sauvegardée.',
      body: [list(mbtn('Revenir à l’écran titre', null, true, titleScreen))],
      back: titleScreen,
    });
  }, 150);
}

export { titleScreen };
