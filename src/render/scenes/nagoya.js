/**
 * Matsuri d'été (Nagoya basho) : un tournoi de nuit au milieu d'une fête de quartier. Le public se
 * tient debout autour du dohyō, sous des guirlandes de lanternes ; autour, les échoppes (yatai) aux
 * auvents rayés, la tour des tambours (yagura) à gauche, le palanquin sacré (mikoshi) à droite.
 */
import { C, TAU } from '../../sim/constants.js';
import { DOHYO, blobPath, canopy, dohyo, fillTile, poly, rng, rotated, shadowed, speckle, textureTile, inRect } from './tools.js';

const E0 = C - DOHYO - 26, E1 = C + DOHYO + 26;
const LANE = [C - 70, C + 70];                    // passages libres à gauche et à droite (yagura, mikoshi)
const POLE = 210;                                 // les mâts des guirlandes, à cette distance du dohyō
const AWNINGS = [['#c8322f', '#f4efe4'], ['#2f5f9e', '#f4efe4'], ['#2f7d55', '#f4efe4'], ['#d77a1f', '#f6eedc'], ['#7a3b8f', '#f4efe4']];
const GOODS = ['takoyaki', 'ringo', 'omen', 'kakigori', 'kingyo', 'yakisoba', 'yoyo'];
const TREE = ['#1d3326', '#264430', '#31553a', '#43704a'];

