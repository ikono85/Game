/**
 * Écran Commandes : chaque touche se change d'un clic (clavier des deux joueurs, manette).
 */
import { Sound } from '../audio/sound.js';
import { G } from '../game/state.js';
import { PAD_GLYPHS, btn, padBadge, padEdge, padPrev, pads } from '../input/gamepad.js';
import {
  ACTIONS, BIND, KEYS_MAX, PAD, PAD_ACTIONS, PAD_BINDABLE, PAD_MAX, keyName, rememberKeyName,
  resetBinds, storeBinds,
} from '../input/keyboard.js';
import { el, list, mbtn, showScreen } from './widgets.js';

const ACTION_LABELS = {
  up: ['Haut', ''], down: ['Bas', ''], left: ['Gauche', ''], right: ['Droite', ''],
  dash: ['Dash', 'Coup d’épaule. Au bord : utchari. De côté quand il charge : henka'], guard: ['Garde', 'Maintenir. Contre l’utchari : hanches basses'], feint: ['Feinte', 'Faux dash'],
  grab: ['Saisie', 'Attraper la ceinture au contact. Tenu : dash pour te dégager ; tenant : dash pour projeter'],
};
const SIDE = ['Rouge', 'Bleu'];
const padName = k => (PAD_GLYPHS[G.padFamily || 'xbox'][k] || ['?'])[0];
const bindWho = (a, pl) => `« ${ACTION_LABELS[a][0]} » (${pl == null ? 'manette' : SIDE[pl]})`;
const capList = c => (c.scope === 'pad' ? PAD[c.a] : BIND[c.pl][c.a]);
const capLabel = (c, v) => (c.scope === 'pad' ? padName(v) : keyName(v));

function controlsCard(backFn) {
  const status = el('p', 'bind-status', 'Clique sur une touche pour la changer, ou sur + pour en ajouter une.');
  status.setAttribute('aria-live', 'polite');
  const table = el('table', 'controls binds');
  const ui = { status, render: null };
  const chip = (scope, pl, a, i, v) => {
    const b = el('button', 'kchip' + (v == null ? ' add' : '') + (scope === 'pad' ? ' padchip' : ''));
    b.type = 'button';
    b.dataset.k = `${scope}:${pl}:${a}:${i}`;
    const who = scope === 'pad' ? 'manette' : SIDE[pl];
    if (v == null) { b.textContent = '+'; b.setAttribute('aria-label', `Ajouter une touche : ${ACTION_LABELS[a][0]}, ${who}`); }
    else {
      if (scope === 'pad') b.append(padBadge(v)); else b.textContent = keyName(v);
      b.setAttribute('aria-label', `${ACTION_LABELS[a][0]}, ${who} : ${scope === 'pad' ? padName(v) : keyName(v)}. Changer`);
    }
    b.addEventListener('click', () => { Sound.init(); Sound.click(); startCapture({ scope, pl, a, i, el: b, ui }); });
    return b;
  };
  const cell = (scope, pl, a) => {
    const td = el('td', scope === 'pad' ? 'pad' : null);
    const list = scope === 'pad' ? PAD[a] : BIND[pl][a];
    list.forEach((v, i) => td.append(chip(scope, pl, a, i, v)));
    if (list.length < (scope === 'pad' ? PAD_MAX : KEYS_MAX)) td.append(chip(scope, pl, a, list.length, null));
    return td;
  };
  ui.render = focusK => {
    const head = el('tr');
    head.append(el('th'), el('th', 'e', 'Rouge'), el('th', 'w', 'Bleu'), el('th', 'pad', 'Manette'));
    const rows = [head];
    for (const a of ACTIONS) {
      const tr = el('tr');
      const td0 = el('td', null, ACTION_LABELS[a][0]);
      if (ACTION_LABELS[a][1]) td0.append(el('span', null, ACTION_LABELS[a][1]));
      tr.append(td0, cell('key', 0, a), cell('key', 1, a));
      if (a === 'up') { const pd = el('td', 'pad'); pd.rowSpan = 4; pd.append(el('span', 'pad-txt', 'Stick ou croix')); tr.append(pd); }
      else if (PAD_ACTIONS.includes(a)) tr.append(cell('pad', null, a));
      rows.push(tr);
    }
    const tr = el('tr', 'fixed');
    const pd = el('td', 'pad'); pd.append(padBadge(9));
    tr.append(el('td', null, 'Pause'), el('td'), el('td'), pd);
    tr.children[1].append(el('kbd', null, 'Échap')); tr.children[2].append(el('kbd', null, 'Échap'));
    rows.push(tr);
    table.replaceChildren(...rows);
    if (focusK) {
      const [sc, pl, a] = focusK.split(':');
      const f = table.querySelector(`[data-k="${focusK}"]`) || table.querySelector(`[data-k^="${sc}:${pl}:${a}:"]`);
      if (f) f.focus({ focusVisible: true, preventScroll: true });
    }
  };
  ui.render();
  let armed = false;
  const reset = mbtn('Touches par défaut', 'Clavier et manette', false, () => {
    if (!armed) { armed = true; reset.firstChild.textContent = 'Tout remettre ? Clique encore'; reset.classList.add('danger'); return; }
    resetBinds();
    armed = false; reset.firstChild.textContent = 'Touches par défaut'; reset.classList.remove('danger');
    ui.render(); status.textContent = 'Touches remises par défaut.';
  }, 'quiet');
  showScreen({
    kanji: '指南',
    title: 'Commandes',
    body: [
      status, table,
      el('p', 'note', "Une touche déjà prise ailleurs est échangée avec l'ancienne. Échap reste la pause. Les boutons s'adaptent à ta manette (Xbox, PlayStation ou Nintendo) dès qu'elle est branchée. Contre l'IA et en ligne, les deux jeux de touches contrôlent ton lutteur."),
      el('p', 'note', "Au bord du cercle, pousse vers le centre pour tenir : tes talons se plantent dans la paille, mais ta jauge de garde se vide, et quand elle est vide tu glisses. Et quand l'adversaire te pousse au bord, « Utchari » s'affiche au-dessus de toi : appuie sur Dash, tu pivotes et c'est lui qui sort. La direction tenue choisit le sens du pivot. Il ne marche pas s'il pousse garde levée. Et si c'est toi qu'on soulève, garde au bon moment (« Hanches basses ») : l'utchari échoue et c'est lui qui reste déséquilibré au bord."),
      el('p', 'note', "Départ : attends « Hakkeyoi ! ». Un dash juste après le signal pousse 30 % plus fort. Un dash avant le signal est un faux départ et te fige un instant. Touche M pour couper le son (sauf si tu l'utilises pour jouer)."),
      list(reset, mbtn('Retour', null, false, backFn, 'quiet')),
    ],
    focus: '.kchip',
    back: backFn,
  });
}

