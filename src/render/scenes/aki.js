/**
 * Temple d'automne (Aki basho) : le dohyō sur la terre battue d'un vieux temple bouddhiste. Le grand
 * hall aux tuiles grises à gauche (le public assis sur sa véranda), la pagode à cinq toits en haut à
 * droite, l'étang aux carpes et son pont rouge en bas à droite, des érables en feu et de la mousse.
 */
import { C, TAU } from '../../sim/constants.js';
import { DOHYO, blobPath, canopy, dohyo, fillTile, poly, rng, roof, rotated, shadowed, speckle, stoneLantern, textureTile, inDisc, inRect } from './tools.js';

const E0 = C - DOHYO - 26, E1 = C + DOHYO + 26;
const LANE = [C - 64, C + 64];                          // l'allée vers le hall, à gauche
const MOMIJI = [
  ['#6e1712', '#9c2619', '#c9402a', '#ea7448'],
  ['#7d3410', '#b4521a', '#e0812c', '#f4ad55'],
  ['#7a5a10', '#b38c1e', '#dcb73e', '#f2d97c'],
  ['#701a2a', '#a12d34', '#cf5a44', '#ef9a64'],
];
const PINE = ['#22382a', '#2d4935', '#3c5f42', '#557b54'];
const TILE = ['#9ba2a9', '#8c939a', '#5e656c', '#697077'];
const POND = { x: 1600, y: 1090, r: 230 };
const PAGODA = { x: 1650, y: 300 };
const HALL = { x: -350, y: C, w: 440, h: 660 };