let L = null;
function layout() {
  if (L) return L;
  const r = rng(7303);
  const stalls = [];
  // une colonne ou une rangée d'échoppes ; face : où regarde le comptoir
  const run = (fixed, a, b, face, vertical, skip) => {
    let p = a;
    while (p < b) {
      const w = 132 + r() * 30;
      if (p + w > b) break;
      const mid = p + w / 2;
      if (!skip || mid < skip[0] || mid > skip[1]) {
        stalls.push({ x: vertical ? fixed : mid, y: vertical ? mid : fixed, w, d: 150, face, pal: r.pick(AWNINGS), goods: r.pick(GOODS), seed: (r() * 1e6) | 0 });
      }
      p += w + 14;
    }
  };
  const xin = E0 - POLE - 120, xout = E1 + POLE + 120;      // centres des colonnes intérieures
  run(xin, -40, 1460, 'r', true, [LANE[0] - 160, LANE[1] + 160]);
  run(xin - 176, -300, 1720, 'l', true, [LANE[0] - 130, LANE[1] + 130]);   // dos à dos : la rue suivante
  run(xout, -40, 1460, 'l', true, [LANE[0] - 160, LANE[1] + 160]);
  run(xout + 176, -300, 1720, 'r', true, [LANE[0] - 130, LANE[1] + 130]);
  run(E0 - POLE - 120, E0 - 40, E1 + 40, 'd', false, null);  // en haut et en bas (écrans en hauteur)
  run(E1 + POLE + 120, E0 - 40, E1 + 40, 'u', false, null);
  run(xin - 520, -300, 1720, 'r', true, null);              // tout au bord, pour les écrans très larges
  run(xout + 520, -300, 1720, 'l', true, null);

  const yag = [E0 - POLE - 150, C], mik = [E1 + POLE + 140, C];
  // le public debout : un semis serré autour du dohyō, plus clairsemé devant les échoppes
  const seats = [];
  const free = (x, y, d) => !seats.some(s => Math.abs(s[0] - x) < d && Math.abs(s[1] - y) < d && Math.hypot(s[0] - x, s[1] - y) < d);
  const inLane = (x, y) => y > LANE[0] - 30 && y < LANE[1] + 30 && (x < E0 || x > E1);
  for (let i = 0; i < 2600; i++) {
    const x = r.range(E0 - 196, E1 + 196), y = r.range(E0 - 196, E1 + 196);
    if (x > E0 - 12 && x < E1 + 12 && y > E0 - 12 && y < E1 + 12) continue;
    if (inLane(x, y) || !free(x, y, 52)) continue;
    seats.push([Math.round(x), Math.round(y), (r() * 16) | 0, Math.round(r() * 1000) / 1000]);
  }
  for (const s of stalls) {                                  // des clients devant chaque comptoir
    const [fx, fy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[s.face];
    for (let k = 0; k < 3; k++) {
      if (r() < 0.35) continue;
      const along = (k - 1) * 46 + (r() - 0.5) * 10, out = s.d / 2 + 38 + r() * 26;
      const x = s.x + fx * out + (fy ? along : 0) * 1, y = s.y + fy * out + (fx ? along : 0);
      if (free(x, y, 50) && !(x > E0 - 220 && x < E1 + 220 && y > E0 - 220 && y < E1 + 220)) seats.push([Math.round(x), Math.round(y), (r() * 16) | 0, Math.round(r() * 1000) / 1000]);
    }
  }
  // dans les rues : des promeneurs
  for (let i = 0; i < 900; i++) {
    const x = r.range(-900, 2300), y = r.range(-500, 1900);
    if (x > E0 - 240 && x < E1 + 240 && y > E0 - 240 && y < E1 + 240) continue;
    if (stalls.some(s => Math.abs(s.x - x) < (s.face === 'u' || s.face === 'd' ? s.w : s.d) / 2 + 30 && Math.abs(s.y - y) < (s.face === 'u' || s.face === 'd' ? s.d : s.w) / 2 + 30)) continue;
    if (Math.abs(y - C) < 230 && (Math.abs(x - yag[0]) < 260 || Math.abs(x - mik[0]) < 260)) continue;
    if (r() < 0.6 || !free(x, y, 60)) continue;
    seats.push([Math.round(x), Math.round(y), (r() * 16) | 0, Math.round(r() * 1000) / 1000]);
  }
  // les mâts et leurs guirlandes : un carré autour du public
  const p0 = E0 - POLE + 2, p1 = E1 + POLE - 2;
  const poles = [[p0, p0], [C, p0], [p1, p0], [p1, C], [p1, p1], [C, p1], [p0, p1], [p0, C]];
  const strings = poles.map((p, i) => [p, poles[(i + 1) % poles.length]]);
  // tonneaux de saké empilés derrière la yagura et le mikoshi (kazaridaru)
  const barrels = [];
  for (const bx of [yag[0] - 190, mik[0] + 190]) for (let i = 0; i < 2; i++) for (let j = 0; j < 5; j++) barrels.push([bx + (i - 0.5) * 70, C + (j - 2) * 64, (r() * 4) | 0]);
  const trees = [[-150, -170, 130], [1560, -170, 130], [-150, 1580, 130], [1560, 1580, 130], [-640, 704, 150], [2050, 704, 150]];
  return (L = { stalls, seats, poles, strings, yag, mik, trees, barrels, ground: (r() * 1e6) | 0 });
}

let T = null;
function tiles() {
  if (T) return T;
  T = {
    stone: flagstones(),
  };
  return T;
}

/** Dalles de pierre irrégulières sur une tuile qui se répète (rangées de hauteurs et longueurs variées). */
function flagstones() {
  const S = 512, c = textureTile(S, 78, (n, m, x, y, r) => { const k = 0.84 + n * 0.14 + m * 0.1 + (r - 0.5) * 0.1; return [150 * k, 140 * k, 124 * k]; }, { cells: 4, fine: 40 });
  const g = c.getContext('2d'), r = rng(79);
  const rows = [0, 92, 170, 264, 344, 430, 512];
  for (let j = 0; j < rows.length - 1; j++) {
    const ya = rows[j], yb = rows[j + 1];
    let x = -r() * 60;
    while (x < S) {
      const l = 70 + r() * 90, xb = Math.min(S, x + l);
      g.fillStyle = `rgba(${r() < 0.5 ? '255,245,225' : '30,25,20'},${0.03 + r() * 0.08})`;
      g.fillRect(Math.max(0, x), ya, xb - Math.max(0, x), yb - ya);
      g.fillStyle = 'rgba(255,250,235,.16)'; g.fillRect(Math.max(0, x) + 3, ya + 3, xb - Math.max(0, x) - 6, 3);
      g.fillStyle = 'rgba(40,32,26,.55)'; if (x > 0) g.fillRect(x - 2, ya, 4, yb - ya);
      x += l;
    }
    g.fillStyle = 'rgba(40,32,26,.55)'; g.fillRect(0, ya - 2, S, 4);
  }
  return c;
}

/** Tonneau de saké vu de dessus : couvercle de bois, paille tressée, une bande peinte. */
function barrel(g, x, y, k) {
  shadowed(g, () => { g.fillStyle = '#d9c9a0'; g.beginPath(); g.arc(x, y, 31, 0, TAU); g.fill(); }, { dx: 6, dy: 8, blur: 6 });
  g.strokeStyle = 'rgba(120,96,56,.6)'; g.lineWidth = 1.5;
  for (let a = 0; a < TAU; a += TAU / 28) { g.beginPath(); g.moveTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); g.lineTo(x + Math.cos(a) * 31, y + Math.sin(a) * 31); g.stroke(); }
  g.strokeStyle = ['#c8322f', '#2f5f9e', '#1d1d1d', '#2f7d55'][k]; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 27, -0.9, 0.9); g.stroke();
  g.fillStyle = '#b8935c'; g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(90,60,30,.5)'; g.lineWidth = 1.5; for (let d = -14; d <= 14; d += 7) { g.beginPath(); g.moveTo(x + d, y - Math.sqrt(484 - d * d)); g.lineTo(x + d, y + Math.sqrt(484 - d * d)); g.stroke(); }
}

