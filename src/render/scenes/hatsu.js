/**
 * Village sous la neige (Hatsu basho) : un tournoi de Nouvel An sur la place d'un village de montagne.
 * La neige a été déblayée autour du dohyō et forme des congères ; autour, les fermes aux grands toits
 * de chaume (gasshō) blanchis, des cèdres enneigés, des pins protégés par leurs cordes (yukitsuri),
 * des huttes de neige (kamakura) et des braseros. Une partie du public s'abrite sous des ombrelles.
 */
import { C, TAU } from '../../sim/constants.js';
import { DOHYO, blobPath, canopy, dohyo, fillTile, rng, roof, rotated, shadowed, speckle, textureTile, inDisc, inRect } from './tools.js';

const E0 = C - DOHYO - 26, E1 = C + DOHYO + 26;
const CLEAR = 230;                                  // la place déblayée autour du dohyō
const CEDAR = ['#1d3328', '#274334', '#335642', '#466f55'];
const SNOWROOF = ['#f8fafd', '#f4f7fb', '#b9c5d6', '#c3cee0'];

let L = null;
function layout() {
  if (L) return L;
  const r = rng(1301);
  const houses = [
    { x: -330, y: 360, w: 300, h: 430 }, { x: -320, y: 1060, w: 300, h: 420 },
    { x: 1730, y: 360, w: 300, h: 430 }, { x: 1720, y: 1070, w: 300, h: 410 },
    { x: 330, y: -300, w: 420, h: 280 }, { x: 1100, y: -290, w: 380, h: 270 },
    { x: 340, y: 1720, w: 420, h: 280 }, { x: 1080, y: 1710, w: 380, h: 270 },
    { x: -760, y: 700, w: 300, h: 440 }, { x: 2160, y: 720, w: 300, h: 440 },
  ];
  const trees = [];
  for (const [x, y, R, rope] of [
    [-40, 130, 112, false], [1450, 130, 104, false], [-50, 1290, 116, false], [1460, 1290, 110, false],
    [-560, 120, 140, false], [-560, 1300, 140, false], [1980, 100, 140, false], [1990, 1330, 140, false],
    [720, -420, 150, true], [-120, -260, 130, false], [1560, -260, 130, false], [720, 1830, 150, false], [-120, 1660, 130, true], [1540, 1660, 130, false],
    [-700, 1000, 120, false], [2120, 380, 120, true],
  ]) trees.push({ x, y, r: R, rope });
  const braziers = [[E0 - 120, E0 - 120], [E1 + 120, E0 - 120], [E0 - 120, E1 + 120], [E1 + 120, E1 + 120], [E0 - 175, C], [E1 + 175, C]];
  const kamakura = [[-120, 560, 1.2], [1530, 860, -1.9], [1540, 560, -2.6], [520, 1560, -1.6]];

  // le public debout sur la place, un sur trois sous une ombrelle
  const seats = [];
  const free = (x, y, d) => !seats.some(s => Math.abs(s[0] - x) < d && Math.abs(s[1] - y) < d && Math.hypot(s[0] - x, s[1] - y) < d);
  for (let i = 0; i < 2800; i++) {
    const x = r.range(E0 - CLEAR + 30, E1 + CLEAR - 30), y = r.range(E0 - CLEAR + 30, E1 + CLEAR - 30);
    if (x > E0 - 14 && x < E1 + 14 && y > E0 - 14 && y < E1 + 14) continue;
    if (braziers.some(([bx, by]) => Math.hypot(x - bx, y - by) < 62)) continue;
    const kasa = r() < 0.3;
    if (!free(x, y, kasa ? 66 : 54)) continue;
    seats.push([Math.round(x), Math.round(y), (r() * 16) | 0, Math.round(r() * 1000) / 1000, ...(kasa ? ['kasa'] : [])]);
  }
  // des traces de pas d'une maison à l'autre
  const tracks = [];
  for (const [ax, ay, bx, by] of [[-180, 360, E0 - CLEAR, 420], [-170, 1060, E0 - CLEAR, 1000], [1580, 360, E1 + CLEAR, 420], [1570, 1070, E1 + CLEAR, 1000], [330, -160, 420, E0 - CLEAR], [1100, -155, 1000, E0 - CLEAR], [-120, 600, -330, 575], [700, 1580, 700, E1 + CLEAR]]) {
    const n = Math.round(Math.hypot(bx - ax, by - ay) / 26), a = Math.atan2(by - ay, bx - ax);
    for (let k = 0; k < n; k++) {
      const t = k / n, side = k % 2 ? 1 : -1;
      tracks.push([ax + (bx - ax) * t - Math.sin(a) * side * 9 + (r() - 0.5) * 4, ay + (by - ay) * t + Math.cos(a) * side * 9 + (r() - 0.5) * 4, a]);
    }
  }
  return (L = { houses, trees, braziers, kamakura, seats, tracks, flakes: (r() * 1e6) | 0 });
}