let L = null;
function layout() {
  if (L) return L;
  const r = rng(5209);
  const trees = [];
  for (const [x, y, R, k] of [
    [120, 120, 106, 0], [1288, 120, 100, 1], [120, 1288, 104, 2], [1288, 1288, 100, 0],
    [-40, 250, 120, 1], [-60, 1150, 128, 0], [1410, 520, 112, 3], [1420, 840, 100, 2],
    [-700, 250, 160, 0], [-700, 1150, 160, 2], [1960, 520, 150, 1], [1960, 1300, 150, 0], [2000, 60, 140, 3],
    [1350, 1480, 140, 1], [1880, 1500, 130, 3],
    [420, -60, 150, 2], [990, -50, 140, 0], [700, -300, 170, 3], [180, -260, 140, 1], [1240, -240, 150, 2],
    [420, 1470, 150, 3], [990, 1480, 140, 1], [700, 1720, 160, 0], [180, 1680, 140, 2],
  ]) trees.push({ x, y, r: R, pal: MOMIJI[k] });
  for (const [x, y, R] of [[-260, 100, 120], [-280, 1320, 130], [1360, -60, 120], [2200, 900, 150], [-560, -160, 150], [-560, 1600, 150]]) trees.push({ x, y, r: R, pal: PINE });
  const under = (x, y) => trees.some(t => Math.hypot(x - t.x, y - t.y) < t.r * 0.9);
  const onLane = (x, y) => y > LANE[0] - 30 && y < LANE[1] + 30 && x < E0;

  // nattes de paille (goza) autour du dohyō, trois rangs de spectateurs
  const seats = [], goza = [];
  const band = 176, gap = 16;
  const strip = (a, b, n) => { const l = (b - a - gap * (n - 1)) / n; return Array.from({ length: n }, (_, i) => [a + i * (l + gap), l]); };
  const mat = (x, y, w, h) => {
    goza.push([x, y, w, h]);
    const cols = Math.max(1, Math.round((w - 14) / 58)), rws = Math.max(1, Math.round((h - 14) / 58));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rws; j++) {
      const sx = x + (i + 0.5) * w / cols + (r() - 0.5) * 8, sy = y + (j + 0.5) * h / rws + (r() - 0.5) * 8;
      if (r() < 0.08 || under(sx, sy) || onLane(sx, sy)) continue;
      seats.push([Math.round(sx), Math.round(sy), (r() * 16) | 0, Math.round(r() * 1000) / 1000]);
    }
  };
  for (const [a, l] of strip(E0, E1, 4)) { mat(a, E0 - band - 6, l, band); mat(a, E1 + 6, l, band); }
  for (const [y, l] of strip(E0, E1, 4)) mat(E1 + 6, y, band, l);
  for (const [a, b] of [[E0, LANE[0] - 34], [LANE[1] + 34, E1]]) for (const [y, l] of strip(a, b, 2)) mat(E0 - band - 6, y, band, l);
  // la véranda du hall : une rangée assise, jambes pendantes vers la cour
  const vx = HALL.x + HALL.w / 2 + 26;
  for (let y = HALL.y - HALL.h / 2 + 40; y < HALL.y + HALL.h / 2 - 20; y += 58) if (Math.abs(y - C) > 90 && r() > 0.1) seats.push([vx, Math.round(y), (r() * 16) | 0, Math.round(r() * 1000) / 1000]);
  // quelques visiteurs au bord de l'étang
  for (let k = 0; k < 9; k++) {
    const a = 1.9 + k * 0.32, x = POND.x + Math.cos(a) * (POND.r + 46), y = POND.y + Math.sin(a) * (POND.r + 46);
    const nearBridge = Math.abs(Math.sin(a + 0.18)) < 0.4;   // le pont part de chaque côté de l'étang
    if (!under(x, y) && !nearBridge && x > E1 + 196 && r() > 0.25) seats.push([Math.round(x), Math.round(y), (r() * 16) | 0, Math.round(r() * 1000) / 1000]);
  }
  const lanterns = [[-40, LANE[0] - 56], [-40, LANE[1] + 56], [1390, 1290], [1800, 1290], [1460, 120]];
  const stones = [];                                     // pas japonais vers l'étang et la pagode
  for (let k = 0; k < 7; k++) stones.push([E1 + 210 + k * 38 + (r() - 0.5) * 14, E1 + 30 + k * 34 + (r() - 0.5) * 14, 20 + r() * 6]);
  for (let k = 0; k < 6; k++) stones.push([E1 + 220 + k * 34 + (r() - 0.5) * 12, E0 - 20 - k * 30 + (r() - 0.5) * 12, 19 + r() * 6]);
  const koi = Array.from({ length: 9 }, () => [r.range(-0.7, 0.7), r.range(-0.6, 0.6), r() * TAU, r.pick(['#ff7a22', '#f6f1e8', '#e8452a', '#f2a23a'])]);
  return (L = { trees, seats, goza, lanterns, stones, koi, leaves: (r() * 1e6) | 0 });
}

let T = null;
function tiles() {
  if (T) return T;
  T = {
    moss: textureTile(256, 91, (n, m, x, y, r) => {
      const k = 0.78 + n * 0.3 + (m > 0.6 ? 0.08 : 0) + (r - 0.5) * 0.16;
      return [84 * k, 112 * k, 58 * k];
    }, { cells: 5, fine: 36 }),
    earth: textureTile(256, 92, (n, m, x, y, r) => { const k = 0.88 + n * 0.12 + m * 0.07 + (r - 0.5) * 0.1; return [190 * k, 164 * k, 122 * k]; }, { cells: 4, fine: 32 }),
  };
  return T;
}

function goza(g, x, y, w, h) {
  shadowed(g, () => { g.fillStyle = '#b89a5c'; g.fillRect(x, y, w, h); }, { dx: 3, dy: 4, blur: 4, color: 'rgba(40,25,10,.3)' });
  g.fillStyle = '#d2b878'; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(120,90,40,.22)'; g.lineWidth = 2;
  for (let k = 4; k < w; k += 7) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + h); g.stroke(); }
  g.strokeStyle = '#3d5a36'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, h - 6);   // le liseré de tissu
}