const ANG = { r: -Math.PI / 2, l: Math.PI / 2, d: 0, u: Math.PI };

/** Une échoppe : auvent rayé, lambrequin festonné, comptoir avec sa marchandise. Repère local : le comptoir en bas. */
function stall(g, s) {
  rotated(g, s.x, s.y, ANG[s.face], () => {
    const r = rng(s.seed), w = s.w, d = s.d, x0 = -w / 2, y0 = -d / 2, front = d / 2, cnt = 40, aw = front - cnt;
    shadowed(g, () => { g.fillStyle = '#3a2a1c'; g.fillRect(x0, y0, w, d); }, { dx: 8, dy: 10, blur: 6, color: 'rgba(20,12,6,.35)' });
    // le comptoir et la marchandise
    g.fillStyle = '#8a6440'; g.fillRect(x0, aw, w, cnt);
    g.fillStyle = 'rgba(255,230,190,.2)'; g.fillRect(x0, aw, w, 3);
    goods(g, s.goods, x0 + 8, aw + 6, w - 16, cnt - 12, r);
    // l'auvent rayé
    const n = 7, sw = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = s.pal[i % 2]; g.fillRect(x0 + i * sw, y0, sw + 0.5, aw - y0); }
    const sh = g.createLinearGradient(0, y0, 0, aw);
    sh.addColorStop(0, 'rgba(0,0,0,.22)'); sh.addColorStop(0.5, 'rgba(255,255,255,.06)'); sh.addColorStop(1, 'rgba(0,0,0,.1)');
    g.fillStyle = sh; g.fillRect(x0, y0, w, aw - y0);
    g.fillStyle = s.pal[0];                                  // lambrequin festonné au bord de l'auvent
    g.beginPath(); g.moveTo(x0, aw);
    for (let i = 0; i < n * 2; i++) g.arc(x0 + (i + 0.5) * sw / 2, aw, sw / 4, Math.PI, 0, true);
    g.lineTo(x0 + w, aw - 4); g.lineTo(x0, aw - 4); g.closePath(); g.fill();
    // l'enseigne : une bande et son emblème
    g.fillStyle = '#f7f1e3'; g.fillRect(-26, aw - 30, 52, 20);
    g.fillStyle = s.pal[0]; g.beginPath(); g.arc(0, aw - 20, 7, 0, TAU); g.fill();
    // lampe nue au-dessus du comptoir
    g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(-w * 0.25, aw + 4, 5, 0, TAU); g.arc(w * 0.25, aw + 4, 5, 0, TAU); g.fill();
  });
}

