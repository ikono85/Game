/**
 * Tactile, et commande d'un joueur humain à chaque tick (clavier + manette + doigt).
 */
import { Sound } from '../audio/sound.js';
import { G } from '../game/state.js';
import { padForPlayer, padState } from './gamepad.js';
import { anyHeld, bindsFor, latch } from './keyboard.js';
import { endReplay } from '../render/replay.js';
import { V } from '../render/view.js';
import { $, cv } from '../ui/dom.js';

// Tactile : le rouge suit le doigt posé sur l'arène (un doigt suivi par son identifiant)
let touch = { id: null, x: 0, y: 0 }, touchGuard = false;
function canvasPoint(ev) {
  const r = cv.getBoundingClientRect();
  const px = (ev.clientX - r.left) / r.width * V.cw, py = (ev.clientY - r.top) / r.height * V.ch;
  return [(px - V.ox) / V.s, (py - V.oy) / V.s];
}
addEventListener('pointerdown', () => { if (G.replay) endReplay(); });
cv.addEventListener('pointerdown', e => {
  Sound.init();
  if (e.pointerType === 'mouse' || touch.id !== null) return;
  touch.id = e.pointerId; [touch.x, touch.y] = canvasPoint(e);
});
cv.addEventListener('pointermove', e => { if (e.pointerId === touch.id) [touch.x, touch.y] = canvasPoint(e); });
['pointerup', 'pointercancel'].forEach(ev => addEventListener(ev, e => { if (e.pointerId === touch.id) touch.id = null; }));
$('tdash').addEventListener('pointerdown', e => { e.preventDefault(); Sound.init(); latch[0].dash = true; });
$('tfeint').addEventListener('pointerdown', e => { e.preventDefault(); latch[0].feint = true; });
const tg = $('tguard');
tg.addEventListener('pointerdown', e => { e.preventDefault(); touchGuard = true; });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => tg.addEventListener(ev, () => { touchGuard = false; }));

/** Construit la commande d'un joueur humain pour ce tick. */
function humanCmd(i, S) {
  let x = 0, y = 0, guard = false;
  for (const b of bindsFor(i)) {
    if (anyHeld(b.up)) y -= 1; if (anyHeld(b.down)) y += 1;
    if (anyHeld(b.left)) x -= 1; if (anyHeld(b.right)) x += 1;
    if (anyHeld(b.guard)) guard = true;
  }
  const p = padForPlayer(i);
  if (p) { const s = padState(p); if (s.x || s.y) { x = s.x; y = s.y; } guard = guard || s.guard; }
  if (i === 0) {
    if (touch.id !== null && !x && !y) {
      const me = S.p[G.mode === 'online' && G.net ? G.net.me : 0], dx = touch.x - me.x, dy = touch.y - me.y;
      if (Math.hypot(dx, dy) > 12) { x = dx; y = dy; }
    }
    guard = guard || touchGuard;
  }
  const c = { mx: x, my: y, dash: latch[i].dash, feint: latch[i].feint, guard };
  latch[i].dash = latch[i].feint = false;
  return c;
}

export { humanCmd };