let T = null;
function tiles() {
  if (T) return T;
  T = {
    snow: textureTile(256, 131, (n, m, x, y, r) => {
      const k = Math.min(1, 0.55 + n * 0.55);
      const c = [214 + 38 * k, 222 + 31 * k, 238 + 16 * k];
      const sp = r > 0.985 ? 10 : (r - 0.5) * 5;                     // quelques cristaux qui brillent
      return [c[0] + sp, c[1] + sp, c[2] + sp];
    }, { cells: 4, fine: 28 }),
    slush: textureTile(256, 132, (n, m, x, y, r) => {
      // neige tassée, grise et piétinée, avec des plaques de terre mouillée là où elle a fondu
      const wet = Math.max(0, Math.min(1, (0.42 - n) * 5)) * (0.6 + m * 0.4);
      const k = 0.94 + m * 0.08 + (r - 0.5) * 0.06;
      return [(202 - 60 * wet) * k, (206 - 68 * wet) * k, (214 - 78 * wet) * k];
    }, { cells: 5, fine: 30 }),
  };
  return T;
}

function cleared(g, x0, y0, x1, y1) {
  const t = tiles(), D0 = E0 - CLEAR, D = E1 - E0 + 2 * CLEAR;
  g.save();
  g.beginPath(); g.roundRect(D0, D0, D, D, 120); g.clip();
  fillTile(g, t.slush, 260, x0, y0, x1, y1);
  // ombre bleutée au pied des congères
  g.lineWidth = 60; g.strokeStyle = 'rgba(90,110,150,.22)'; g.beginPath(); g.roundRect(D0, D0, D, D, 120); g.stroke();
  g.restore();
  // la congère : un bourrelet de neige tout autour, éclairé en haut à gauche
  const r = rng(77);
  g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = pass ? '#f7f9fd' : '#b9c6d8';
    g.lineWidth = pass ? 30 : 46;
    g.beginPath(); g.roundRect(D0 - 18 + (pass ? -4 : 6), D0 - 18 + (pass ? -4 : 8), D + 36, D + 36, 136); g.stroke();
  }
  for (let k = 0; k < 90; k++) {                          // des mottes de neige le long du bourrelet
    const side = k % 4, t = r();
    const x = side === 0 ? D0 + t * D : side === 1 ? D0 + D + 18 : side === 2 ? D0 + t * D : D0 - 18;
    const y = side === 0 ? D0 - 18 : side === 2 ? D0 + D + 18 : D0 + t * D;
    if ((side === 1 || side === 3) && Math.abs(y - C) < 80) continue;
    g.fillStyle = '#c3cfe0'; blobPath(g, x + 5, y + 6, 18 + r() * 12, r, 7, 0.2); g.fill();
    g.fillStyle = '#fbfcfe'; blobPath(g, x, y, 16 + r() * 10, r, 7, 0.2); g.fill();
  }
  g.lineCap = 'butt';
  // deux passages pour sortir de la place, à gauche et à droite
  for (const x of [D0 - 30, D0 + D - 30]) { g.save(); g.beginPath(); g.rect(x, C - 70, 60, 140); g.clip(); fillTile(g, t.slush, 260, x, C - 70, x + 60, C + 70); g.restore(); }
}

/** Bûches empilées contre le mur, bouts ronds tournés vers le ciel… et un chapeau de neige. */
function woodpile(g, x, y, w, vertical, r) {
  const n = Math.floor(w / 15);
  g.fillStyle = 'rgba(60,70,100,.3)'; g.fillRect(x + 6, y + 8, vertical ? 34 : w, vertical ? w : 34);
  g.fillStyle = '#5b412a'; g.fillRect(x, y, vertical ? 34 : w, vertical ? w : 34);
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
    const cx = vertical ? x + 9 + j * 16 : x + 8 + i * 15, cy = vertical ? y + 8 + i * 15 : y + 9 + j * 16;
    g.fillStyle = '#b48a5a'; g.beginPath(); g.arc(cx, cy, 6.5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(90,60,30,.6)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let k = 0; k < 5; k++) { const u = r(); blobPath(g, vertical ? x + 17 : x + u * w, vertical ? y + u * w : y + 17, 9 + r() * 6, r, 6, 0.3); g.fill(); }
}

