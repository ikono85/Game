/**
 * Variantes d'arène, purement visuelles : une teinte posée sur la salle, et une ambiance qui tombe ou
 * flotte dessus (pétales, feuilles, neige, lucioles). La nuit d'été assombrit la salle autour du
 * dohyō et allume des lanternes. Rien ici ne touche à la simulation (hasard libre, Math.random).
 */
import { G } from '../game/state.js';
import { arenaById } from '../game/arenalist.js';
import { MAP } from './sprites.js';
import { V } from './view.js';
import { C, R0, TAU, W } from '../sim/constants.js';
import { ctx } from '../ui/dom.js';

// Teintes : couches peintes sur toute la salle (après la foule, avant les lutteurs)
const LOOKS = {
  ryogoku: null,
  haru: { grade: [['soft-light', '#ff8fbd', 0.5], ['source-over', '#ffd9e6', 0.07]], fx: 'sakura', count: 70 },
  nagoya: { grade: [['multiply', '#7f86b8', 0.5]], night: true, fx: 'hotaru', count: 28 },
  aki: { grade: [['soft-light', '#ff8a2a', 0.45], ['multiply', '#f2d2b0', 0.25]], fx: 'momiji', count: 40 },
  hatsu: { grade: [['multiply', '#c9d8f2', 0.55], ['soft-light', '#e8f1ff', 0.35]], fx: 'yuki', count: 170 },
};
const PALETTE = {
  sakura: ['#f7b6cc', '#f29ab8', '#fcd3e1', '#ffe6ee'],
  momiji: ['#c8452c', '#e07a2e', '#b8322a', '#e9a23b', '#d1602a'],
  yuki: ['#ffffff', '#f2f7ff'],
  hotaru: ['#d8ff8a', '#f2ff9a'],
};
const look = () => LOOKS[G.arena] || null;
const rnd = (a, b) => a + Math.random() * (b - a);

// --- Ambiance : particules en coordonnées du monde ---
const amb = { id: null, list: [] };
function spawn(q, fx, fresh) {
  const x0 = V.x0 - 40, x1 = V.x1 + 40, y0 = V.y0 - 40, y1 = V.y1 + 40;
  Object.assign(q, { x: rnd(x0, x1), y: rnd(y0, y1), rot: rnd(0, TAU), ph: rnd(0, TAU), a: 1 });
  if (fx === 'hotaru') {                       // lucioles : autour du dohyō, pas dessus
    do { q.x = rnd(x0, x1); q.y = rnd(y0, y1); } while (Math.hypot(q.x - C, q.y - C) < R0 + 40);
    Object.assign(q, { z: 0, dir: rnd(0, TAU), sp: rnd(12, 30), size: rnd(2.2, 3.4), life: rnd(6, 14) });
  } else {
    const fall = fx === 'yuki' ? rnd(4, 8) : rnd(3.5, 7);                    // secondes avant de toucher le sol
    Object.assign(q, {
      z: fresh ? 1 : rnd(0, 1), vz: -1 / fall,
      vx: fx === 'yuki' ? rnd(-6, 10) : rnd(10, 32), vy: rnd(4, 18),           // un léger courant d'air
      spin: rnd(-2.5, 2.5), size: fx === 'yuki' ? rnd(2, 4.5) : fx === 'momiji' ? rnd(10, 14) : rnd(7, 10),
      rest: rnd(1.5, 4),                                                       // temps posé au sol avant de disparaître
    });
  }
  q.color = PALETTE[fx][(Math.random() * PALETTE[fx].length) | 0];
  return q;
}
function ensure(L) {
  if (amb.id === G.arena) return;
  amb.id = G.arena; amb.list = [];
  if (!L) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const n = Math.round(L.count * (reduce ? 0.4 : 1));
  for (let i = 0; i < n; i++) amb.list.push(spawn({}, L.fx, false));
}
function update(L, dt) {
  for (const q of amb.list) {
    q.ph += dt;
    if (L.fx === 'hotaru') {
      q.dir += Math.sin(q.ph * 1.3 + q.rot) * dt * 1.6;
      q.x += Math.cos(q.dir) * q.sp * dt; q.y += Math.sin(q.dir) * q.sp * dt;
      q.life -= dt;
      if (q.life <= 0 || Math.hypot(q.x - C, q.y - C) < R0 + 20) spawn(q, L.fx, true);
      continue;
    }
    if (q.z > 0) {
      q.z = Math.max(0, q.z + q.vz * dt);
      const sway = Math.sin(q.ph * 1.7 + q.rot) * (L.fx === 'yuki' ? 10 : 18);
      q.x += (q.vx + sway) * dt; q.y += q.vy * dt;
      q.rot += q.spin * dt;
    } else {
      q.rest -= dt;                            // posé au sol, puis il s'efface
      q.a = Math.min(1, q.rest / 0.8);
      if (q.rest <= 0) spawn(q, L.fx, true);
    }
  }
}