function goods(g, kind, x, y, w, h, r) {
  if (kind === 'takoyaki' || kind === 'yakisoba') {
    g.fillStyle = '#2b2622'; g.fillRect(x, y, w, h);
    if (kind === 'takoyaki') {
      for (let i = 0; i < Math.floor(w / 13); i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = '#c47a34'; g.beginPath(); g.arc(x + 8 + i * 13, y + 7 + j * 13, 5, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,220,160,.5)'; g.beginPath(); g.arc(x + 7 + i * 13, y + 6 + j * 13, 2, 0, TAU); g.fill();
      }
    } else {
      g.strokeStyle = '#b8803c'; g.lineWidth = 2.5;
      for (let i = 0; i < 26; i++) { const sx = x + r() * w, sy = y + r() * h; g.beginPath(); g.moveTo(sx, sy); g.bezierCurveTo(sx + 8, sy - 6, sx + 10, sy + 8, sx + 18, sy + 2); g.stroke(); }
      g.fillStyle = '#4f8f3a'; for (let i = 0; i < 10; i++) g.fillRect(x + r() * w, y + r() * h, 4, 3);
    }
  } else if (kind === 'ringo') {
    for (let i = 0; i < Math.floor(w / 14); i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = '#b3171f'; g.beginPath(); g.arc(x + 8 + i * 14, y + 7 + j * 13, 6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x + 6 + i * 14, y + 5 + j * 13, 2, 0, TAU); g.fill();
    }
  } else if (kind === 'omen') {
    for (let i = 0; i < Math.floor(w / 18); i++) {
      g.fillStyle = r.pick(['#f6f0e6', '#f2c14e', '#e98aa6', '#9fd3e6', '#e8e1d0']);
      g.beginPath(); g.ellipse(x + 9 + i * 18, y + h / 2, 7, 10, 0, 0, TAU); g.fill();
      g.fillStyle = '#222'; g.fillRect(x + 6 + i * 18, y + h / 2 - 3, 2, 2); g.fillRect(x + 11 + i * 18, y + h / 2 - 3, 2, 2);
      g.fillStyle = '#c33'; g.fillRect(x + 8 + i * 18, y + h / 2 + 3, 3, 2);
    }
  } else if (kind === 'kakigori') {
    for (let i = 0; i < Math.floor(w / 16); i++) {
      g.fillStyle = '#f4f7fa'; g.beginPath(); g.arc(x + 8 + i * 16, y + h / 2, 7, 0, TAU); g.fill();
      g.fillStyle = r.pick(['#e2394a', '#3b86d1', '#53b36a', '#f2c94c']); g.beginPath(); g.arc(x + 8 + i * 16, y + h / 2, 4.5, 0, TAU); g.fill();
    }
  } else {                                                   // bassin : poissons rouges ou ballons d'eau
    const wg = g.createLinearGradient(x, y, x + w, y + h);
    wg.addColorStop(0, '#4fa3c7'); wg.addColorStop(1, '#2d6f9a');
    g.fillStyle = '#d8dde0'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = wg; g.fillRect(x, y, w, h);
    for (let i = 0; i < (kind === 'kingyo' ? 12 : 8); i++) {
      const fx = x + 6 + r() * (w - 12), fy = y + 5 + r() * (h - 10);
      if (kind === 'kingyo') {
        g.fillStyle = r() < 0.75 ? '#ff6a1f' : '#f4f1ea';
        rotated(g, fx, fy, r() * TAU, () => { g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-4, 0); g.lineTo(-9, -3); g.lineTo(-9, 3); g.fill(); });
      } else {
        g.fillStyle = r.pick(['#ff5d8f', '#ffd23f', '#3bceac', '#6c8cff', '#ff8c42']); g.beginPath(); g.arc(fx, fy, 6, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.beginPath(); g.arc(fx, fy, 3.5, 0, Math.PI); g.stroke();
      }
    }
  }
}