function hall(g) {
  const { x, y, w, h } = HALL, x1 = x + w / 2;
  // véranda en bois (engawa) devant le hall, le long de la cour
  g.fillStyle = '#6e4e30'; g.fillRect(x1 - 10, y - h / 2 + 10, 64, h - 20);
  g.strokeStyle = 'rgba(30,18,8,.35)'; g.lineWidth = 2;
  for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x1 - 10 + k * 11, y - h / 2 + 10); g.lineTo(x1 - 10 + k * 11, y + h / 2 - 10); g.stroke(); }
  g.fillStyle = 'rgba(255,220,170,.12)'; g.fillRect(x1 - 10, y - h / 2 + 10, 64, 4);
  // marches de pierre vers l'allée
  for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#a6a198' : '#b8b3a8'; g.fillRect(x1 + 54 + k * 18, y - 80 + k * 6, 18, 160 - k * 12); }
  roof(g, x, y, w, h, { pal: TILE, ridge: '#3a3e42', lines: 'tiles', lineA: 0.24, step: 13, seed: 21, ridgeW: 22, shadow: 54 });
  // les ornements en queue de poisson (shibi), dorés, aux bouts du faîtage
  const a = y - h / 2 + w / 2, b = y + h / 2 - w / 2;
  for (const [yy, s] of [[a, -1], [b, 1]]) {
    g.fillStyle = '#c99a36';
    g.beginPath(); g.moveTo(x - 16, yy); g.quadraticCurveTo(x - 20, yy + s * 30, x, yy + s * 38); g.quadraticCurveTo(x + 20, yy + s * 30, x + 16, yy); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,240,180,.5)'; g.beginPath(); g.ellipse(x - 5, yy + s * 14, 4, 10, 0, 0, TAU); g.fill();
  }
}

/** Pagode à cinq toits : chaque toit plus petit et, vu d'en haut, plus décalé vers l'extérieur. */
function pagoda(g) {
  const { x, y } = PAGODA, dx = x - C, dy = y - C, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const sizes = [300, 254, 214, 178, 146];
  shadowed(g, () => { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x - 150, y - 150, 300, 300); }, { dx: 120, dy: 150, blur: 50, color: 'rgba(20,12,6,.35)' });
  sizes.forEach((s, k) => {
    const ox = x + ux * k * 18, oy = y + uy * k * 18;
    if (k) {                                              // le mur rouge du niveau, sous le toit
      g.fillStyle = '#8f2b1f'; g.fillRect(ox - s * 0.36, oy - s * 0.36, s * 0.72, s * 0.72);
    }
    roof(g, ox, oy, s, s, { kind: 'hip', pal: ['#80878e', '#737a81', '#4e555b', '#585f65'], ridge: null, lines: 'tiles', lineA: 0.22, step: 11, seed: 30 + k, shadow: 26 });
    g.strokeStyle = 'rgba(30,26,22,.55)'; g.lineWidth = 4; g.strokeRect(ox - s / 2, oy - s / 2, s, s);
    g.strokeStyle = 'rgba(230,220,200,.35)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(ox - s / 2, oy - s / 2); g.lineTo(ox + s / 2, oy + s / 2); g.moveTo(ox + s / 2, oy - s / 2); g.lineTo(ox - s / 2, oy + s / 2); g.stroke();
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.fillStyle = '#c99a36'; g.beginPath(); g.arc(ox + cx * s / 2, oy + cy * s / 2, 5, 0, TAU); g.fill(); }  // clochettes aux coins
  });
  // la flèche de bronze (sōrin) et ses neuf anneaux, qui monte vers l'extérieur
  const bx = x + ux * 88, by = y + uy * 88, tx = x + ux * 190, ty = y + uy * 190;
  g.strokeStyle = '#5b4a2a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke();
  for (let k = 0; k < 9; k++) {
    const t = k / 9, cx = bx + (tx - bx) * t, cy = by + (ty - by) * t;
    g.fillStyle = k % 2 ? '#b8923c' : '#9c7a2e'; g.beginPath(); g.arc(cx, cy, 14 - k * 0.6, 0, TAU); g.fill();
  }
  g.fillStyle = '#d6b45a'; g.beginPath(); g.arc(tx, ty, 9, 0, TAU); g.fill();
  g.lineCap = 'butt';
}

