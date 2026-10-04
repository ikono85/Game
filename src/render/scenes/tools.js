/**
 * Boîte à outils des cartes dessinées par le code : hasard reproductible, textures qui se répètent
 * sans couture, ombres, formes irrégulières, arbres, dohyō en terre battue. Tout est en coordonnées du
 * monde (le dohyō est centré en C = 704, le cercle fait R0 = 380).
 */
import { C, TAU } from '../../sim/constants.js';

/** Hasard reproductible : la même carte à chaque partie. */
function rng(seed) {
  let s = seed | 0;
  const r = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + r() * (b - a);
  r.pick = list => list[(r() * list.length) | 0];
  return r;
}

/** Bruit lisse qui se répète sans couture (valeurs 0..1), plusieurs octaves. */
function noise(size, cells, seed, octaves = 3) {
  const out = new Float32Array(size * size);
  const r = rng(seed);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o, lat = new Float32Array(n * n);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < size; y++) {
      const fy = y / size * n, y0 = fy | 0, ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % n) * n, yb = ((y0 + 1) % n) * n;
      for (let x = 0; x < size; x++) {
        const fx = x / size * n, x0 = fx | 0, tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % n, xb = (x0 + 1) % n;
        const a = lat[ya + xa] + (lat[ya + xb] - lat[ya + xa]) * sx;
        const b = lat[yb + xa] + (lat[yb + xb] - lat[yb + xa]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

/**
 * Tuile de texture : color(n, m, x, y, r) renvoie [r, g, b] pour chaque pixel, avec n un bruit large,
 * m un bruit fin et r un grain aléatoire. La tuile se répète sans couture.
 */
function textureTile(size, seed, color, { cells = 4, fine = 24 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  const n = noise(size, cells, seed), m = noise(size, fine, seed + 7, 2), r = rng(seed + 13);
  for (let i = 0, p = 0; i < n.length; i++, p += 4) {
    const [R, G, B] = color(n[i], m[i], i % size, (i / size) | 0, r());
    d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
const mix = (a, b, t) => a + (b - a) * t;
const mixRGB = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Dessine fn() avec une ombre portée douce (la lumière vient d'en haut à gauche). */
function shadowed(g, fn, { dx = 14, dy = 18, blur = 18, color = 'rgba(20,12,6,.45)' } = {}) {
  g.save();
  g.shadowColor = color; g.shadowBlur = blur * g.getTransform().a; g.shadowOffsetX = dx * g.getTransform().a; g.shadowOffsetY = dy * g.getTransform().d;
  fn();
  g.restore();
}

/** Chemin d'un cercle irrégulier (pierre, buisson, flaque). */
function blobPath(g, x, y, r, rnd, bumps = 9, wobble = 0.18) {
  const k = [];
  for (let i = 0; i < bumps; i++) k.push(1 + (rnd() - 0.5) * 2 * wobble);
  g.beginPath();
  for (let i = 0; i <= bumps; i++) {
    const a0 = i / bumps * TAU, a1 = (i + 0.5) / bumps * TAU;
    const r0 = r * k[i % bumps], r1 = r * (k[i % bumps] + k[(i + 1) % bumps]) / 2;
    if (i === 0) g.moveTo(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0);
    else g.quadraticCurveTo(x + Math.cos(a1 - TAU / bumps) * r1 * 1.08, y + Math.sin(a1 - TAU / bumps) * r1 * 1.08, x + Math.cos(a0) * r0, y + Math.sin(a0) * r0);
  }
  g.closePath();
}

/**
 * Couronne d'arbre vue de dessus : ombre au sol, masse sombre, puis touffes de plus en plus claires
 * vers le haut à gauche. pal = [sombre, moyen, clair, reflet].
 */
function canopy(g, x, y, r, pal, rnd, { tufts = 16, shadow = 'rgba(25,14,8,.32)' } = {}) {
  g.fillStyle = shadow;                                   // ombre sur le sol
  blobPath(g, x + r * 0.28, y + r * 0.34, r * 1.02, rnd, 11, 0.12); g.fill();
  g.fillStyle = pal[0];
  blobPath(g, x, y, r, rnd, 11, 0.14); g.fill();
  for (let layer = 1; layer <= 3; layer++) {
    const n = layer === 3 ? tufts * 0.6 : tufts;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * (layer === 1 ? 0.85 : 0.7);
      let tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d;
      tx -= r * 0.08 * layer; ty -= r * 0.08 * layer;            // les touffes claires sont côté lumière
      const tr = r * (layer === 1 ? 0.32 : layer === 2 ? 0.24 : 0.14) * (0.7 + rnd() * 0.6);
      g.fillStyle = pal[layer];
      blobPath(g, tx, ty, tr, rnd, 7, 0.22); g.fill();
    }
  }
}

/** Petites taches éparses (pétales, feuilles mortes, gravillons) dans un disque ou un rectangle. */
function speckle(g, rnd, n, colors, place, size = [2, 5], rot = true) {
  for (let i = 0; i < n; i++) {
    const [x, y] = place(rnd);
    const s = size[0] + rnd() * (size[1] - size[0]);
    g.fillStyle = colors[(rnd() * colors.length) | 0];
    g.beginPath();
    if (rot) g.ellipse(x, y, s, s * 0.6, rnd() * TAU, 0, TAU); else g.arc(x, y, s, 0, TAU);
    g.fill();
  }
}
const inDisc = (cx, cy, r) => rnd => { const a = rnd() * TAU, d = Math.sqrt(rnd()) * r; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d]; };
const inRect = (x0, y0, x1, y1) => rnd => [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];

/** Rectangle tourné (tapis, étal, toit) : appelle fn(w, h) dans un repère centré sur (x, y). */
function rotated(g, x, y, a, fn) { g.save(); g.translate(x, y); g.rotate(a); fn(); g.restore(); }

/**
 * Le dohyō en terre battue des tournois de plein air : un carré de terre surélevé (D = demi-côté),
 * ses flancs en pente éclairés d'en haut à gauche, le seau d'eau et le sel aux coins.
 */
const DOHYO = 430;
const clayTiles = {};
function dohyo(g, { clay = [201, 164, 107], seed = 1, edge = 26 } = {}) {
  const D = DOHYO, x0 = C - D, x1 = C + D;
  shadowed(g, () => { g.fillStyle = '#8a6a40'; g.fillRect(x0 - edge, x0 - edge, 2 * (D + edge), 2 * (D + edge)); }, { dx: 18, dy: 22, blur: 26 });
  // flancs : haut et gauche au soleil, bas et droite à l'ombre
  const side = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  const o = x0 - edge, f = x1 + edge;
  side([[o, o], [f, o], [x1, x0], [x0, x0]], 'rgb(196,158,102)');
  side([[o, o], [x0, x0], [x0, x1], [o, f]], 'rgb(178,141,90)');
  side([[o, f], [x0, x1], [x1, x1], [f, f]], 'rgb(128,98,60)');
  side([[f, o], [f, f], [x1, x1], [x1, x0]], 'rgb(140,108,66)');
  // le dessus : terre battue, légèrement usée au centre
  const key = clay.join() + '|' + seed;
  const tile = clayTiles[key] || (clayTiles[key] = textureTile(256, seed, (n, m, x, y, r) => {
    const k = 0.9 + n * 0.14 + m * 0.06 + (r - 0.5) * 0.05;
    return [clay[0] * k, clay[1] * k, clay[2] * k];
  }, { cells: 3, fine: 32 }));
  g.save();
  fillTile(g, tile, 200, x0, x0, x1, x1);
  const wear = g.createRadialGradient(C, C, 40, C, C, D * 1.2);
  wear.addColorStop(0, 'rgba(255,240,210,.18)'); wear.addColorStop(1, 'rgba(90,60,30,.18)');
  g.fillStyle = wear; g.fillRect(x0, x0, 2 * D, 2 * D);
  g.restore();
  // seaux d'eau (chikara-mizu) et paniers de sel aux coins est et ouest
  for (const [x, y] of [[x0 + 46, x0 + 46], [x1 - 46, x0 + 46]]) {
    shadowed(g, () => { g.fillStyle = '#7a5530'; g.beginPath(); g.arc(x, y, 20, 0, TAU); g.fill(); }, { dx: 5, dy: 6, blur: 6 });
    g.fillStyle = '#5d8fb0'; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
    g.strokeStyle = '#3d2a18'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 20, 0, TAU); g.stroke();
  }
  for (const [x, y] of [[x0 + 46, x1 - 46], [x1 - 46, x1 - 46]]) {
    shadowed(g, () => { g.fillStyle = '#a9875a'; g.fillRect(x - 18, y - 18, 36, 36); }, { dx: 5, dy: 6, blur: 6 });
    g.fillStyle = '#f6f3ea'; g.beginPath(); g.ellipse(x, y, 13, 11, 0, 0, TAU); g.fill();
  }
}

/** Remplit toute la zone avec une tuile qui représente `world` unités du monde (net même en zoomé). */
function fillTile(g, tile, world, x0, y0, x1, y1, ox = 0, oy = 0) {
  const p = g.createPattern(tile, 'repeat');
  p.setTransform(new DOMMatrix().translate(ox, oy).scale(world / tile.width));
  g.fillStyle = p; g.fillRect(x0, y0, x1 - x0, y1 - y0);
}

function subPoly(g, pts) { pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
function poly(g, pts) { g.beginPath(); subPoly(g, pts); }

/**
 * Toit vu de dessus, centré en (cx, cy) : en croupe (« hip », quatre pans) ou à deux pans (« gable »).
 * Le faîtage suit le plus grand côté. La lumière vient d'en haut à gauche : les pans nord et ouest sont
 * clairs, sud et est à l'ombre. pal = [nord, ouest, sud, est].
 * lines : 'tiles' (tuiles rondes), 'seams' (cuivre), 'thatch' (chaume), null.
 */
function roof(g, cx, cy, w, h, { kind = 'hip', pal, ridge = '#2b2a2a', lines = 'tiles', lineA = 0.22, step = 14, seed = 1, rim = null, rimW = 0, shadow = 34, ridgeW = 14 } = {}) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, horiz = w >= h;
  const hr = (horiz ? h : w) / 2;
  shadowed(g, () => { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x0, y0, w, h); }, { dx: shadow * 0.8, dy: shadow, blur: shadow * 0.9, color: 'rgba(20,12,6,.5)' });
  let faces;                                      // [points, couleur, sens des lignes ('v' ou 'h'), ligne de faîte]
  if (horiz) {
    const a = kind === 'hip' ? x0 + hr : x0, b = kind === 'hip' ? x1 - hr : x1;
    faces = [
      [[[x0, y0], [x1, y0], [b, cy], [a, cy]], pal[0], 'v', [cx, cy, cx, y0]],
      [[[x0, y1], [x1, y1], [b, cy], [a, cy]], pal[2], 'v', [cx, cy, cx, y1]],
    ];
    if (kind === 'hip') faces.push([[[x0, y0], [a, cy], [x0, y1]], pal[1], 'h', [a, cy, x0, cy]], [[[x1, y0], [b, cy], [x1, y1]], pal[3], 'h', [b, cy, x1, cy]]);
  } else {
    const a = kind === 'hip' ? y0 + hr : y0, b = kind === 'hip' ? y1 - hr : y1;
    faces = [
      [[[x0, y0], [x0, y1], [cx, b], [cx, a]], pal[1], 'h', [cx, cy, x0, cy]],
      [[[x1, y0], [x1, y1], [cx, b], [cx, a]], pal[3], 'h', [cx, cy, x1, cy]],
    ];
    if (kind === 'hip') faces.push([[[x0, y0], [cx, a], [x1, y0]], pal[0], 'v', [cx, a, cx, y0]], [[[x0, y1], [cx, b], [x1, y1]], pal[2], 'v', [cx, b, cx, y1]]);
  }
  const r = rng(seed);
  for (const [pts, col, dir, [rx, ry, ex, ey]] of faces) {
    g.save();
    poly(g, pts); g.fillStyle = col; g.fill(); g.clip();
    if (lines) {
      const s = lines === 'seams' ? step * 2.2 : step;
      if (lines === 'thatch') {
        g.lineWidth = 2;
        for (let i = 0; i < w * h / 90; i++) {
          const x = x0 + r() * w, y = y0 + r() * h, l = 8 + r() * 14;
          g.strokeStyle = r() < 0.5 ? `rgba(40,25,10,${lineA})` : `rgba(255,240,200,${lineA * 0.7})`;
          g.beginPath();
          if (dir === 'v') { g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + l); } else { g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 3); }
          g.stroke();
        }
      } else {
        for (let k = 0; dir === 'v' ? x0 + k * s <= x1 : y0 + k * s <= y1; k++) {
          const p = (dir === 'v' ? x0 : y0) + k * s;
          g.lineWidth = lines === 'tiles' ? s * 0.32 : 2;
          g.strokeStyle = `rgba(0,0,0,${lineA})`;
          g.beginPath();
          if (dir === 'v') { g.moveTo(p, y0); g.lineTo(p, y1); } else { g.moveTo(x0, p); g.lineTo(x1, p); }
          g.stroke();
          if (lines === 'tiles') {
            g.lineWidth = s * 0.14; g.strokeStyle = `rgba(255,255,255,${lineA * 0.55})`;
            g.beginPath();
            if (dir === 'v') { g.moveTo(p + s * 0.36, y0); g.lineTo(p + s * 0.36, y1); } else { g.moveTo(x0, p + s * 0.36); g.lineTo(x1, p + s * 0.36); }
            g.stroke();
          }
        }
      }
    }
    // plus clair près du faîte, plus sombre vers l'avant-toit
    const gr = g.createLinearGradient(rx, ry, ex, ey);
    gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(0.75, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.16)');
    g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    g.restore();
  }
  if (rim) { g.strokeStyle = rim; g.lineWidth = rimW; g.strokeRect(x0 + rimW / 2, y0 + rimW / 2, w - rimW, h - rimW); }
  // arêtes et faîtage
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3;
  for (const [pts] of faces) { poly(g, pts); g.stroke(); }
  if (ridge) {
    g.strokeStyle = ridge; g.lineWidth = ridgeW;
    g.beginPath();
    if (horiz) { const a = kind === 'hip' ? x0 + hr : x0 + 6, b = kind === 'hip' ? x1 - hr : x1 - 6; g.moveTo(a, cy); g.lineTo(b, cy); }
    else { const a = kind === 'hip' ? y0 + hr : y0 + 6, b = kind === 'hip' ? y1 - hr : y1 - 6; g.moveTo(cx, a); g.lineTo(cx, b); }
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = ridgeW * 0.3;
    g.beginPath();
    if (horiz) { const a = kind === 'hip' ? x0 + hr : x0 + 6, b = kind === 'hip' ? x1 - hr : x1 - 6; g.moveTo(a, cy - ridgeW * 0.2); g.lineTo(b, cy - ridgeW * 0.2); }
    else { const a = kind === 'hip' ? y0 + hr : y0 + 6, b = kind === 'hip' ? y1 - hr : y1 - 6; g.moveTo(cx - ridgeW * 0.2, a); g.lineTo(cx - ridgeW * 0.2, b); }
    g.stroke();
  }
  g.lineCap = 'butt';
}

