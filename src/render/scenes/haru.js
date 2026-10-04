/**
 * Sanctuaire aux cerisiers (Haru basho) : un tournoi en plein air dans la cour d'un sanctuaire shintō.
 * Gravier blanc ratissé, le hall au toit de cuivre à gauche, l'allée et le torii vermillon à droite,
 * des cerisiers en fleurs et le public assis sur des tapis de feutre rouge et des bâches de pique-nique.
 */
import { C, TAU } from '../../sim/constants.js';
import { DOHYO, canopy, dohyo, fillTile, poly, subPoly, rng, roof, rotated, seatRow, shadowed, speckle, stoneLantern, textureTile, inDisc, inRect } from './tools.js';

const E0 = C - DOHYO - 26, E1 = C + DOHYO + 26;           // bord extérieur du dohyō (talus compris)
const PATH = [C - 64, C + 64];                             // l'allée de pierre (sandō), d'ouest en est
const SAKURA = ['#c97994', '#e29bb5', '#f3bdd0', '#ffe2eb'];
const PINE = ['#2f4a35', '#3d5e42', '#4f7552', '#6a8f62'];

let L = null;
function layout() {
  if (L) return L;
  const r = rng(4101);
  const trees = [
    // coins du dohyō
    [118, 118, 104], [1290, 118, 104], [118, 1290, 104], [1290, 1290, 104],
    // côté du sanctuaire
    [-20, 258, 128], [-40, 1150, 138], [-230, 300, 118], [-230, 1110, 128], [-560, 240, 150], [-560, 1180, 150],
    // côté du torii
    [1430, 262, 128], [1450, 1146, 138], [1660, 322, 118], [1700, 1090, 128], [1960, 250, 150], [1990, 1170, 150], [2250, 520, 140], [2250, 900, 140],
    // en haut et en bas (visibles sur un écran en hauteur)
    [420, -64, 150], [990, -46, 140], [700, -300, 170], [190, -270, 140], [1220, -250, 150],
    [430, 1478, 150], [990, 1460, 140], [700, 1700, 170], [190, 1690, 140], [1220, 1660, 150],
  ].map(([x, y, R]) => ({ x, y, r: R, pine: false }));
  for (const [x, y, R] of [[-720, 700, 170], [-430, -120, 150], [1860, -140, 150], [-430, 1560, 150], [1860, 1560, 150], [2500, 200, 160], [2500, 1200, 160]]) trees.push({ x, y, r: R, pine: true });
  const under = (x, y) => trees.some(t => Math.hypot(x - t.x, y - t.y) < t.r * 0.9);
  const onPath = (x, y) => y > PATH[0] - 34 && y < PATH[1] + 34 && (x < E0 || x > E1);
  const avoid = (x, y) => under(x, y) || onPath(x, y);

  // premiers rangs : des carrés de feutre rouge posés sur le gravier, trois rangs de spectateurs chacun
  const seats = [], felt = [];
  const band = 176, gap = 18;
  const strip = (a, b, n) => { const l = (b - a - gap * (n - 1)) / n; return Array.from({ length: n }, (_, i) => [a + i * (l + gap), l]); };
  const mat = (x, y, w, h) => {
    felt.push([x, y, w, h]);
    const cols = Math.max(1, Math.round((w - 14) / 58)), rws = Math.max(1, Math.round((h - 14) / 58));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rws; j++) {
      const sx = x + (i + 0.5) * w / cols + (r() - 0.5) * 8, sy = y + (j + 0.5) * h / rws + (r() - 0.5) * 8;
      if (r() < 0.07 || avoid(sx, sy)) continue;
      seats.push([Math.round(sx), Math.round(sy), (r() * 16) | 0, Math.round(r() * 1000) / 1000]);
    }
  };
  for (const [a, l] of strip(E0, E1, 5)) { mat(a, E0 - band - 6, l, band); mat(a, E1 + 6, l, band); }
  for (const [a, b] of [[E0, PATH[0] - 34], [PATH[1] + 34, E1]]) for (const [y, l] of strip(a, b, 2)) { mat(E0 - band - 6, y, band, l); mat(E1 + 6, y, band, l); }
  // pique-niques sous les arbres (hanami) : bâches, petites boîtes à repas, le groupe assis autour
  const mats = [];
  for (const [x, y, w, h, a, kind] of [
    [0, 470, 150, 118, -0.08, 'blue'], [10, 944, 156, 120, 0.06, 'check'], [1420, 486, 150, 112, 0.1, 'check'], [1416, 924, 156, 118, -0.05, 'blue'],
    [1820, 520, 160, 120, 0.12, 'blue'], [1830, 890, 150, 116, -0.1, 'pink'], [-420, 1380, 150, 116, 0.08, 'pink'], [-400, 30, 150, 116, -0.1, 'blue'],
    [700, -60, 170, 110, 0.03, 'check'], [240, 40, 140, 100, -0.12, 'pink'], [1180, 50, 140, 100, 0.1, 'blue'],
    [700, 1450, 170, 112, -0.04, 'blue'], [230, 1370, 140, 100, 0.1, 'check'], [1180, 1360, 140, 100, -0.1, 'pink'],
    [2100, 1380, 160, 116, 0.06, 'check'], [2120, 30, 160, 116, -0.06, 'pink'],
  ]) {
    mats.push({ x, y, w, h, a, kind, items: Array.from({ length: 3 }, () => [(r() - 0.5) * w * 0.4, (r() - 0.5) * h * 0.25, r()]) });
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const [u, v] of [[-0.36, -0.36], [0, -0.38], [0.36, -0.34], [-0.38, 0.36], [0.02, 0.38], [0.38, 0.36]]) {
      const px = u * w, py = v * h, sx = x + px * ca - py * sa, sy = y + px * sa + py * ca;
      if (r() < 0.2 || under(sx, sy)) continue;                 // une place libre, ou sous les branches
      seats.push([Math.round(sx), Math.round(sy), (r() * 16) | 0, Math.round(r() * 1000) / 1000]);
    }
  }
  const lanterns = [[-40, PATH[0] - 52], [-40, PATH[1] + 52], [1420, PATH[0] - 52], [1420, PATH[1] + 52], [1760, PATH[0] - 52], [1760, PATH[1] + 52], [2080, PATH[0] - 52], [2080, PATH[1] + 52]];
  return (L = { trees, seats, felt, mats, lanterns, petals: r() * 1e6 | 0 });
}

