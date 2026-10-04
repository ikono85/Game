/**
 * Clavier : touches modifiables et sauvegardées, noms des touches selon le clavier (AZERTY…).
 * On lit la touche physique (e.code), donc tout marche en AZERTY comme en QWERTY.
 */
import { Sound } from '../audio/sound.js';
import { persist, save } from '../game/save.js';
import { G } from '../game/state.js';
import { skipIntro } from '../ui/versus.js';
import { endReplay } from '../render/replay.js';
import { captureKey } from '../ui/controls.js';
import { ov } from '../ui/dom.js';
import { autoPause, toggleMute, togglePause } from '../ui/pause.js';
import { watchNext, watchPause, watchSpeed } from '../game/watch.js';

const held = new Set();
const latch = [{ dash: false, feint: false }, { dash: false, feint: false }];
// Touches par défaut ; le joueur peut tout changer dans « Commandes » (sauvegardé en local)
const ACTIONS = ['up', 'down', 'left', 'right', 'dash', 'guard', 'feint'];
const DEFAULT_BIND = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], dash: ['Space'], guard: ['KeyE'], feint: ['KeyF'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    dash: ['Enter', 'NumpadEnter'], guard: ['ShiftRight', 'Numpad0'], feint: ['ControlRight', 'Numpad1'] },
];
// Manette : boutons par action (position standard : 0 bas, 1 droite, 2 gauche, 3 haut, 4-7 gâchettes)
const PAD_ACTIONS = ['dash', 'guard', 'feint'];
const DEFAULT_PAD = { dash: [0], guard: [1, 4, 5, 6, 7], feint: [2, 3] };
const KEYS_MAX = 2, PAD_MAX = 5;
const PAD_BINDABLE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11];      // pas Start (pause) ni la croix (déplacement)
const RESERVED_CODES = new Set(['Escape']);
let BIND = structuredClone(DEFAULT_BIND), PAD = structuredClone(DEFAULT_PAD);
let ALL_GAME_CODES = new Set();
/** Recharge les touches sauvegardées (une action invalide ou vide reprend sa valeur par défaut). */
function loadBinds() {
  const b = save.binds || {};
  const okKey = c => typeof c === 'string' && c.length > 0 && c.length < 40 && !RESERVED_CODES.has(c);
  BIND = DEFAULT_BIND.map((def, i) => Object.fromEntries(ACTIONS.map(a => {
    const v = b.keys && b.keys[i] && b.keys[i][a];
    const list = Array.isArray(v) ? [...new Set(v.filter(okKey))].slice(0, KEYS_MAX) : [];
    return [a, list.length ? list : def[a].slice()];
  })));
  PAD = Object.fromEntries(PAD_ACTIONS.map(a => {
    const v = b.pad && b.pad[a];
    const list = Array.isArray(v) ? [...new Set(v.filter(k => PAD_BINDABLE.includes(k)))].slice(0, PAD_MAX) : [];
    return [a, list.length ? list : DEFAULT_PAD[a].slice()];
  }));
  ALL_GAME_CODES = new Set(BIND.flatMap(x => Object.values(x).flat()));
}
function resetBinds() { BIND = structuredClone(DEFAULT_BIND); PAD = structuredClone(DEFAULT_PAD); storeBinds(); }
function storeBinds() {
  save.binds = { keys: BIND, pad: PAD };
  persist();
  ALL_GAME_CODES = new Set(BIND.flatMap(x => Object.values(x).flat()));
  held.clear();
}
// Noms des touches. Pour les lettres, on retient ce que le clavier a réellement tapé (AZERTY, QWERTZ…).
const KEY_NAMES = {
  Space: 'Espace', Enter: 'Entrée', NumpadEnter: 'Entrée pavé', Tab: 'Tab', Backspace: 'Retour arr.', CapsLock: 'Verr. maj',
  ShiftLeft: 'Maj gauche', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl gauche', ControlRight: 'Ctrl droit',
  AltLeft: 'Alt', AltRight: 'Alt Gr', MetaLeft: 'Méta', MetaRight: 'Méta droit', ContextMenu: 'Menu',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Insert: 'Inser', Delete: 'Suppr', Home: 'Début', End: 'Fin', PageUp: 'Page préc.', PageDown: 'Page suiv.',
  NumpadAdd: '+ pavé', NumpadSubtract: '− pavé', NumpadMultiply: '× pavé', NumpadDivide: '÷ pavé', NumpadDecimal: ', pavé',
};
const AZERTY_GUESS = { KeyW: 'Z', KeyA: 'Q', KeyQ: 'A', KeyZ: 'W', KeyM: ',', Semicolon: 'M' };   // sans info du navigateur
let layoutMap = null;
if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
  navigator.keyboard.getLayoutMap().then(m => { layoutMap = m; }).catch(() => {});
}
function keyName(code) {
  if (!code) return '';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  const seen = save.keyNames && save.keyNames[code];
  if (seen) return seen;
  const lm = layoutMap && layoutMap.get(code);
  if (lm && lm.trim()) return lm.toUpperCase();
  if (AZERTY_GUESS[code]) return AZERTY_GUESS[code];
  let m;
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
  if ((m = /^(?:Digit)(\d)$/.exec(code))) return m[1];
  if ((m = /^Numpad(\d)$/.exec(code))) return m[1] + ' pavé';
  return code;
}
/** Retient le nom affiché d'une touche, d'après le caractère qu'elle produit. */
function rememberKeyName(e) {
  if (KEY_NAMES[e.code] || !e.key || e.key.length !== 1 || e.key === ' ') return;
  save.keyNames = Object.assign({}, save.keyNames, { [e.code]: e.key.toUpperCase() });
}
const anyHeld = codes => codes.some(c => held.has(c));
const solo = () => G.mode === 'ai' || G.mode === 'career' || G.mode === 'online' || G.mode === 'dojo';
// En solo, les deux jeux de touches contrôlent le joueur rouge.
const bindsFor = i => solo() ? (i === 0 ? BIND : []) : [BIND[i]];
const inPlay = () => G.screen === 'match' && !G.paused && !G.intro && ov.hidden && G.S && G.S.phase !== 'matchEnd';

