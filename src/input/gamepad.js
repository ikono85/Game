/**
 * Manette (API Gamepad) : menus, boutons du combat, glyphes Xbox / PlayStation / Nintendo.
 */
import { Sound } from '../audio/sound.js';
import { G } from '../game/state.js';
import { skipIntro } from '../ui/versus.js';
import { PAD, inPlay, latch } from './keyboard.js';
import { endReplay } from '../render/replay.js';
import { capturePad } from '../ui/controls.js';
import { card, ov } from '../ui/dom.js';
import { togglePause } from '../ui/pause.js';
import { el } from '../ui/widgets.js';

// Manette (API Gamepad)
const padPrev = {};
function pads() { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); }
function padForPlayer(i) {
  const ps = pads();
  if (G.mode === 'versus') {
    if (ps.length === 1) return i === 1 ? ps[0] : null;   // une seule manette : elle va au bleu
    return ps[i] || null;
  }
  return i === 0 ? ps[0] || null : null;
}
const btn = (p, k) => p.buttons[k] && (p.buttons[k].pressed || p.buttons[k].value > 0.4);
function padEdge(p, k) {
  const key = p.index + ':' + k, now = btn(p, k), was = padPrev[key];
  padPrev[key] = now;
  return now && !was;
}
function padState(p) {
  let x = p.axes[0] || 0, y = p.axes[1] || 0;
  if (Math.hypot(x, y) < 0.25) { x = 0; y = 0; }
  if (btn(p, 14)) x = -1; if (btn(p, 15)) x = 1; if (btn(p, 12)) y = -1; if (btn(p, 13)) y = 1;
  return { x, y, guard: PAD.guard.some(k => btn(p, k)) };
}
// Boutons affichés selon la famille de manette (position standard : 0 bas, 1 droite, 2 gauche, 3 haut)
const PAD_GLYPHS = {
  xbox: { 0: ['A', '#7cc35f'], 1: ['B', '#ef6a55'], 2: ['X', '#5d9bf0'], 3: ['Y', '#f0c64b'], 4: ['LB'], 5: ['RB'], 6: ['LT'], 7: ['RT'], 8: ['View'], 9: ['Menu'], 10: ['LS'], 11: ['RS'] },
  ps: { 0: ['✕', '#9db4ff'], 1: ['○', '#ff8a8a'], 2: ['□', '#f1a3e0'], 3: ['△', '#6fe0c4'], 4: ['L1'], 5: ['R1'], 6: ['L2'], 7: ['R2'], 8: ['Share'], 9: ['Options'], 10: ['L3'], 11: ['R3'] },
  nin: { 0: ['B'], 1: ['A'], 2: ['Y'], 3: ['X'], 4: ['L'], 5: ['R'], 6: ['ZL'], 7: ['ZR'], 8: ['−'], 9: ['+'], 10: ['LS'], 11: ['RS'] },
};
function padFamily(p) {
  const id = (p.id || '').toLowerCase();
  if (/xbox|045e/.test(id)) return 'xbox';
  if (/054c|playstation|dualsense|dualshock/.test(id)) return 'ps';
  if (/057e|nintendo|pro controller|joy-con/.test(id)) return 'nin';
  return 'xbox';
}
function fillPadBadge(b) {
  const [t, c] = PAD_GLYPHS[G.padFamily || 'xbox'][b.dataset.pad];
  b.textContent = t; b.style.color = c || '';
  b.classList.toggle('wide', t.length > 1);
}
function padBadge(btnIndex) {
  const b = el('span', 'pad-btn');
  b.dataset.pad = btnIndex;
  fillPadBadge(b);
  return b;
}
function syncPadFamily(ps) {
  const fam = ps.length ? padFamily(ps[0]) : null;
  if (fam === G.padFamily) return;
  G.padFamily = fam;
  document.body.classList.toggle('has-pad', !!fam);
  document.querySelectorAll('.pad-btn[data-pad]').forEach(fillPadBadge);
}

function pollPads() {
  const ps = pads();
  syncPadFamily(ps);
  if (!ps.length) return;
  if (G.capture) { capturePad(ps); return; }        // « Commandes » : on attend le nouveau bouton
  if (G.replay) {                                   // n'importe quel bouton principal passe le ralenti
    for (const p of ps) if (padEdge(p, 0) || padEdge(p, 1) || padEdge(p, 9)) { endReplay(); return; }
    return;
  }
  if (G.intro) { for (const p of ps) if (padEdge(p, 0) || padEdge(p, 1) || padEdge(p, 9)) skipIntro(); return; }
  // Menus : croix/stick pour naviguer, A pour valider, B pour revenir, Start pour la pause
  for (const p of ps) {
    if (padEdge(p, 9)) togglePause();
    if (!ov.hidden) {
      if (padEdge(p, 1) && G.back) { G.back(); return; }
      const ax = p.axes[1] || 0, ah = p.axes[0] || 0, key = p.index + ':ax';
      const dir = btn(p, 12) || btn(p, 14) || ax < -0.6 || ah < -0.6 ? -1 : btn(p, 13) || btn(p, 15) || ax > 0.6 || ah > 0.6 ? 1 : 0;
      if (dir && padPrev[key] !== dir) moveFocus(dir);
      padPrev[key] = dir;
      if (padEdge(p, 0) && document.activeElement && card.contains(document.activeElement)) document.activeElement.click();
    }
  }
  if (inPlay()) for (let i = 0; i < 2; i++) {
    const p = padForPlayer(i);
    if (!p) continue;
    const edge = list => list.map(k => padEdge(p, k)).some(Boolean);   // tous évalués : l'état « avant » reste à jour
    if (edge(PAD.dash)) latch[i].dash = true;
    if (edge(PAD.feint)) latch[i].feint = true;
  }
}
function moveFocus(dir) {
  const items = Array.from(card.querySelectorAll(ov.classList.contains('title') ? '.t-hot' : '.scr-main button:not(:disabled)'));
  if (document.activeElement && document.activeElement.scrollIntoView) setTimeout(() => document.activeElement.scrollIntoView({ block: 'nearest' }), 0);
  if (!items.length) return;
  const k = items.indexOf(document.activeElement);
  items[(k + dir + items.length) % items.length].focus({ focusVisible: true });
  Sound.click();
}

export { PAD_GLYPHS, btn, padBadge, padEdge, padForPlayer, padPrev, padState, pads, pollPads };