let T = null;                       // textures, créées une fois
function tiles() {
  if (T) return T;
  T = {
    gravel: textureTile(256, 41, (n, m, x, y, r) => {
      const peb = m > 0.62 ? -0.07 : m < 0.3 ? 0.05 : 0;          // cailloux un peu plus foncés ou plus clairs
      const k = 0.93 + n * 0.06 + peb + (r - 0.5) * 0.13;
      return [222 * k, 216 * k, 204 * k];
    }, { cells: 4, fine: 40 }),
    stone: textureTile(128, 42, (n, m, x, y, r) => { const k = 0.82 + n * 0.16 + m * 0.08 + (r - 0.5) * 0.08; return [168 * k, 164 * k, 156 * k]; }, { cells: 3, fine: 16 }),
  };
  return T;
}

/** Allée en dalles de pierre (ishidatami) entre x0 et x1, deux rangées de dalles décalées. */
function stonePath(g, x0, x1, seed) {
  const r = rng(seed), [y0, y1] = PATH, half = (y1 - y0) / 2;
  shadowed(g, () => { g.fillStyle = '#8d877d'; g.fillRect(x0, y0 - 6, x1 - x0, y1 - y0 + 12); }, { dx: 3, dy: 4, blur: 6, color: 'rgba(40,30,20,.3)' });
  g.fillStyle = '#6f6a62'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const pat = g.createPattern(tiles().stone, 'repeat');
  for (let row = 0; row < 2; row++) {
    let x = x0 + (row ? -30 : 0);
    while (x < x1) {
      const l = 52 + r() * 46, ya = y0 + row * half + 3, xa = Math.max(x0, x) + 3, xb = Math.min(x1, x + l) - 3;
      if (xb > xa) {
        g.fillStyle = pat; g.fillRect(xa, ya, xb - xa, half - 6);
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.06})`; g.fillRect(xa, ya, xb - xa, half - 6);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(xa, ya, xb - xa, 2); g.fillRect(xa, ya, 2, half - 6);
      }
      x += l;
    }
  }
}

/**
 * Torii vermillon. Vu d'au-dessus du dohyō, son sommet penche vers l'extérieur (comme dans une vraie
 * perspective) : on voit les deux piliers, le linteau (nuki) et le chapeau noir (kasagi). L'ombre
 * portée part vers le bas à droite.
 */
function torii(g, x, y, half, lean = 120) {
  const post = half * 0.6, H = 230, sx = H * 0.45, sy = H * 0.6;
  g.beginPath();                                             // ombre : une seule forme, pas de double ombre aux croisements
  for (const py of [y - post, y + post]) subPoly(g, [[x - 12, py - 12], [x + 12, py + 12], [x + sx + 12, py + sy + 12], [x + sx - 12, py + sy - 12]]);
  subPoly(g, [[x + sx - 14, y + sy - half - 26], [x + sx + 14, y + sy - half - 22], [x + sx + 14, y + sy + half + 22], [x + sx - 14, y + sy + half + 26]]);
  subPoly(g, [[x + sx * 0.75 - 8, y + sy * 0.75 - post - 24], [x + sx * 0.75 + 8, y + sy * 0.75 - post - 24], [x + sx * 0.75 + 8, y + sy * 0.75 + post + 24], [x + sx * 0.75 - 8, y + sy * 0.75 + post + 24]]);
  g.fillStyle = 'rgba(46,28,20,.3)'; g.fill('nonzero');
  for (const py of [y - post, y + post]) {                   // socles de pierre noire
    g.fillStyle = '#2a2420'; g.beginPath(); g.arc(x, py, 19, 0, TAU); g.fill();
  }
  const bar = (xa, xb, ya, w, col, hi) => {                  // un pilier qui monte vers l'extérieur
    g.fillStyle = col; g.fillRect(xa, ya - w / 2, xb - xa, w);
    g.fillStyle = hi; g.fillRect(xa, ya - w / 2, xb - xa, w * 0.3);
  };
  for (const py of [y - post, y + post]) bar(x, x + lean * 0.96, py, 28, '#c8371f', 'rgba(255,170,120,.35)');
  const xn = x + lean * 0.7;                                  // le linteau (nuki), qui dépasse un peu des piliers
  g.fillStyle = '#b52f1b'; g.fillRect(xn - 9, y - post - 30, 18, 2 * post + 60);
  g.fillStyle = 'rgba(255,170,120,.35)'; g.fillRect(xn - 9, y - post - 30, 5, 2 * post + 60);
  g.fillStyle = '#c8371f'; g.fillRect(xn + 6, y - 14, lean * 0.24, 28);                    // le petit montant central
  const xk = x + lean;                                        // le chapeau : rouge dessous, noir dessus, bouts relevés
  shadowed(g, () => { g.fillStyle = '#c8371f'; g.fillRect(xk - 16, y - half - 18, 32, 2 * half + 36); }, { dx: 8, dy: 10, blur: 10 });
  g.fillStyle = '#1c1714';
  poly(g, [[xk + 2, y - half - 34], [xk + 20, y - half - 26], [xk + 15, y], [xk + 20, y + half + 26], [xk + 2, y + half + 34], [xk + 6, y]]); g.fill();
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(xk + 6, y - half - 22, 4, 2 * half + 44);
}

/** Corde sacrée (shimenawa) et ses papiers en zigzag (shide), le long d'une ligne verticale. */
function shimenawa(g, x, y0, y1) {
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(40,25,10,.35)'; g.lineWidth = 22; g.beginPath(); g.moveTo(x + 6, y0 + 8); g.lineTo(x + 6, y1 + 8); g.stroke();
  g.strokeStyle = '#d9c48c'; g.lineWidth = 20; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
  g.strokeStyle = 'rgba(120,90,40,.55)'; g.lineWidth = 3;
  for (let y = y0; y < y1; y += 14) { g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y + 10); g.stroke(); }
  g.lineCap = 'butt';
  for (let y = y0 + 40; y < y1 - 20; y += 64) {
    g.fillStyle = '#fbfaf5';
    poly(g, [[x + 6, y - 7], [x + 26, y - 7], [x + 20, y], [x + 34, y], [x + 28, y + 7], [x + 44, y + 7], [x + 44, y + 13], [x + 22, y + 13], [x + 28, y + 6], [x + 14, y + 6], [x + 20, y - 1], [x + 6, y - 1]]);
    g.fill();
  }
}

function hallRoof(g) {
  const cx = -300, cy = C, w = 340, h = 520;
  roof(g, cx, cy, w, h, { pal: ['#94c3b1', '#86b8a5', '#56877a', '#5f9282'], ridge: '#365a50', lines: 'seams', lineA: 0.16, step: 12, seed: 7, ridgeW: 20, shadow: 46 });
  // katsuogi (rondins dorés en travers du faîte) et chigi (planches croisées aux extrémités)
  const a = cy - h / 2 + w / 2, b = cy + h / 2 - w / 2;
  for (let y = a + 10; y <= b - 10; y += (b - a - 20) / 4) {
    shadowed(g, () => { g.fillStyle = '#b88a3a'; g.fillRect(cx - 26, y - 7, 52, 14); }, { dx: 5, dy: 6, blur: 5 });
    g.fillStyle = '#e1b85c'; g.fillRect(cx - 26, y - 7, 52, 4);
    g.fillStyle = '#d8a548'; g.fillRect(cx - 28, y - 7, 4, 14); g.fillRect(cx + 24, y - 7, 4, 14);
  }
  // la façade : marches de bois, tronc à offrandes, et la corde sacrée sous l'avant-toit
  g.fillStyle = '#7b5a3a'; g.fillRect(cx + w / 2, cy - 110, 26, 220);
  g.fillStyle = 'rgba(255,230,190,.25)'; for (let k = 0; k < 3; k++) g.fillRect(cx + w / 2 + k * 9, cy - 110, 3, 220);
  shadowed(g, () => { g.fillStyle = '#5a3a22'; g.fillRect(cx + w / 2 + 30, cy - 46, 30, 92); }, { dx: 6, dy: 7, blur: 6 });
  g.fillStyle = '#3c2616'; for (let y = cy - 40; y < cy + 44; y += 10) g.fillRect(cx + w / 2 + 33, y, 24, 4);
  shimenawa(g, cx + w / 2 - 8, cy - 150, cy + 150);
}

function felt(g, x, y, w, h) {
  shadowed(g, () => { g.fillStyle = '#a5343a'; g.fillRect(x, y, w, h); }, { dx: 3, dy: 4, blur: 5, color: 'rgba(60,20,20,.3)' });
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, '#b9464a'); gr.addColorStop(1, '#9c3238');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,210,200,.16)'; g.lineWidth = 2; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
}

function picnic(g, m, rnd) {
  rotated(g, m.x, m.y, m.a, () => {
    const { w, h } = m, x = -w / 2, y = -h / 2;
    shadowed(g, () => { g.fillStyle = '#556'; g.fillRect(x, y, w, h); }, { dx: 3, dy: 4, blur: 4, color: 'rgba(30,30,50,.28)' });
    if (m.kind === 'check') {
      for (let i = 0; i < w / 18; i++) for (let j = 0; j < h / 18; j++) {
        g.fillStyle = (i + j) % 2 ? '#f2efe6' : '#d0453f';
        g.fillRect(x + i * 18, y + j * 18, Math.min(18, w - i * 18), Math.min(18, h - j * 18));
      }
    } else {
      g.fillStyle = m.kind === 'blue' ? '#3f7fc4' : '#e9a3b8'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x + w * k / 3, y); g.lineTo(x + w * k / 3, y + h); g.stroke(); }  // plis
      g.fillStyle = 'rgba(255,255,255,.9)'; for (const [cx, cy] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) { g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill(); }
    }
    for (const [ix, iy, k] of m.items) {                      // boîtes à repas laquées, bouteilles
      if (k < 0.6) {
        g.fillStyle = '#1d1414'; g.fillRect(ix - 15, iy - 11, 30, 22);
        g.fillStyle = '#a3262b'; g.fillRect(ix - 12, iy - 8, 24, 16);
        g.fillStyle = '#f5ecd4'; g.fillRect(ix - 9, iy - 5, 8, 10); g.fillStyle = '#e9a3b8'; g.fillRect(ix + 1, iy - 5, 8, 4); g.fillStyle = '#7fae5a'; g.fillRect(ix + 1, iy + 1, 8, 4);
      } else {
        g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(ix, iy, 7, 0, TAU); g.fill();
        g.fillStyle = '#2e5d3a'; g.beginPath(); g.arc(ix, iy, 3, 0, TAU); g.fill();
      }
    }
  });
}

function rakes(g) {
  // le gravier est ratissé en carrés concentriques autour du dohyō
  for (let d = 196; d < 420; d += 18) {
    g.strokeStyle = 'rgba(130,120,104,.20)'; g.lineWidth = 5;
    g.beginPath(); g.roundRect(E0 - d, E0 - d, E1 - E0 + 2 * d, E1 - E0 + 2 * d, d * 0.6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.32)'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(E0 - d + 4, E0 - d + 4, E1 - E0 + 2 * d - 8, E1 - E0 + 2 * d - 8, d * 0.6); g.stroke();
  }
}

function chozuya(g, x, y) {
  // bassin de purification : pierre creusée, eau claire, louches de bambou
  shadowed(g, () => { g.fillStyle = '#8b867c'; g.fillRect(x - 70, y - 34, 140, 68); }, { dx: 12, dy: 14, blur: 12 });
  g.fillStyle = '#a7a297'; g.fillRect(x - 70, y - 34, 140, 68);
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 70, y - 34, 140, 5); g.fillRect(x - 70, y - 34, 5, 68);
  const wg = g.createLinearGradient(x - 56, y - 22, x + 56, y + 22);
  wg.addColorStop(0, '#5a93a8'); wg.addColorStop(1, '#2f6577');
  g.fillStyle = wg; g.fillRect(x - 56, y - 22, 112, 44);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + 20, y + 4, 14, 7, 0, 0, TAU); g.stroke();
  g.strokeStyle = '#c9b46a'; g.lineWidth = 4; g.lineCap = 'round';
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 22, y - 30); g.lineTo(x + k * 22 + 6, y - 6); g.stroke(); g.fillStyle = '#c9b46a'; g.beginPath(); g.arc(x + k * 22 + 7, y - 2, 6, 0, TAU); g.fill(); }
  g.lineCap = 'butt';
}

function paint(g, x0, y0, x1, y1) {
  const Lt = layout(), t = tiles();
  fillTile(g, t.gravel, 300, x0, y0, x1, y1);
  rakes(g);
  stonePath(g, -130, E0, 11);
  stonePath(g, E1, Math.max(x1, E1) + 40, 12);
  const r = rng(Lt.petals);
  speckle(g, r, Math.round((x1 - x0) * (y1 - y0) / 2200), ['#f3bdd0', '#f8d3df', '#e9a6bd'], inRect(x0, y0, x1, y1), [2.5, 5]);
  for (const tr of Lt.trees) if (!tr.pine) speckle(g, r, 70, ['#f3bdd0', '#fbe0e8', '#e9a6bd'], inDisc(tr.x, tr.y, tr.r * 1.5), [2.5, 5.5]);
  for (const f of Lt.felt) felt(g, ...f);
  for (const m of Lt.mats) picnic(g, m, r);
  for (const [x, y] of Lt.lanterns) stoneLantern(g, x, y, 28, 158);
  chozuya(g, 1620, 470);
  hallRoof(g);
  dohyo(g, { clay: [206, 168, 112], seed: 3 });
  torii(g, 1540, C, 176);
  for (const tr of Lt.trees) canopy(g, tr.x, tr.y, tr.r, tr.pine ? PINE : SAKURA, rng(tr.x * 31 + tr.y), { tufts: tr.pine ? 14 : 18, shadow: 'rgba(60,40,50,.22)' });
  // pétales posés sur les couronnes
  for (const tr of Lt.trees) if (!tr.pine) speckle(g, r, 26, ['#fff1f5', '#ffd6e3'], inDisc(tr.x - tr.r * 0.15, tr.y - tr.r * 0.15, tr.r * 0.7), [2, 3.5]);
}

export default {
  id: 'haru', base: '#d6d0c4', paint, seats: () => layout().seats,
  fx: 'sakura', count: 60,
  vignette: { rgb: '60,40,50', a: [0, 0.06, 0.3] },
};