function pond(g, Lt) {
  const { x, y, r: R } = POND, rr = rng(61);
  // berge de pierres, eau sombre, nénuphars, carpes, reflets
  g.fillStyle = '#6d6a62'; blobPath(g, x, y, R + 22, rng(62), 13, 0.12); g.fill();
  const rocks = rng(63);
  for (let k = 0; k < 40; k++) {
    const a = k / 40 * TAU + rocks() * 0.1, rad = R + 12 + rocks() * 10, sx = x + Math.cos(a) * rad * 1.02, sy = y + Math.sin(a) * rad * 0.98;
    g.fillStyle = `rgb(${130 + rocks() * 40 | 0},${126 + rocks() * 36 | 0},${116 + rocks() * 30 | 0})`;
    blobPath(g, sx, sy, 12 + rocks() * 10, rocks, 7, 0.2); g.fill();
  }
  g.save();
  blobPath(g, x, y, R, rng(62), 13, 0.12); g.clip();
  const wg = g.createRadialGradient(x - R * 0.3, y - R * 0.3, 20, x, y, R * 1.2);
  wg.addColorStop(0, '#3f7c78'); wg.addColorStop(1, '#173a3c');
  g.fillStyle = wg; g.fillRect(x - R - 30, y - R - 30, 2 * R + 60, 2 * R + 60);
  g.fillStyle = 'rgba(0,0,0,.25)'; blobPath(g, x + 14, y + 16, R, rng(62), 13, 0.12); g.fill();   // l'ombre de la berge
  for (const [u, v, a, col] of Lt.koi) {
    rotated(g, x + u * R, y + v * R, a, () => {
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(4, 5, 17, 6, 0, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 17, 6, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-14, 0); g.lineTo(-25, -7); g.lineTo(-23, 0); g.lineTo(-25, 7); g.closePath(); g.fill();
      if (col === '#f6f1e8') { g.fillStyle = '#e8452a'; g.beginPath(); g.ellipse(3, 0, 6, 4, 0, 0, TAU); g.fill(); }
    });
  }
  for (let k = 0; k < 7; k++) {                            // nénuphars
    const a = rr() * TAU, d = R * (0.45 + rr() * 0.45), lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d, s = 14 + rr() * 10;
    g.fillStyle = '#3f7a3a'; g.beginPath(); g.moveTo(lx, ly); g.arc(lx, ly, s, a + 0.3, a + TAU - 0.3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(160,210,120,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(lx, ly, s * 0.7, a + 0.6, a + TAU - 0.6); g.stroke();
  }
  speckle(g, rr, 26, ['#c8452c', '#e07a2e', '#e9a23b'], inDisc(x, y, R), [5, 8]);   // feuilles qui flottent
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x - R * 0.35 + k * 30, y - R * 0.45 + k * 20, 26, 6, -0.3, 0, Math.PI); g.stroke(); }
  g.restore();
  // le pont arqué (taikobashi) : tablier de bois, rambardes vermillon, plus clair au sommet de l'arche
  const bx0 = x - R - 40, bx1 = x + R + 40, bw = 70;
  rotated(g, x, y, -0.18, () => {
    const hw = (bx1 - bx0) / 2;
    g.fillStyle = 'rgba(10,20,20,.35)'; g.fillRect(-hw + 30, -bw / 2 + 40, 2 * hw, bw);
    const deck = g.createLinearGradient(-hw, 0, hw, 0);
    deck.addColorStop(0, '#6b4a2c'); deck.addColorStop(0.5, '#a7774a'); deck.addColorStop(1, '#6b4a2c');
    g.fillStyle = deck; g.fillRect(-hw, -bw / 2, 2 * hw, bw);
    g.strokeStyle = 'rgba(40,24,10,.45)'; g.lineWidth = 2;
    for (let k = -hw + 12; k < hw; k += 12) { g.beginPath(); g.moveTo(k, -bw / 2); g.lineTo(k, bw / 2); g.stroke(); }
    for (const s of [-1, 1]) {
      g.fillStyle = '#c8371f'; g.fillRect(-hw, s * bw / 2 - 6, 2 * hw, 12);
      g.fillStyle = 'rgba(255,190,150,.4)'; g.fillRect(-hw, s * bw / 2 - 6, 2 * hw, 3);
      for (let k = -hw; k <= hw; k += 2 * hw / 6) { g.fillStyle = '#9e2614'; g.fillRect(k - 7, s * bw / 2 - 9, 14, 18); g.fillStyle = '#d9a93a'; g.beginPath(); g.arc(k, s * bw / 2, 5, 0, TAU); g.fill(); }
    }
  });
}

