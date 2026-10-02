/**
 * Pause et son.
 */
import { Sound } from '../audio/sound.js';
import { persist, save } from '../game/save.js';
import { G } from '../game/state.js';
import { padBadge } from '../input/gamepad.js';
import { held, inPlay } from '../input/keyboard.js';
import { onlineQuitScreen } from '../net/screens.js';
import { careerBoutResult } from './career.js';
import { controlsCard } from './controls.js';
import { $, ov } from './dom.js';
import { menu } from './menus.js';
import { el, hideOverlay, list, mbtn, showScreen } from './widgets.js';

function togglePause() {
  if (G.mode === 'online') { if (G.net && G.S && G.S.phase !== 'matchEnd' && ov.hidden) onlineQuitScreen(); return; }
  if (G.screen !== 'match' || !G.S || G.S.phase === 'matchEnd') return;
  if (!G.paused) {
    if (!ov.hidden) return;          // un écran de fin est déjà affiché
    G.paused = true; held.clear();
    pauseCard();
  } else resume();
}
function pauseCard() {
  showScreen({
    kanji: '休憩',
    title: 'Pause',
    body: [list(
      mbtn('Reprendre', keyOrPad('Échap', 9), true, resume),
      mbtn('Commandes', null, false, () => controlsCard(pauseCard)),
      mbtn('Abandonner', G.mode === 'career' ? 'Compte comme une défaite' : 'Retour au menu', false, () => {
        if (G.mode === 'career') { G.paused = false; G.S.phase = 'matchEnd'; G.screen = 'menu'; careerBoutResult(false); }
        else menu();
      }, 'quiet'),
    )],
    back: resume,
  });
}
/** Petit libellé de touche qui devient un bouton de manette quand une manette est branchée. */
function keyOrPad(key, padIndex) {
  const sm = el('small');
  const w = el('span', 'pad-only'); w.append(padBadge(padIndex));
  sm.append(el('span', 'kb-only', key), w);
  return sm;
}
function resume() { if (!G.paused) return; G.paused = false; G.last = performance.now(); hideOverlay(); }
function autoPause() { if (G.mode !== 'online' && inPlay()) togglePause(); }
function toggleMute() {
  save.muted = !save.muted; persist(); Sound.setMuted(save.muted); syncMute();
}
function syncMute() {
  const b = $('muteBtn');
  b.textContent = save.muted ? 'Son coupé' : 'Son';
  b.setAttribute('aria-pressed', String(save.muted));
}
$('pauseBtn').addEventListener('click', () => { Sound.init(); togglePause(); });
$('muteBtn').addEventListener('click', () => { Sound.init(); toggleMute(); });
addEventListener('pointerdown', () => Sound.init(), { once: true });

export { autoPause, keyOrPad, syncMute, toggleMute, togglePause };
