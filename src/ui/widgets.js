/**
 * Briques des menus : écran plein et opaque (grande colonne de kanji), boutons, petits éléments.
 */
import { Sound } from '../audio/sound.js';
import { BASHO_DAYS } from '../game/career.js';
import { G } from '../game/state.js';
import { padBadge } from '../input/gamepad.js';
import { card, ov } from './dom.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
/**
 * Affiche un écran de menu, façon jeu de combat : l'illustration assombrie en fond, le titre en haut à
 * gauche, une colonne de grands choix, la description du choix en cours dans un bandeau, et en bas la
 * barre des touches (avec « Retour » cliquable). Le kanji devient un grand filigrane à droite, ou un
 * tampon rouge pour les résultats (seal : 'shu' | 'ink' | 'blue').
 * Les boutons « Retour » des listes sont retirés quand l'écran a un retour : la barre du bas s'en charge.
 */
function showScreen({ kanji, title, lead, body = [], focus, seal, back = null }) {
  G.back = back; G.capture = null;
  const k = el('div', 'scr-kanji');
  k.setAttribute('aria-hidden', 'true');
  if (seal) { k.classList.add('seal', seal); k.textContent = kanji; }
  else {
    k.append(...[...kanji].map(ch => el('span', null, ch)));
    if ([...kanji].length >= 3) k.classList.add('long');
  }
  const main = el('div', 'scr-main');
  main.append(el('p', 'scr-kicker', 'Dohyō Duel'));
  if (title) main.append(el('h1', 'scr-title', title));
  if (lead) main.append(el('p', 'lead', lead));
  main.append(...body.filter(Boolean));
  if (back) for (const b of main.querySelectorAll('.mbtn.quiet')) if (b.firstChild && b.firstChild.textContent === 'Retour') b.remove();
  const info = el('div', 'scr-info');
  info.setAttribute('aria-hidden', 'true');           // le lecteur d'écran lit déjà le bouton lui-même
  card.replaceChildren(k, main, info, bottomBar(back));
  ov.classList.remove('title');                       // on quitte l'écran titre s'il était affiché
  ov.hidden = false; ov.scrollTop = 0;
  document.body.classList.add('menu-open');
  setTimeout(() => { const f = card.querySelector(focus || '.scr-main button:not(:disabled)'); if (f) f.focus({ focusVisible: true, preventScroll: true }); }, 0);   // sans faire défiler l'écran
}
/** La barre du bas : Retour (cliquable) et les touches, clavier ou manette. */
function bottomBar(back) {
  const bar = el('div', 'scr-bar');
  if (back) {
    const b = el('button', 'bar-back');
    b.type = 'button';
    const kb = el('span', 'kb-only key', 'Échap'), pad = el('span', 'pad-only'); pad.append(padBadge(1));
    b.append(kb, pad, document.createTextNode('Retour'));
    b.addEventListener('click', () => { Sound.click(); back(); });
    bar.append(b);
  } else bar.append(el('span'));
  const hints = el('div', 'bar-hints');
  const h = (keys, label) => { const s = el('span', 'kb-only'); for (const t of keys) s.append(el('span', 'key', t)); s.append(document.createTextNode(label)); return s; };
  const p = (i, label) => { const s = el('span', 'pad-only'); s.append(padBadge(i), document.createTextNode(label)); return s; };
  hints.append(h(['↑', '↓'], 'Choisir'), h(['Entrée'], 'Valider'), p(0, 'Valider'));
  bar.append(hints);
  return bar;
}
/** Le bandeau de description suit le choix en cours (sous-titre du bouton, description de l'adversaire). */
function describe(btn) {
  const info = card.querySelector('.scr-info');
  if (!info) return;
  const parts = [];
  if (btn && btn.classList.contains('mbtn')) {
    const name = btn.querySelector(':scope > span');
    if (name) parts.push(el('b', null, (name.firstChild && name.firstChild.nodeType === 3 ? name.firstChild.textContent : name.textContent).trim()));
    const d = btn.querySelector('.opp-desc'); if (d) parts.push(el('span', null, d.textContent));
    const sm = btn.querySelector(':scope > small'); if (sm) parts.push(sm.cloneNode(true));
    const dots = btn.querySelector(':scope > .dots'); if (dots) parts.push(dots.cloneNode(true));
  }
  info.replaceChildren(...parts);
  info.classList.toggle('on', parts.length > 1);
}
card.addEventListener('focusin', e => { if (!ov.classList.contains('title')) describe(e.target.closest('button')); });
card.addEventListener('pointerover', e => {           // la souris choisit, comme les flèches : un seul choix en surbrillance
  if (e.pointerType !== 'mouse' || ov.classList.contains('title')) return;
  const b = e.target.closest('.scr-main button:not(:disabled), .bar-back');
  if (b && document.activeElement !== b) b.focus({ preventScroll: true });
});
addEventListener('keydown', e => {                    // flèches haut et bas dans les menus
  if (ov.hidden || ov.classList.contains('title') || G.capture || (e.code !== 'ArrowUp' && e.code !== 'ArrowDown')) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const items = Array.from(card.querySelectorAll('.scr-main button:not(:disabled)'));
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement), d = e.code === 'ArrowUp' ? -1 : 1;
  const next = items[i < 0 ? 0 : (i + d + items.length) % items.length];
  next.focus({ focusVisible: true });
  next.scrollIntoView({ block: 'nearest' });
  Sound.click();
});
function hideOverlay() {
  G.back = null;
  ov.hidden = true; ov.classList.remove('title');
  document.body.classList.remove('menu-open');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function mbtn(label, sub, primary, fn, cls = '') {
  const b = el('button', 'mbtn' + (primary ? ' primary' : '') + (cls ? ' ' + cls : ''));
  b.type = 'button';
  b.append(el('span', null, label));
  if (sub != null) b.append(typeof sub === 'string' ? el('small', null, sub) : sub);
  b.addEventListener('click', () => { Sound.init(); Sound.click(); fn(); });
  return b;
}
const list = (...btns) => { const d = el('div', 'menu-btns'); d.append(...btns.filter(Boolean)); return d; };
function recordEl(results, current) {
  const r = el('div', 'record');
  r.setAttribute('aria-label', `${results.filter(x => x).length} victoires, ${results.filter(x => x === 0).length} défaites`);
  for (let d = 0; d < BASHO_DAYS; d++) {
    const s = el('span', 'day' + (results[d] === 1 ? ' w' : results[d] === 0 ? ' l' : d === current ? ' now' : ''));
    s.title = `Jour ${d + 1}`;
    r.append(s);
  }
  return r;
}
function dots(n) {
  const d = el('span', 'dots');
  d.setAttribute('aria-label', `difficulté ${n} sur 5`);
  for (let k = 0; k < 5; k++) d.append(el('i', k < n ? 'on' : ''));
  return d;
}

export { dots, el, hideOverlay, list, mbtn, recordEl, showScreen };