function house(g, h) {
  const { x, y, w, h: hh } = h;
  const rp = rng(x * 7 - y);
  if (w < hh) woodpile(g, x > C ? x - w / 2 - 40 : x + w / 2 + 6, y - hh * 0.3, hh * 0.45, true, rp);
  else woodpile(g, x - w * 0.25, y > C ? y - hh / 2 - 40 : y + hh / 2 + 6, w * 0.45, false, rp);
  shadowed(g, () => { g.fillStyle = '#5a4630'; g.fillRect(x - w / 2, y - hh / 2, w, hh); }, { dx: 56, dy: 70, blur: 40, color: 'rgba(40,50,80,.35)' });
  roof(g, x, y, w, hh, { kind: 'gable', pal: SNOWROOF, ridge: '#ffffff', lines: null, rim: '#5e4630', rimW: 10, shadow: 0, ridgeW: 16 });
  // le bourrelet de neige qui déborde de l'avant-toit, et son ombre bleue
  g.strokeStyle = 'rgba(120,140,175,.5)'; g.lineWidth = 6; g.strokeRect(x - w / 2 + 14, y - hh / 2 + 14, w - 28, hh - 28);
  g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(x - w / 2 + 11, y - hh / 2 + 11, w - 22, hh - 22);
  // le chaume apparaît là où la neige a glissé, et des congères au bas des pans
  const r = rng(x * 3 + y), horiz = w >= hh;
  g.fillStyle = 'rgba(120,92,56,.55)';
  for (let k = 0; k < 7; k++) {
    const u = r(), v = r() < 0.5 ? 0.06 : 0.94;
    const px = horiz ? x - w / 2 + 12 + u * (w - 24) : x - w / 2 + v * w, py = horiz ? y - hh / 2 + v * hh : y - hh / 2 + 12 + u * (hh - 24);
    blobPath(g, px, py, 7 + r() * 8, r, 6, 0.3); g.fill();
  }
  g.strokeStyle = 'rgba(150,170,200,.35)'; g.lineWidth = 3;   // ondulations du manteau neigeux
  for (let k = 0; k < 6; k++) {
    const u = 0.2 + k * 0.12;
    g.beginPath();
    if (horiz) { g.moveTo(x - w / 2 + 20, y - hh / 2 + u * hh * 0.5); g.quadraticCurveTo(x, y - hh / 2 + u * hh * 0.5 + 8, x + w / 2 - 20, y - hh / 2 + u * hh * 0.5); }
    else { g.moveTo(x - w / 2 + u * w * 0.5, y - hh / 2 + 20); g.quadraticCurveTo(x - w / 2 + u * w * 0.5 + 8, y, x - w / 2 + u * w * 0.5, y + hh / 2 - 20); }
    g.stroke();
  }
}

/** Cèdre enneigé : la couronne sombre, puis des plaques de neige du côté éclairé. */
function snowyTree(g, t) {
  const r = rng(t.x * 11 + t.y * 5);
  canopy(g, t.x, t.y, t.r, CEDAR, r, { tufts: 16, shadow: 'rgba(60,80,120,.3)' });
  for (let k = 0; k < 16; k++) {
    const a = r() * TAU, d = Math.sqrt(r()) * t.r * 0.75;
    const sx = t.x + Math.cos(a) * d - t.r * 0.12, sy = t.y + Math.sin(a) * d - t.r * 0.12;
    g.fillStyle = 'rgba(190,205,225,.9)'; blobPath(g, sx + 3, sy + 4, t.r * (0.1 + r() * 0.1), r, 6, 0.3); g.fill();
    g.fillStyle = '#f7f9fd'; blobPath(g, sx, sy, t.r * (0.09 + r() * 0.09), r, 6, 0.3); g.fill();
  }
  if (t.rope) {                                             // yukitsuri : cordes tendues depuis un mât central
    g.strokeStyle = 'rgba(210,190,140,.85)'; g.lineWidth = 2;
    g.beginPath();
    for (let k = 0; k < 28; k++) { const a = k / 28 * TAU; g.moveTo(t.x, t.y); g.lineTo(t.x + Math.cos(a) * t.r * 1.08, t.y + Math.sin(a) * t.r * 1.08); }
    g.stroke();
    g.fillStyle = '#7a5a34'; g.beginPath(); g.arc(t.x, t.y, 9, 0, TAU); g.fill();
    g.fillStyle = '#f7f9fd'; g.beginPath(); g.arc(t.x - 2, t.y - 2, 5, 0, TAU); g.fill();
  }
}

/** Hutte de neige (kamakura) : un dôme éclairé en haut à gauche, l'entrée tournée vers la place. */
function kamakura(g, x, y, a) {
  const R = 64;
  g.fillStyle = 'rgba(80,100,140,.3)'; g.beginPath(); g.ellipse(x + 20, y + 26, R, R * 0.95, 0, 0, TAU); g.fill();
  const gr = g.createRadialGradient(x - R * 0.35, y - R * 0.4, 6, x, y, R);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#e3e9f3'); gr.addColorStop(1, '#b7c4d8');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
  rotated(g, x, y, a, () => {                               // l'entrée, et la lueur de la bougie à l'intérieur
    g.fillStyle = '#3a3440'; g.beginPath(); g.ellipse(R - 6, 0, 16, 24, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,170,80,.75)'; g.beginPath(); g.ellipse(R - 8, 0, 9, 15, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,190,110,.25)'; g.beginPath(); g.ellipse(R + 22, 0, 30, 30, 0, 0, TAU); g.fill();
  });
}

