/**
 * Ambiance des arènes : ce qui tombe ou flotte au-dessus des lutteurs (pétales, feuilles, neige,
 * feux d'artifice), les lueurs de la nuit, et les vignettes du vestiaire. Les cartes elles-mêmes sont dans
 * scenes/. Rien ici ne touche à la simulation (hasard libre, Math.random).
 */
import { G } from '../game/state.js';
import { arenaById } from '../game/arenalist.js';
import { CROWD, MAP } from './sprites.js';
import { V } from './view.js';
import { sceneFor } from './scenes/index.js';
import { C, R0, TAU, W } from '../sim/constants.js';
import { ctx } from '../ui/dom.js';

const PALETTE = {
  sakura: ['#f7b6cc', '#f29ab8', '#fcd3e1', '#ffe6ee'],
  momiji: ['#c8452c', '#e07a2e', '#b8322a', '#e9a23b', '#d1602a'],
  yuki: ['#ffffff', '#f2f7ff'],
};
// feux d'artifice : [couleur de la gerbe, couleur des étincelles]
const HANABI = [['255,96,90', '255,214,170'], ['120,196,255', '232,246,255'], ['255,206,84', '255,250,214'], ['196,126,255', '255,222,255'], ['110,250,170', '228,255,232']];
const look = () => { const sc = sceneFor(G.arena); return sc && sc.fx ? sc : null; };
const rnd = (a, b) => a + Math.random() * (b - a);

// --- Ambiance : particules en coordonnées du monde ---
const amb = { id: null, list: [], flash: [], next: 1, reduce: false };
function spawn(q, fx, fresh) {
  const x0 = V.x0 - 40, x1 = V.x1 + 40, y0 = V.y0 - 40, y1 = V.y1 + 40;
  Object.assign(q, { x: rnd(x0, x1), y: rnd(y0, y1), rot: rnd(0, TAU), ph: rnd(0, TAU), a: 1 });
  const fall = fx === 'yuki' ? rnd(4, 8) : rnd(3.5, 7);                    // secondes avant de toucher le sol
  Object.assign(q, {
    z: fresh ? 1 : rnd(0, 1), vz: -1 / fall,
    vx: fx === 'yuki' ? rnd(-6, 10) : rnd(10, 32), vy: rnd(4, 18),           // un léger courant d'air
    spin: rnd(-2.5, 2.5), size: fx === 'yuki' ? rnd(2, 4.5) : fx === 'momiji' ? rnd(10, 14) : rnd(7, 10),
    rest: rnd(1.5, 4),                                                       // temps posé au sol avant de disparaître
  });
  q.color = PALETTE[fx][(Math.random() * PALETTE[fx].length) | 0];
  return q;
}
function ensure(L) {
  if (amb.id === G.arena) return;
  amb.id = G.arena; amb.list = []; amb.flash = []; amb.next = 1.2;
  if (!L) return;
  amb.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const n = Math.round(L.count * (amb.reduce ? 0.4 : 1));
  for (let i = 0; i < n; i++) amb.list.push(spawn({}, L.fx, false));
}