function paint(g, x0, y0, x1, y1) {
  const Lt = layout(), t = tiles();
  fillTile(g, t.moss, 300, x0, y0, x1, y1);
  // la cour en terre battue autour du dohyō, aux bords irréguliers
  g.save();
  g.beginPath();
  g.roundRect(E0 - 230, E0 - 230, E1 - E0 + 460, E1 - E0 + 460, 140);
  g.rect(HALL.x + HALL.w / 2, LANE[0] - 60, E0 - HALL.x - HALL.w / 2, LANE[1] - LANE[0] + 120);
  g.clip();
  fillTile(g, t.earth, 300, x0, y0, x1, y1);
  g.restore();
  g.strokeStyle = 'rgba(50,60,30,.35)'; g.lineWidth = 8;
  g.beginPath(); g.roundRect(E0 - 230, E0 - 230, E1 - E0 + 460, E1 - E0 + 460, 140); g.stroke();
  // des pas japonais dans la mousse
  for (const [x, y, s] of Lt.stones) {
    g.fillStyle = 'rgba(30,30,20,.35)'; blobPath(g, x + 4, y + 5, s, rng(x | 0), 7, 0.2); g.fill();
    g.fillStyle = '#a19c90'; blobPath(g, x, y, s, rng(x | 0), 7, 0.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; blobPath(g, x - 3, y - 3, s * 0.6, rng(x | 0), 7, 0.2); g.fill();
  }
  const r = rng(Lt.leaves);
  speckle(g, r, Math.round((x1 - x0) * (y1 - y0) / 1500), ['#b8322a', '#d1602a', '#e9a23b', '#c8452c', '#8a3a1a'], inRect(x0, y0, x1, y1), [3, 6]);
  for (const tr of Lt.trees) if (tr.pal !== PINE) speckle(g, r, 120, tr.pal.slice(1), inDisc(tr.x + tr.r * 0.2, tr.y + tr.r * 0.2, tr.r * 1.45), [3.5, 6.5]);
  for (const m of Lt.goza) goza(g, ...m);
  pond(g, Lt);
  for (const [x, y] of Lt.lanterns) stoneLantern(g, x, y, 28, 150);
  hall(g);
  dohyo(g, { clay: [198, 160, 104], seed: 7 });
  pagoda(g);
  for (const tr of Lt.trees) canopy(g, tr.x, tr.y, tr.r, tr.pal, rng(tr.x * 13 + tr.y * 7), { tufts: 18, shadow: 'rgba(30,18,8,.3)' });
}

export default {
  id: 'aki', base: '#5c6e3c', paint, seats: () => layout().seats,
  fx: 'momiji', count: 40,
  vignette: { rgb: '50,24,8', a: [0, 0.08, 0.34] },
};
