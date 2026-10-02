/**
 * Ralenti du coup gagnant, rejoué à partir des dernières images enregistrées.
 */
import { G } from '../game/state.js';
import { PAD_GLYPHS } from '../input/gamepad.js';
import { render } from './draw.js';
import { playVfx } from './effects.js';
import { V } from './view.js';
import { C, SIM_HZ, clamp } from '../sim/constants.js';
import { ctx } from '../ui/dom.js';

const REC_MAX = Math.round(3.4 * SIM_HZ);
const snapPlayer = p => ({ ...p });
function startReplay(done) {
  const rec = G.rec, wi = rec.findIndex(f => f.win);
  if (wi < 0) { done(); return; }
  // le coup décisif : le dernier choc franc avant la sortie (sinon, la sortie elle-même)
  let hi = wi;
  for (let j = wi; j >= Math.max(0, wi - 1.5 * SIM_HZ); j--) if (rec[j].fx.some(e => e.type === 'hit' && e.force > 250)) { hi = j; break; }
  const i0 = Math.max(0, hi - Math.round(0.7 * SIM_HZ)), i1 = Math.min(rec.length - 1, wi + Math.round(0.6 * SIM_HZ));
  if (i1 - i0 < 30) { done(); return; }
  G.replay = { i0, i1, slowFrom: Math.max(i0, hi - 18), t: 0, last: i0 - 1, done, fx: null, fy: null };
  G.flash = null; G.labels = []; G.particles = [];
  document.body.classList.add('replaying');
}
function endReplay() {
  const R = G.replay;
  if (!R) return;
  G.replay = null; G.particles = []; G.shake = 0;
  document.body.classList.remove('replaying');
  R.done();
}
function updateReplay(dt) {
  const R = G.replay, rec = G.rec;
  const sp = R.i0 + R.t * SIM_HZ >= R.slowFrom ? 0.3 : 0.85;        // le ralenti s'enclenche juste avant le coup
  R.t += dt * sp;
  const k = Math.min(R.i1, R.i0 + R.t * SIM_HZ), ki = Math.floor(k);
  for (let j = R.last + 1; j <= ki; j++) for (const e of rec[j].fx) playVfx(e);
  R.last = Math.max(R.last, ki);
  for (const q of G.particles) { q.x += q.vx * dt * sp; q.y += q.vy * dt * sp; q.vx *= 0.9; q.vy *= 0.9; q.life -= dt * sp; }
  G.particles = G.particles.filter(q => q.life > 0);
  G.shake = Math.max(0, G.shake - dt * 40);
  G.cheer = Math.max(0, G.cheer - dt * sp);
  const a = rec[Math.max(R.i0, ki)], b = rec[Math.min(R.i1, ki + 1)];
  const view = { view: true, ring: b.ring, p: [0, 1].map(i => ({ ...b.p[i], px: a.p[i].x, py: a.p[i].y })) };
  // caméra : zoom progressif sur les deux lutteurs, sans sortir du décor
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = Math.min(1, R.t / 0.5), z = reduce ? 1 : 1 + 0.45 * ease * ease * (3 - 2 * ease);
  const mx = (view.p[0].x + view.p[1].x) / 2, my = (view.p[0].y + view.p[1].y) / 2;
  R.fx = R.fx == null ? mx : R.fx + (mx - R.fx) * Math.min(1, dt * 4);
  R.fy = R.fy == null ? my : R.fy + (my - R.fy) * Math.min(1, dt * 4);
  const hwx = V.cw / 2 / V.s, hwy = V.ch / 2 / V.s;
  const fx = C + clamp(R.fx - C, -hwx * (1 - 1 / z), hwx * (1 - 1 / z));
  const fy = C + clamp(R.fy - C, -hwy * (1 - 1 / z), hwy * (1 - 1 / z));
  G.focusX = mx; G.focusY = my;
  render(view, k - ki, dt * sp, { z, fx, fy });
  // bandes de cinéma, titre, comment passer
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bar = Math.round(V.ch * 0.085 * Math.min(1, R.t / 0.25));
  ctx.fillStyle = 'rgba(12,8,5,.92)';
  ctx.fillRect(0, 0, V.cw, bar); ctx.fillRect(0, V.ch - bar, V.cw, bar);
  if (bar > 10) {
    const fs = Math.max(16, Math.round(bar * 0.42));
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = '#efe3c8';
    ctx.font = `400 ${fs}px "Dela Gothic One", "Arial Black", sans-serif`;
    ctx.fillText('Ralenti', Math.round(fs * 1.2), bar / 2);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(239,227,200,.75)';
    ctx.font = `700 ${Math.round(fs * 0.6)}px "Zen Kaku Gothic New", sans-serif`;
    const skip = G.padFamily ? `Passer : ${PAD_GLYPHS[G.padFamily][0][0]}`
      : matchMedia('(pointer: coarse)').matches ? 'Touche l’écran pour passer' : 'Passer : n’importe quelle touche';
    ctx.fillText(skip, V.cw - Math.round(fs * 1.2), V.ch - bar / 2);
  }
  if (k >= R.i1) endReplay();
}

export { REC_MAX, endReplay, snapPlayer, startReplay, updateReplay };