/** Lanterne de pierre (tōrō) vue de dessus : chapeau hexagonal et son bouton. */
function stoneLantern(g, x, y, r = 26, tone = 150) {
  const c = k => `rgb(${tone * k | 0},${tone * k | 0},${(tone * k * 0.96) | 0})`;
  const hex = rr => { const pts = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.26; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return pts; };
  shadowed(g, () => { poly(g, hex(r)); g.fillStyle = c(0.8); g.fill(); }, { dx: 16, dy: 20, blur: 10 });
  const pts = hex(r);
  for (let i = 0; i < 6; i++) {                       // six pans du chapeau, éclairés en haut à gauche
    const a = pts[i], b = pts[(i + 1) % 6], mid = Math.atan2((a[1] + b[1]) / 2 - y, (a[0] + b[0]) / 2 - x);
    const lit = 0.82 + 0.3 * Math.cos(mid - (-2.36));
    poly(g, [[x, y], a, b]); g.fillStyle = c(lit); g.fill();
  }
  g.fillStyle = c(1.05); g.beginPath(); g.arc(x, y, r * 0.28, 0, TAU); g.fill();
  g.fillStyle = c(0.7); g.beginPath(); g.arc(x + 2, y + 2, r * 0.12, 0, TAU); g.fill();
}

/** Places assises le long d'un segment (une rangée), en évitant les zones interdites. */
function seatRow(out, rnd, x0, y0, x1, y1, gap, avoid = () => false, jitter = 6) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(L / gap));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0.5;
    const x = x0 + (x1 - x0) * t + (rnd() - 0.5) * jitter, y = y0 + (y1 - y0) * t + (rnd() - 0.5) * jitter;
    if (avoid(x, y)) continue;
    out.push([Math.round(x), Math.round(y), (rnd() * 16) | 0, Math.round(rnd() * 1000) / 1000]);
  }
}

export { DOHYO, blobPath, subPoly, canopy, dohyo, fillTile, inDisc, inRect, mix, mixRGB, noise, poly, rng, roof, rotated, seatRow, shadowed, speckle, stoneLantern, textureTile };