addEventListener('keydown', e => {
  Sound.init();
  if (G.capture) { captureKey(e); return; }               // « Commandes » : on attend la nouvelle touche
  if (G.replay) { e.preventDefault(); if (!e.repeat) endReplay(); return; }
  if (G.intro) { if (!e.repeat && ['Enter', 'Space', 'Escape', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); skipIntro(); } return; }
  const tag = e.target && e.target.tagName;
  if ((tag === 'INPUT' || tag === 'TEXTAREA') && e.code !== 'Escape') return;   // on tape un nom ou un code
  if (e.code === 'Escape') { if (!ov.hidden && G.back) G.back(); else togglePause(); return; }
  if (e.code === 'KeyM' && !e.repeat && !(inPlay() && ALL_GAME_CODES.has('KeyM'))) toggleMute();   // sauf si M sert au jeu
  if (!inPlay()) return;                     // menus : les touches gardent leur rôle normal
  if (G.mode === 'watch') {                  // ralenti partagé : pause, vitesse, manche suivante
    const act = { Space: watchPause, KeyV: watchSpeed, ArrowRight: watchNext }[e.code];
    if (act) { e.preventDefault(); if (!e.repeat) act(); }
    return;
  }
  if (ALL_GAME_CODES.has(e.code)) e.preventDefault();
  held.add(e.code);
  if (e.repeat) return;
  for (let i = 0; i < 2; i++) for (const b of bindsFor(i)) {
    if (b.dash.includes(e.code)) latch[i].dash = true;
    if (b.feint.includes(e.code)) latch[i].feint = true;
  }
});
addEventListener('keyup', e => {
  held.delete(e.code);
  if (G.swallowUp === e.code) { e.preventDefault(); G.swallowUp = null; }   // Espace qui vient d'être choisie : pas de clic
});
addEventListener('blur', () => { held.clear(); autoPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

export {
  ACTIONS, BIND, KEYS_MAX, PAD, PAD_ACTIONS, PAD_BINDABLE, PAD_MAX, anyHeld, bindsFor, held, inPlay,
  keyName, latch, loadBinds, rememberKeyName, resetBinds, storeBinds,
};