/** La tour des tambours : plancher, rideau rouge et blanc (kōhaku) sur le pourtour, le grand taiko. */
function yagura(g, x, y) {
  const s = 210, h = s / 2;
  shadowed(g, () => { g.fillStyle = '#3a2a1c'; g.fillRect(x - h, y - h, s, s); }, { dx: 30, dy: 38, blur: 16, color: 'rgba(10,6,4,.42)' });
  g.fillStyle = '#9a7650'; g.fillRect(x - h, y - h, s, s);
  g.strokeStyle = 'rgba(60,40,22,.45)'; g.lineWidth = 2;
  for (let k = 1; k < 10; k++) { g.beginPath(); g.moveTo(x - h, y - h + k * s / 10); g.lineTo(x + h, y - h + k * s / 10); g.stroke(); }
  const band = 16;                                          // le rideau à rayures verticales, vu par le dessus
  for (const side of [0, 1, 2, 3]) {
    rotated(g, x, y, side * Math.PI / 2, () => {
      for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#f4efe4' : '#c8322f'; g.fillRect(-h + i * s / 14, -h, s / 14 + 0.5, band); }
    });
  }
  for (const [cx, cy] of [[x - h, y - h], [x + h, y - h], [x - h, y + h], [x + h, y + h]]) { g.fillStyle = '#5a3d24'; g.fillRect(cx - 9, cy - 9, 18, 18); }
  // le taiko sur son support
  g.fillStyle = '#3d2614'; g.fillRect(x - 58, y - 16, 116, 32);
  shadowed(g, () => { g.fillStyle = '#7a3e1d'; g.beginPath(); g.arc(x, y, 52, 0, TAU); g.fill(); }, { dx: 6, dy: 8, blur: 8 });
  g.fillStyle = '#e9dcc0'; g.beginPath(); g.arc(x, y, 42, 0, TAU); g.fill();
  g.fillStyle = 'rgba(160,120,70,.25)'; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill();
  g.fillStyle = '#2a1c10';
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 47, y + Math.sin(a) * 47, 2.2, 0, TAU); g.fill(); }
  g.strokeStyle = '#c8322f'; g.lineWidth = 3;                // le tomoe peint, en trois virgules
  for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 10, a, a + 2.4); g.stroke(); }
}