// --- Feux d'artifice (hanabi) : des gerbes qui s'ouvrent au-dessus du public, jamais sur le dohyō ---
function burst() {
  let x, y, k = 0;
  do { x = rnd(V.x0 + 80, V.x1 - 80); y = rnd(V.y0 + 80, V.y1 - 80); } while (Math.hypot(x - C, y - C) < R0 + 200 && ++k < 20);
  const [c1, c2] = HANABI[(Math.random() * HANABI.length) | 0], ring = Math.random() < 0.35;
  const n = amb.reduce ? 28 : 64, sp = rnd(380, 520);
  amb.flash.push({ x, y, t: 0, rgb: c1 });
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + rnd(-0.06, 0.06), v = sp * (ring ? rnd(0.92, 1) : rnd(0.35, 1));
    amb.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(1.3, 2.1), rgb: Math.random() < 0.7 ? c1 : c2 });
  }
}
function updateHanabi(dt) {
  amb.next -= dt;
  if (amb.next <= 0) { burst(); amb.next = rnd(1.6, 4.2) * (amb.reduce ? 2.5 : 1); }
  const k = Math.exp(-2.2 * dt);
  for (const q of amb.list) { q.t += dt; q.vx *= k; q.vy *= k; q.vy += 14 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  amb.list = amb.list.filter(q => q.t < q.life);
  for (const f of amb.flash) f.t += dt;
  amb.flash = amb.flash.filter(f => f.t < 0.8);
}
function drawHanabi() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of amb.flash) {                 // l'éclair de l'explosion éclaire le sol
    const a = 0.3 * (1 - f.t / 0.8), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 300);
    g.addColorStop(0, `rgba(${f.rgb},${a})`); g.addColorStop(1, `rgba(${f.rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(f.x - 300, f.y - 300, 600, 600);
  }
  ctx.lineCap = 'round';
  for (const q of amb.list) {
    const life = 1 - q.t / q.life, tw = q.t > q.life * 0.55 && Math.random() < 0.45 ? 0.25 : 1;   // les étincelles scintillent en mourant
    const tail = 0.1 + 0.08 * Math.min(1, q.t * 3);
    ctx.lineWidth = 7; ctx.strokeStyle = `rgba(${q.rgb},${0.35 * life * tw})`;
    ctx.beginPath(); ctx.moveTo(q.x - q.vx * tail, q.y - q.vy * tail); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${0.8 * life * tw})`;
    ctx.beginPath(); ctx.moveTo(q.x - q.vx * tail * 0.4, q.y - q.vy * tail * 0.4); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  ctx.restore();
}
function update(L, dt) {
  if (L.fx === 'hanabi') { updateHanabi(dt); return; }
  for (const q of amb.list) {
    q.ph += dt;
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
  if (L.fx === 'hanabi') { drawHanabi(); return; }
  for (const q of amb.list) {
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

/** Sous les lutteurs, par-dessus le public : la nuit, les lueurs, les guirlandes de lanternes. */
function drawArenaUnder() {
  const sc = sceneFor(G.arena);
  if (sc && sc.under) sc.under(ctx, V, G.t);
}
/** Au-dessus des lutteurs : ce qui tombe ou flotte (dt = 0 : tout est figé, par exemple en pause). */
function drawArenaOver(dt) {
  const L = look();
  ensure(L);
  if (!L) return;
  if (dt > 0) update(L, Math.min(dt, 0.1));
  drawAmbient(L);
}

/** Petite vignette d'une arène pour le vestiaire : le dohyō, un peu de la carte autour et son public. */
const previews = {};                           // dessinées une fois : le vestiaire se redessine à chaque clic
function arenaPreview(id, size = 192) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const sc = sceneFor(id);
  const draw = () => {
    if (!(MAP.complete && MAP.naturalWidth && CROWD.complete && CROWD.naturalWidth)) { setTimeout(draw, 100); return; }
    const g = c.getContext('2d');
    const key = id + '|' + size;
    if (previews[key]) { g.drawImage(previews[key], 0, 0); return; }
    const S = sc ? 2300 : 1180, k = size / S, x0 = C - S / 2, y0 = C - S / 2;      // le dohyō et ce qui l'entoure
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    if (sc) { g.fillStyle = sc.base; g.fillRect(x0, y0, S, S); sc.paint(g, x0, y0, x0 + S, y0 + S); }
    else g.drawImage(MAP, 0, 0, W, W);
    g.lineWidth = 24; g.strokeStyle = '#d4bf83'; g.beginPath(); g.arc(C, C, R0 + 10, 0, TAU); g.stroke();
    if (sc) {
      for (const [x, y, v, ph, kind] of sc.seats()) {
        if (x < x0 - 30 || x > x0 + S + 30 || y < y0 - 30 || y > y0 + S + 30) continue;
        if (kind === 'kasa') { g.fillStyle = ['#b8322f', '#2d4f86', '#7b3a6b', '#c47a2c'][v & 3]; g.beginPath(); g.arc(x, y, 32, 0, TAU); g.fill(); continue; }
        g.save(); g.translate(x, y); g.rotate(Math.atan2(C - y, C - x));
        g.drawImage(CROWD, v * 112, 0, 112, 112, -28, -28, 56, 56);
        g.restore();
      }
      if (sc.under) sc.under(g, { x0, y0, x1: x0 + S, y1: y0 + S }, 0);
    }
    const keep = document.createElement('canvas'); keep.width = keep.height = size;
    keep.getContext('2d').drawImage(c, 0, 0);
    previews[key] = keep;
  };
  draw();
  return c;
}

export { arenaById, arenaPreview, drawArenaOver, drawArenaUnder };