function brazier(g, x, y) {
  shadowed(g, () => { g.fillStyle = '#2a2622'; g.beginPath(); g.arc(x, y, 26, 0, TAU); g.fill(); }, { dx: 6, dy: 8, blur: 8 });
  g.strokeStyle = '#4a433c'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 24, 0, TAU); g.stroke();
  const gr = g.createRadialGradient(x - 3, y - 3, 2, x, y, 20);
  gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.4, '#ff9a30'); gr.addColorStop(1, '#a8321a');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, 19, 0, TAU); g.fill();
  const r = rng(x + y);
  for (let k = 0; k < 7; k++) { g.fillStyle = 'rgba(40,20,10,.6)'; g.fillRect(x - 14 + r() * 24, y - 14 + r() * 24, 6, 3); }   // bûches
  // le cercle de neige fondue autour
  g.strokeStyle = 'rgba(120,110,100,.35)'; g.lineWidth = 10; g.beginPath(); g.arc(x, y, 40, 0, TAU); g.stroke();
}

function snowman(g, x, y) {
  for (const [dx, dy, R] of [[0, 0, 30], [-14, -26, 21]]) {
    g.fillStyle = 'rgba(80,100,140,.3)'; g.beginPath(); g.arc(x + dx + 8, y + dy + 10, R, 0, TAU); g.fill();
    const gr = g.createRadialGradient(x + dx - R * 0.4, y + dy - R * 0.4, 2, x + dx, y + dy, R);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c9d4e4');
    g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y + dy, R, 0, TAU); g.fill();
  }
  g.fillStyle = '#b8322f'; g.beginPath(); g.arc(x - 16, y - 30, 11, 0, TAU); g.fill();   // un seau rouge en chapeau
  g.fillStyle = '#222'; g.beginPath(); g.arc(x - 8, y - 20, 2.5, 0, TAU); g.arc(x - 18, y - 16, 2.5, 0, TAU); g.fill();
}

function paint(g, x0, y0, x1, y1) {
  const Lt = layout(), t = tiles();
  fillTile(g, t.snow, 340, x0, y0, x1, y1);
  for (const [x, y, a] of Lt.tracks) {                     // empreintes dans la neige
    rotated(g, x, y, a, () => { g.fillStyle = 'rgba(140,160,195,.45)'; g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, TAU); g.fill(); });
  }
  cleared(g, x0, y0, x1, y1);
  for (const h of Lt.houses) house(g, h);
  for (const [x, y, a] of Lt.kamakura) kamakura(g, x, y, a);
  snowman(g, -150, 820);
  snowman(g, 1580, 1250);
  for (const [x, y] of Lt.braziers) brazier(g, x, y);
  dohyo(g, { clay: [190, 156, 108], seed: 9 });
  // un peu de neige poussée par le vent dans les coins du dohyō
  const r = rng(Lt.flakes);
  for (const [cx, cy] of [[E0, E0], [E1, E0], [E0, E1], [E1, E1]]) {
    g.fillStyle = '#c3cfe0'; blobPath(g, cx + 4, cy + 5, 34, r, 8, 0.25); g.fill();
    g.fillStyle = '#f7f9fd'; blobPath(g, cx, cy, 30, r, 8, 0.25); g.fill();
  }
  speckle(g, r, 220, ['rgba(255,255,255,.7)'], inRect(E0, E0, E1, E1), [1.5, 3], false);
  for (const tr of Lt.trees) snowyTree(g, tr);
}

/** Les braseros vacillent et réchauffent la neige autour d'eux. */
function under(g, rect, t) {
  const Lt = layout();
  for (const [x, y] of Lt.braziers) {
    if (x < rect.x0 - 200 || x > rect.x1 + 200 || y < rect.y0 - 200 || y > rect.y1 + 200) continue;
    const fl = 0.8 + 0.2 * Math.sin(t * 9 + x) * Math.sin(t * 5.7 + y);
    const gr = g.createRadialGradient(x, y, 10, x, y, 150);
    gr.addColorStop(0, `rgba(255,160,70,${0.32 * fl})`); gr.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = gr; g.fillRect(x - 150, y - 150, 300, 300);
  }
}

export default {
  id: 'hatsu', base: '#e6ecf5', paint, under, seats: () => layout().seats,
  fx: 'yuki', count: 170,
  vignette: { rgb: '40,50,80', a: [0, 0.08, 0.3] },
};