function petal(q) {
  ctx.beginPath(); ctx.ellipse(0, 0, q.size, q.size * 0.62, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(-q.size * 0.25, 0, q.size * 0.45, q.size * 0.22, 0, 0, TAU); ctx.fill();
}
function leaf(q) {
  // feuille d'érable : cinq lobes pointus, creusés entre eux
  const r = q.size, D = Math.PI / 180;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 72 * D;
    const pts = [[a - 36 * D, 0.3], [a - 15 * D, 0.62], [a, 1], [a + 15 * D, 0.62]];
    for (const [an, k] of pts) (i || k !== 0.3 ? ctx.lineTo : ctx.moveTo).call(ctx, Math.cos(an) * r * k, Math.sin(an) * r * k);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(90,30,10,.45)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * 0.95); ctx.stroke();
}
function drawAmbient(L) {
  for (const q of amb.list) {
    if (L.fx === 'hotaru') {
      const glow = 0.45 + 0.55 * Math.max(0, Math.sin(q.ph * 2.4 + q.rot * 3));
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size * 7);
      g.addColorStop(0, `rgba(230,255,140,${0.55 * glow})`); g.addColorStop(1, 'rgba(230,255,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * 7, 0, TAU); ctx.fill();
      ctx.globalAlpha = glow; ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      continue;
    }
    const h = q.z * 46;                        // hauteur : l'ombre se décale, l'objet grossit un peu
    if (q.z > 0.02) {
      ctx.globalAlpha = 0.16 * q.a;
      ctx.fillStyle = '#1a0f08';
      ctx.beginPath(); ctx.arc(q.x + h, q.y + h, q.size * 0.8, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = (L.fx === 'yuki' ? 0.85 : 0.92) * q.a;
    ctx.fillStyle = q.color;
    ctx.save();
    ctx.translate(q.x, q.y); ctx.rotate(q.rot);
    const sc = 1 + q.z * 0.5;
    ctx.scale(sc * (L.fx === 'yuki' ? 1 : Math.max(0.25, Math.abs(Math.cos(q.ph * 3 + q.rot)))), sc);   // il tourne sur lui-même en tombant
    if (L.fx === 'yuki') { ctx.beginPath(); ctx.arc(0, 0, q.size, 0, TAU); ctx.fill(); }
    else if (L.fx === 'momiji') leaf(q);
    else petal(q);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Nuit : la salle dans la pénombre, le dohyō éclairé, des lanternes sur le pourtour
const LANTERNS = [];
for (let k = 0; k < 6; k++) { const x = 320 + k * 154; LANTERNS.push([x, 150], [x, W - 150]); }
for (let k = 0; k < 4; k++) { const y = 330 + k * 250; if (Math.abs(y - C) > 120) LANTERNS.push([150, y], [W - 150, y]); }
let nightGrad = null, nightKey = '';
function drawNight(g = ctx, x0 = V.x0, y0 = V.y0, x1 = V.x1, y1 = V.y1, t = G.t) {
  const key = `${x0}|${y0}|${x1}|${y1}`;
  let grad = g === ctx ? nightGrad : null;
  if (!grad || key !== nightKey || g !== ctx) {
    const R = Math.max(1000, Math.hypot(Math.max(C - x0, x1 - C), Math.max(C - y0, y1 - C)));
    grad = g.createRadialGradient(C, C, R0 + 10, C, C, R);
    grad.addColorStop(0, 'rgba(8,10,28,0)');
    grad.addColorStop(Math.min(0.99, 260 / (R - R0 - 10)), 'rgba(8,10,28,.58)');
    grad.addColorStop(1, 'rgba(6,8,22,.82)');
    if (g === ctx) { nightGrad = grad; nightKey = key; }
  }
  g.fillStyle = grad; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (const [x, y] of LANTERNS) {
    const fl = 0.85 + 0.15 * Math.sin(t * 7 + x * 0.05);      // la flamme vacille
    const gl = g.createRadialGradient(x, y, 4, x, y, 90);
    gl.addColorStop(0, `rgba(255,176,90,${0.5 * fl})`); gl.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, 90, 0, TAU); g.fill();
    g.fillStyle = '#c9472e'; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,214,140,${0.75 * fl})`; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(30,18,10,.8)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.stroke();
  }
}
function grade(L, g = ctx, x0 = V.x0, y0 = V.y0, x1 = V.x1, y1 = V.y1) {
  g.save();
  for (const [op, color, a] of L.grade) {
    g.globalCompositeOperation = op; g.globalAlpha = a; g.fillStyle = color;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  g.restore();
}

/** Sous les lutteurs : teinte de la salle, pénombre et lanternes la nuit. */
function drawArenaUnder() {
  const L = look();
  if (!L) return;
  grade(L);
  if (L.night) drawNight();
}
/** Au-dessus des lutteurs : ce qui tombe ou flotte (dt = 0 : tout est figé, par exemple en pause). */
function drawArenaOver(dt) {
  const L = look();
  ensure(L);
  if (!L) return;
  if (dt > 0) update(L, Math.min(dt, 0.1));
  drawAmbient(L);
}

/** Petite vignette d'une arène pour le vestiaire (vue du dohyō, teinte et quelques particules). */
function arenaPreview(id, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const draw = () => {
    if (!(MAP.complete && MAP.naturalWidth)) { setTimeout(draw, 100); return; }
    const g = c.getContext('2d'), L = LOOKS[id];
    const S = 1040, k = size / S, x0 = C - S / 2, y0 = C - S / 2;      // le dohyō et un peu de salle autour
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    g.drawImage(MAP, 0, 0, W, W);
    g.lineWidth = 24; g.strokeStyle = '#d4bf83'; g.beginPath(); g.arc(C, C, R0 + 10, 0, TAU); g.stroke();
    if (L) {
      grade(L, g, x0, y0, x0 + S, y0 + S);
      if (L.night) drawNight(g, x0, y0, x0 + S, y0 + S, 0);
      const pal = PALETTE[L.fx];
      let s = 7;
      const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };   // toujours la même vignette
      for (let i = 0; i < (L.fx === 'yuki' ? 70 : 26); i++) {
        const x = x0 + r() * S, y = y0 + r() * S;
        if (L.fx === 'hotaru' && Math.hypot(x - C, y - C) < R0) continue;
        g.fillStyle = pal[i % pal.length]; g.globalAlpha = L.fx === 'hotaru' ? 0.9 : 0.85;
        g.beginPath();
        if (L.fx === 'yuki' || L.fx === 'hotaru') g.arc(x, y, L.fx === 'yuki' ? 7 : 9, 0, TAU);
        else g.ellipse(x, y, L.fx === 'momiji' ? 20 : 15, L.fx === 'momiji' ? 15 : 10, r() * TAU, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  };
  draw();
  return c;
}

export { arenaById, arenaPreview, drawArenaOver, drawArenaUnder };
