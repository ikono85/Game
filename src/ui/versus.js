/**
 * Écran « VS » avant chaque combat, comme dans les jeux de combat : l'écran coupé en biais, le
 * lutteur de l'est en rouge à gauche, celui de l'ouest en bleu à droite, un grand VS au milieu,
 * coups de taiko. Pendant ce temps la simulation attend (voir la boucle). Une touche, un clic ou un
 * bouton de manette le passe, sauf en ligne où les deux joueurs doivent repartir ensemble.
 */
import { Sound } from '../audio/sound.js';
import { G } from '../game/state.js';
import { portrait } from '../render/portrait.js';
import { dots, el } from './widgets.js';

const DUR = 2.9, OUT = 0.45;                 // durée totale, et sortie (les deux moitiés s'écartent)
const vs = document.createElement('div');
vs.className = 'vs'; vs.hidden = true;
document.body.append(vs);

function side(info, cls) {
  const s = el('div', 'vs-side ' + cls);
  if (info.color) s.style.setProperty('--style', info.color);
  const k = el('div', 'vs-kanji', info.kanji || (cls === 'l' ? '東' : '西'));
  k.setAttribute('aria-hidden', 'true');
  const pic = portrait(info.skin, info.pose || 'player', 420, cls === 'l' ? 0 : Math.PI, 1.08);
  const txt = el('div', 'vs-txt');
  const name = el('h2', 'vs-name', info.name);
  name.style.setProperty('--len', Math.max(6, [...info.name].length));
  txt.append(el('p', 'vs-sub', info.sub || ''), name);
  if (info.stars) txt.append(dots(info.stars));
  s.append(k, pic, txt);
  return s;
}

/** left, right : { name, sub, skin, pose, kanji, color, stars } ; footer : l'arène, le format. */
function versusIntro({ left, right, footer, skippable = true }) {
  vs.replaceChildren(side(left, 'l'), side(right, 'r'), el('div', 'vs-mark', 'VS'), el('p', 'vs-foot', footer || ''));
  vs.classList.remove('out', 'go');
  void vs.offsetWidth;                       // relance les animations
  vs.classList.add('go');
  vs.hidden = false;
  document.body.classList.add('in-vs');
  G.intro = { t: DUR, skippable };
  if (Sound.ok()) { Sound.taiko(0.04, 72, 0.6); Sound.taiko(0.42, 54, 0.95); Sound.hyoshigi(1.25); Sound.hyoshigi(1.42); }
}
function skipIntro() {
  if (!G.intro || !G.intro.skippable || G.intro.t <= OUT) return;
  G.intro.t = OUT; vs.classList.add('out');
}
/** Appelé à chaque image par la boucle : vrai tant que l'écran VS est là (la simulation attend). */
function introTick(dt) {
  if (!G.intro) return false;
  G.intro.t -= dt;
  if (G.intro.t <= OUT) vs.classList.add('out');
  if (G.intro.t <= 0) endIntro();
  return true;
}
function endIntro() {
  if (!G.intro && vs.hidden) return;
  G.intro = null; G.acc = 0;
  vs.hidden = true; vs.replaceChildren(); vs.classList.remove('out', 'go');
  document.body.classList.remove('in-vs');
}
vs.addEventListener('pointerdown', skipIntro);

export { endIntro, introTick, skipIntro, versusIntro };