/** Le palanquin sacré, posé sur ses tréteaux : toit laqué noir, arêtes dorées, phénix au sommet. */
function mikoshi(g, x, y) {
  g.lineCap = 'round';
  for (const dx of [-46, 46]) {                              // les deux longs brancards
    g.strokeStyle = 'rgba(10,6,4,.4)'; g.lineWidth = 16; g.beginPath(); g.moveTo(x + dx + 10, y - 170 + 12); g.lineTo(x + dx + 10, y + 170 + 12); g.stroke();
    g.strokeStyle = '#d8c7a0'; g.lineWidth = 14; g.beginPath(); g.moveTo(x + dx, y - 170); g.lineTo(x + dx, y + 170); g.stroke();
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 15; g.beginPath(); g.moveTo(x + dx, y - 172); g.lineTo(x + dx, y - 160); g.moveTo(x + dx, y + 160); g.lineTo(x + dx, y + 172); g.stroke();
  }
  g.strokeStyle = '#d8c7a0'; g.lineWidth = 10;
  for (const dy of [-110, 110]) { g.beginPath(); g.moveTo(x - 70, y + dy); g.lineTo(x + 70, y + dy); g.stroke(); }
  g.lineCap = 'butt';
  const s = 64;
  shadowed(g, () => { g.fillStyle = '#121010'; g.fillRect(x - s, y - s, 2 * s, 2 * s); }, { dx: 18, dy: 22, blur: 16 });
  for (const [pts, col] of [
    [[[x - s, y - s], [x + s, y - s], [x, y]], '#2c2826'], [[[x - s, y - s], [x - s, y + s], [x, y]], '#24201e'],
    [[[x - s, y + s], [x + s, y + s], [x, y]], '#141110'], [[[x + s, y - s], [x + s, y + s], [x, y]], '#181514'],
  ]) { poly(g, pts); g.fillStyle = col; g.fill(); }
  g.strokeStyle = '#d9a93a'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke();
  g.lineWidth = 4; g.strokeRect(x - s + 2, y - s + 2, 2 * s - 4, 2 * s - 4);
  for (const [cx, cy] of [[x - s, y - s], [x + s, y - s], [x - s, y + s], [x + s, y + s]]) { g.fillStyle = '#f0c75a'; g.beginPath(); g.arc(cx, cy, 6, 0, TAU); g.fill(); }
  g.fillStyle = '#e8b84a';                                    // le phénix doré, ailes déployées
  g.beginPath(); g.ellipse(x, y, 7, 16, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(x, y - 2); g.quadraticCurveTo(x - 30, y - 18, x - 34, y + 4); g.quadraticCurveTo(x - 16, y - 2, x, y + 6); g.fill();
  g.beginPath(); g.moveTo(x, y - 2); g.quadraticCurveTo(x + 30, y - 18, x + 34, y + 4); g.quadraticCurveTo(x + 16, y - 2, x, y + 6); g.fill();
  g.fillStyle = '#fff1b8'; g.beginPath(); g.arc(x, y - 12, 4, 0, TAU); g.fill();
}

function paint(g, x0, y0, x1, y1) {
  const Lt = layout(), t = tiles();
  fillTile(g, t.stone, 400, x0, y0, x1, y1);
  const r = rng(Lt.ground);
  // papiers, brochettes, éventails tombés
  speckle(g, r, Math.round((x1 - x0) * (y1 - y0) / 9000), ['rgba(250,245,230,.6)', 'rgba(120,90,60,.35)', 'rgba(210,70,60,.45)'], inRect(x0, y0, x1, y1), [2, 4.5]);
  for (const s of Lt.stalls) stall(g, s);
  for (const [x, y, k] of Lt.barrels) barrel(g, x, y, k);
  dohyo(g, { clay: [196, 160, 108], seed: 5 });
  yagura(g, ...Lt.yag);
  mikoshi(g, ...Lt.mik);
  for (const [x, y] of Lt.poles) {                          // pieds des mâts
    g.fillStyle = 'rgba(10,6,4,.35)'; g.beginPath(); g.arc(x + 8, y + 10, 10, 0, TAU); g.fill();
    g.fillStyle = '#5a412a'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
  }
  for (const [x, y, R] of Lt.trees) canopy(g, x, y, R, TREE, rng(x * 7 + y), { tufts: 16 });
}

// --- La nuit : pénombre, lueurs des échoppes, guirlandes de lanternes ---
function lantern(g, x, y, k, col) {
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, 9 * k, 11 * k, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,236,170,.85)'; g.beginPath(); g.ellipse(x - 2 * k, y - 2 * k, 4 * k, 5 * k, 0, 0, TAU); g.fill();
  g.fillStyle = '#1b1410'; g.fillRect(x - 6 * k, y - 12 * k, 12 * k, 3 * k); g.fillRect(x - 6 * k, y + 9 * k, 12 * k, 3 * k);
}
function stringPath(a, b) {                                 // la guirlande s'affaisse un peu vers l'extérieur
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = mx - C, dy = my - C, d = Math.hypot(dx, dy) || 1;
  return [a, [mx + dx / d * 26, my + dy / d * 26], b];
}
/**
 * Le calque de nuit, dessiné sur un canevas transparent : une pénombre bleue partout, percée là où
 * tombe la lumière (le dohyō sous les projecteurs, les comptoirs, les lanternes), puis un voile chaud
 * sur les zones éclairées, les guirlandes et les lanternes elles-mêmes.
 */
