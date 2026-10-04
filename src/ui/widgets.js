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
 * Affiche un écran de menu plein et opaque.
 * kanji : la grande colonne verticale de gauche ; seal : 'shu' | 'ink' | 'blue' pour un tampon de résultat.
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
  if (title) main.append(el('h1', 'scr-title', title));
  if (lead) main.append(el('p', 'lead', lead));
  main.append(...body.filter(Boolean));
  const hint = el('p', 'pad-hint pad-only');           // visible seulement avec une manette branchée
  const h1 = el('span'); h1.append(padBadge(0), document.createTextNode('Valider'));
  hint.append(h1);
  if (back) { const h2 = el('span'); h2.append(padBadge(1), document.createTextNode('Retour')); hint.append(h2); }
  main.append(hint);
  card.replaceChildren(k, main);
  ov.classList.remove('title');                       // on quitte l'écran titre s'il était affiché
  ov.hidden = false; ov.scrollTop = 0;
  document.body.classList.add('menu-open');
  setTimeout(() => { const f = card.querySelector(focus || 'button:not(:disabled)'); if (f) f.focus({ focusVisible: true, preventScroll: true }); }, 0);   // sans faire défiler l'écran
}
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