function startCapture(c) {
  if (G.capture) endCapture(null);
  G.capture = c;
  c.el.classList.add('listening');
  c.el.replaceChildren(document.createTextNode('…'));
  const list = capList(c);
  const what = c.scope === 'pad'
    ? (pads().length ? 'appuie sur un bouton de la manette' : 'branche une manette et appuie sur un bouton')
    : 'appuie sur la nouvelle touche';
  const msg = [document.createTextNode(`${bindWho(c.a, c.scope === 'pad' ? null : c.pl)} : ${what}. Échap pour annuler.`)];
  if (c.i < list.length && list.length > 1) {
    const rm = el('button', 'bind-remove', 'Retirer');
    rm.type = 'button';
    rm.addEventListener('click', () => removeBinding());
    msg.push(document.createTextNode(' '), rm);
  }
  c.ui.status.replaceChildren(...msg);
  // état actuel des boutons : celui qu'on vient d'appuyer pour ouvrir la capture ne compte pas
  for (const p of pads()) for (const k of [...PAD_BINDABLE, 9]) padPrev[p.index + ':' + k] = btn(p, k);
}
/** Fin de capture : on redessine le tableau (focus sur la même case) et on affiche le message. */
function endCapture(msg) {
  const c = G.capture;
  if (!c) return;
  G.capture = null;
  c.ui.render(c.el.dataset.k);
  if (msg != null) c.ui.status.textContent = msg;
}
function captureKey(e) {
  e.preventDefault(); e.stopPropagation();
  const c = G.capture;
  if (e.repeat) return;
  if (e.code === 'Escape') { endCapture('Annulé.'); return; }
  if (c.scope === 'pad') return;                       // capture manette : le clavier ne sert qu'à annuler
  rememberKeyName(e);
  G.swallowUp = e.code;                                // Espace ou Entrée ne doivent pas recliquer la case
  assignBinding(e.code);
}
function capturePad(ps) {
  const c = G.capture;
  for (const p of ps) {
    if (padEdge(p, 9)) { endCapture('Annulé.'); return; }
    if (c.scope !== 'pad') { if (padEdge(p, 1)) { endCapture('Annulé.'); return; } continue; }   // capture clavier : B annule
    const hit = PAD_BINDABLE.filter(k => padEdge(p, k));
    if (hit.length) { assignBinding(hit[0]); return; }
  }
}
/** Affecte v à la case en cours. Si v sert déjà ailleurs, l'autre action reçoit l'ancienne touche (échange). */
function assignBinding(v) {
  const c = G.capture, list = capList(c), old = list[c.i];
  const me = bindWho(c.a, c.scope === 'pad' ? null : c.pl);
  if (old === v || (old === undefined && list.includes(v))) { endCapture(`${me} : ${capLabel(c, v)}, rien ne change.`); return; }
  const owners = [];
  if (c.scope === 'pad') { for (const a of PAD_ACTIONS) PAD[a].forEach((x, j) => { if (x === v) owners.push([PAD[a], j, a, null]); }); }
  else for (let pl = 0; pl < 2; pl++) for (const a of ACTIONS) BIND[pl][a].forEach((x, j) => { if (x === v) owners.push([BIND[pl][a], j, a, pl]); });
  let note = '';
  for (const [ol, j, a, pl] of owners) {
    if (old !== undefined) { ol[j] = old; note = ` ${capLabel(c, v)} servait à ${bindWho(a, pl)}, qui prend ${capLabel(c, old)} à la place.`; }
    else if (ol.length > 1) { ol.splice(j, 1); note = ` ${capLabel(c, v)} ne sert plus à ${bindWho(a, pl)}.`; }
    else { endCapture(`${capLabel(c, v)} est la seule touche de ${bindWho(a, pl)} : change d'abord celle-là.`); return; }
  }
  if (c.i < list.length) list[c.i] = v; else list.push(v);
  storeBinds();
  Sound.click();
  endCapture(`${me} : ${capLabel(c, v)}.${note}`);
}
function removeBinding() {
  const c = G.capture;
  if (!c) return;
  const list = capList(c);
  if (c.i >= list.length || list.length < 2) return;
  const [v] = list.splice(c.i, 1);
  storeBinds();
  c.el.dataset.k = `${c.scope}:${c.pl}:${c.a}:0`;
  endCapture(`${capLabel(c, v)} retirée de ${bindWho(c.a, c.scope === 'pad' ? null : c.pl)}.`);
}
// un clic ailleurs annule la capture
addEventListener('pointerdown', e => {
  const c = G.capture;
  if (c && !c.el.contains(e.target) && !c.ui.status.contains(e.target)) endCapture('Annulé.');
}, true);

export { captureKey, capturePad, controlsCard };
