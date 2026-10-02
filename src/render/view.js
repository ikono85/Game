/**
 * Vue plein écran : mise à l'échelle et gradins prolongés autour de la carte.
 */
import { resetVignette } from './draw.js';
import { MAP } from './sprites.js';
import { W } from '../sim/constants.js';
import { cv } from '../ui/dom.js';

// Le monde (carte de 1408 unités) est mis à l'échelle pour que VIEW_H unités tiennent dans le plus
// petit côté de la fenêtre ; l'autre côté révèle des gradins prolongés autour de la carte.
const VIEW_H = 1300, VIEW_PORTRAIT = 960;
const CELL = W / 14;                 // une loge de 4 coussins (masu-seki) sur la carte
const V = { s: 1, ox: 0, oy: 0, cw: 1, ch: 1, x0: 0, y0: 0, x1: W, y1: W };
let bgCache = null, extraSeats = [];
function hash2(a, b) {               // pseudo-hasard stable : les gradins ne changent pas d'une image à l'autre
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function buildBackground() {
  extraSeats = [];
  if (!(MAP.complete && MAP.naturalWidth)) { bgCache = null; return; }
  const c = bgCache || document.createElement('canvas');
  c.width = V.cw; c.height = V.ch;
  const g = c.getContext('2d');
  g.setTransform(V.s, 0, 0, V.s, V.ox, V.oy);
  g.fillStyle = '#1a120c'; g.fillRect(V.x0 - 2, V.y0 - 2, V.x1 - V.x0 + 4, V.y1 - V.y0 + 4);
  const k = MAP.naturalWidth / W;
  const i0 = Math.floor(V.x0 / CELL) - 1, i1 = Math.ceil(V.x1 / CELL) + 1;
  const j0 = Math.floor(V.y0 / CELL) - 1, j1 = Math.ceil(V.y1 / CELL) + 1;
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    if (i >= 0 && i < 14 && j >= 0 && j < 14) continue;          // déjà sur la carte
    const x = i * CELL, y = j * CELL;
    if ((j === 6 || j === 7) && (i < 0 || i >= 14)) {            // l'allée (hanamichi) continue vers l'extérieur
      g.fillStyle = '#2a1c12'; g.fillRect(x, y, CELL + 1, CELL + 1);
      g.fillStyle = 'rgba(255,220,170,.05)';
      for (let p = 0; p < 4; p++) g.fillRect(x, y + p * CELL / 4, CELL + 1, 2);
      continue;
    }
    const src = (hash2(i, j) * 14) | 0;                          // une loge prise au hasard dans la rangée du haut
    g.drawImage(MAP, src * CELL * k, 0, CELL * k, CELL * k, x, y, CELL + 1, CELL + 1);
    for (const [dx, dy] of [[32, 32], [76, 32], [32, 76], [76, 76]]) {
      const h = hash2(i * 7 + dx, j * 13 + dy);
      if (h < 0.12) continue;                                    // place libre
      extraSeats.push([x + dx * CELL / 100, y + dy * CELL / 100, ((h * 9973) | 0) % 16, (h * 7919) % 1]);
    }
  }
  g.drawImage(MAP, 0, 0, W, W);
  bgCache = c;
}
function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.max(200, Math.round(innerWidth * dpr)), ch = Math.max(200, Math.round(innerHeight * dpr));
  if (cv.width !== cw) cv.width = cw;
  if (cv.height !== ch) cv.height = ch;
  const s = Math.min(cw, ch) / (ch > cw * 1.15 ? VIEW_PORTRAIT : VIEW_H);   // en portrait, on zoome sur le dohyō
  Object.assign(V, { s, cw, ch, ox: (cw - W * s) / 2, oy: (ch - W * s) / 2 });
  V.x0 = -V.ox / s; V.y0 = -V.oy / s; V.x1 = (cw - V.ox) / s; V.y1 = (ch - V.oy) / s;
  resetVignette();
  buildBackground();
}
MAP.addEventListener('load', () => buildBackground());
addEventListener('resize', fit);

export { V, bgCache, buildBackground, extraSeats, fit };