function drawNight(g, x0, y0, x1, y1) {
  const Lt = layout();
  const vis = (x, y, rad) => !(x + rad < x0 || x - rad > x1 || y + rad < y0 || y - rad > y1);
  const radial = (x, y, rad, stops) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    for (const [k, c] of stops) gr.addColorStop(k, c);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  };
  const hung = [], lan = [];
  for (const s of Lt.stalls) {                               // deux lanternes au bord de chaque auvent
    const [fx, fy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[s.face];
    for (const k of [-0.3, 0.3]) hung.push([s.x + fx * (s.d / 2 - 44) + (fy ? k * s.w : 0), s.y + fy * (s.d / 2 - 44) + (fx ? k * s.w : 0)]);
  }
  for (const [a, b] of Lt.strings) {
    const [p, m, q] = stringPath(a, b), n = Math.max(2, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 46));
    for (let i = 1; i < n; i++) {
      const t = i / n, u = 1 - t;
      lan.push([u * u * p[0] + 2 * u * t * m[0] + t * t * q[0], u * u * p[1] + 2 * u * t * m[1] + t * t * q[1], i]);
    }
  }
  g.fillStyle = 'rgba(10,12,42,.8)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.save();
  g.globalCompositeOperation = 'destination-out';            // la lumière efface la pénombre
  const hole = (x, y, rad, a) => { if (vis(x, y, rad)) radial(x, y, rad, [[0, `rgba(0,0,0,${a})`], [1, 'rgba(0,0,0,0)']]); };
  radial(C, C, 940, [[0, 'rgba(0,0,0,.95)'], [0.5, 'rgba(0,0,0,.86)'], [0.72, 'rgba(0,0,0,.38)'], [1, 'rgba(0,0,0,0)']]);
  for (const s of Lt.stalls) { const [fx, fy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[s.face]; hole(s.x + fx * s.d * 0.32, s.y + fy * s.d * 0.32, 130, 0.62); }
  for (const [x, y] of hung) hole(x, y, 56, 0.4);
  for (const [x, y] of lan) hole(x, y, 50, 0.32);
  hole(Lt.yag[0], Lt.yag[1], 190, 0.62);
  hole(Lt.mik[0], Lt.mik[1], 170, 0.6);
  g.restore();
  // un voile chaud sur ce qui est éclairé par les flammes
  const warm = (x, y, rad, a) => { if (vis(x, y, rad)) radial(x, y, rad, [[0, `rgba(255,160,80,${a})`], [1, 'rgba(255,160,80,0)']]); };
  for (const s of Lt.stalls) { const [fx, fy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[s.face]; warm(s.x + fx * s.d * 0.45, s.y + fy * s.d * 0.45, 150, 0.14); }
  warm(Lt.yag[0], Lt.yag[1], 220, 0.12);
  for (const [x, y] of [...lan, ...hung]) warm(x, y, 30, 0.3);
  g.strokeStyle = 'rgba(20,14,10,.8)'; g.lineWidth = 2.5;   // les cordes
  for (const [a, b] of Lt.strings) { const [p, m, q] = stringPath(a, b); g.beginPath(); g.moveTo(...p); g.quadraticCurveTo(...m, ...q); g.stroke(); }
  for (const [x, y, i] of lan) lantern(g, x, y, 1, i % 3 === 1 ? '#f2ede0' : '#d8392c');
  for (const [x, y] of Lt.poles) lantern(g, x, y, 1.5, '#d8392c');
  for (const [x, y] of hung) lantern(g, x, y, 1.25, '#d8392c');
  const [yx, yy] = Lt.yag;                                   // lanternes aux coins de la yagura
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lantern(g, yx + dx * 112, yy + dy * 112, 1.4, '#f2ede0');
}
function nightLayer(x0, y0, x1, y1, s, c = document.createElement('canvas')) {
  c.width = Math.ceil((x1 - x0) * s); c.height = Math.ceil((y1 - y0) * s);
  const cg = c.getContext('2d');
  cg.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
  drawNight(cg, x0, y0, x1, y1);
  return c;
}
let night = null;                                            // calque de la vue principale, mis en cache
function under(g, rect, t) {
  const { x0, y0, x1, y1 } = rect;
  if (!rect.s) { g.drawImage(nightLayer(x0, y0, x1, y1, g.getTransform().a), x0, y0, x1 - x0, y1 - y0); return; }   // vignette du vestiaire
  const key = `${x0}|${y0}|${x1}|${y1}|${rect.s}`;
  if (!night || night.key !== key) night = { key, c: nightLayer(x0, y0, x1, y1, rect.s, night ? night.c : undefined) };
  g.drawImage(night.c, x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = `rgba(255,170,90,${0.02 + 0.015 * Math.sin(t * 5.3) * Math.sin(t * 3.1)})`;   // les flammes vacillent
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
}

export default {
  id: 'nagoya', base: '#a88f6c', paint, under, seats: () => layout().seats,
  fx: 'hanabi', count: 0, vignette: null,
};
