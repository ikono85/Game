/**
 * Boucle principale : simulation à pas fixe, rendu interpolé.
 */
import { Sound } from '../audio/sound.js';
import { G } from './state.js';
import { pollPads } from '../input/gamepad.js';
import { humanCmd } from '../input/human.js';
import { netFrame } from '../net/netcode.js';
import { render } from '../render/draw.js';
import { burst, handleEvents } from '../render/effects.js';
import { REC_MAX, snapPlayer, updateReplay } from '../render/replay.js';
import { aiCommand } from '../sim/ai.js';
import { C, DT, clamp } from '../sim/constants.js';
import { step } from '../sim/simulation.js';
import { ov } from '../ui/dom.js';
import { hud } from '../ui/hud.js';

/** Partie locale (solo, 2 joueurs sur le même écran) : simulation à pas fixe. */
function localAdvance(dt) {
  const S = G.S;
  G.acc += dt;
  let n = 0;
  while (G.acc >= DT && n < 30) {
    const cmds = [
      S.ai[0] ? aiCommand(S, 0) : humanCmd(0, S),
      S.ai[1] ? aiCommand(S, 1) : humanCmd(1, S),
    ];
    step(S, cmds);
    for (let k = 0; k < 2; k++) if (S.score[k] === 0 && S.score[1 - k] === S.win - 1 && S.win > 1) G.down[k] = true;
    const fx = handleEvents(S);
    // on garde les dernières secondes de la manche pour le ralenti
    if (S.phase === 'play' || S.phase === 'roundEnd') {
      G.rec.push({ tick: S.tick, p: [snapPlayer(S.p[0]), snapPlayer(S.p[1])], ring: S.ring, fx, win: fx.some(e => e.type === 'roundWin') });
      if (G.rec.length > REC_MAX) G.rec.shift();
    }
    G.acc -= DT; n++;
    if (S.phase === 'matchEnd' || G.replay) { G.acc = 0; break; }
  }
  if (n === 30) G.acc = 0;
}

function frame(now) {
  const dt = Math.min(0.25, (now - G.last) / 1000); G.last = now;
  pollPads();
  G.t += dt;
  if (G.screen !== 'match' || !G.S) {     // menus opaques : rien à simuler ni à dessiner derrière
    if (Sound.ctx) Sound.crowdLevel(0.02);
    hud(); requestAnimationFrame(frame); return;
  }
  if (G.replay) {                          // ralenti du coup gagnant : la simulation est arrêtée
    if (Sound.ctx) Sound.crowdLevel(0.04 + 0.12 * Math.min(1.5, G.cheer));
    updateReplay(dt); hud(); requestAnimationFrame(frame); return;
  }
  const online = G.mode === 'online';
  if (online) { if (G.net) netFrame(dt); }
  else if (!G.paused) localAdvance(dt);
  const S = G.S;
  if (online || !G.paused) {
    // effets visuels (hors simulation)
    for (const q of G.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; q.life -= dt; }
    G.particles = G.particles.filter(q => q.life > 0);
    G.shake = Math.max(0, G.shake - dt * 40);
    G.cheer = Math.max(0, G.cheer - dt);
    if (G.flash) { G.flash.t -= dt; if (G.flash.t <= 0) G.flash = null; }
    for (const l of G.labels) l.t -= dt;
    G.labels = G.labels.filter(l => l.t > 0);
    G.holdFx = (G.holdFx || 0) - dt;
    if (G.holdFx <= 0) {
      G.holdFx = 0.11;
      for (const q of S.p) if (q.hold) {
        const dx = q.x - C, dy = q.y - C, dl = Math.hypot(dx, dy) || 1;
        burst(q.x + dx / dl * (q.r + 4), q.y + dy / dl * (q.r + 4), 4, '#c9a46b');
        if (Math.random() < 0.35) Sound.creak();
      }
    }
  }
  const fx = (S.p[0].x + S.p[1].x) / 2, fy = (S.p[0].y + S.p[1].y) / 2;
  G.focusX += (fx - G.focusX) * Math.min(1, dt * 3); G.focusY += (fy - G.focusY) * Math.min(1, dt * 3);
  const tension = S.p.some(q => q.hold) ? 0.08 : 0;     // la foule retient son souffle
  if (Sound.ctx) Sound.crowdLevel(!G.paused ? 0.05 + tension + 0.16 * Math.min(1.5, G.cheer) : 0.025);
  if (ov.hidden && !G.replay) render(S, G.paused ? 1 : clamp(G.acc / DT, 0, 1), G.paused ? 0 : dt);
  hud();
  requestAnimationFrame(frame);
}

export { frame };
