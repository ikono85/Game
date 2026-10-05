/**
 * Images : planche du lutteur (une rangée par animation), carte, foule. Les ceintures et le
 * lutteur bleu sont recolorés à la volée à partir de la planche rouge.
 */
import { ASSETS } from '../assets.js';
import { save } from '../game/save.js';
import { DASH_T, UT_BRACE, UT_SWING, clamp } from '../sim/constants.js';

// Images
function loadImg(src) { const i = new Image(); i.src = src; return i; }
const MAP = loadImg(ASSETS.map), CROWD = loadImg(ASSETS.crowd);
// Une seule planche (lutteur rouge) ; le bleu et les ceintures sont recolorés à la volée.
const BASE_SHEETS = { red: loadImg(ASSETS.wrestler) };
// Planches HD (13 images de 256 px) : 0-1 attente, 2-5 marche, 6-7 dash, 8-10 chute, 11-12 garde
// Planche 240 px par image, affichée sur 144 unités du monde. Une rangée par animation :
// 0 attente (8 images), 1 marche (10), 2 dash (7), 3 chute (9), 4 garde (9 : la 1re lève la garde, 1 à 8 en boucle)
const FRAME = 240, SPRITE_SIZE = 144;
const ROW = { idle: 0, walk: 1, dash: 2, fall: 3, guard: 4, utchari: 5 };
function pickFrame(p) {
  if (p.utT >= 0) {               // 0-1 appui, 2-5 pivot, 6 lâcher, 7 rétablissement
    const t = p.utT;
    if (t < UT_BRACE) return [ROW.utchari, t < UT_BRACE / 2 ? 0 : 1];
    if (t < UT_BRACE + UT_SWING) return [ROW.utchari, 2 + Math.min(3, Math.floor((t - UT_BRACE) / UT_SWING * 4))];
    return [ROW.utchari, t < UT_BRACE + UT_SWING + 0.06 ? 6 : 7];
  }
  if (p.fallT >= 0) return [ROW.fall, Math.min(8, Math.floor(p.fallT * 10))];
  if (p.noRegen) return [ROW.guard, 1 + (Math.floor(p.breath * 14) % 8)];   // à la ceinture : bras en avant, la poussière vole
  if (p.dashT > 0 || p.fakeT > 0) return [ROW.dash, Math.min(6, Math.floor((1 - Math.max(p.dashT, p.fakeT) / DASH_T) * 7))];
  if (p.guard || p.hold) return [ROW.guard, 1 + (Math.floor(p.breath * 12) % 8)];   // tenir au bord : talons plantés, poussière
  if (Math.hypot(p.vx, p.vy) > 40) return [ROW.walk, Math.floor(p.walk * 2.5) % 10];
  return [ROW.idle, Math.floor(p.breath * 7) % 8];
}

// Skins : on recolore la ceinture (pixels rouges saturés) de la planche rouge.
const SKINS = [
  { id: 'rouge',  name: 'Rouge',   rank: 0, h: null },
  { id: 'noir',   name: 'Noir',    rank: 1, h: 0,   s: 0.15, v: 0.32 },
  { id: 'vert',   name: 'Jade',    rank: 2, h: 150, s: 0.9,  v: 0.75 },
  { id: 'violet', name: 'Glycine', rank: 3, h: 275, s: 0.85, v: 0.85 },
  { id: 'rose',   name: 'Sakura',  rank: 4, h: 335, s: 0.45, v: 1.15 },
  { id: 'cuivre', name: 'Cuivre',  rank: 6, h: 22,  s: 0.85, v: 0.8 },
  { id: 'or',     name: 'Or',      rank: 7, h: 44,  s: 0.85, v: 1.2 },
  { id: 'blanc',  name: 'Tsuna',   rank: 9, h: 40,  s: 0.06, v: 1.5 },
  { id: 'bleu',   name: 'Bleu',    rank: 99, h: 211, s: 0.82, v: 1.1, hidden: true },   // le lutteur de l'ouest
];
const skinCache = {};
function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255];
}
function hsv2rgb(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}
function skinSheet(id) {
  const skin = SKINS.find(s => s.id === id) || SKINS[0];
  const base = BASE_SHEETS.red;
  if (!skin.h && skin.h !== 0) return base;
  if (skinCache[id]) return skinCache[id];
  if (!base.complete || !base.naturalWidth) return null;      // pas encore chargée : on ne dessine rien plutôt qu'un rouge
  const c = document.createElement('canvas');
  c.width = base.naturalWidth; c.height = base.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(base, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let k = 0; k < d.length; k += 4) {
    if (d[k + 3] < 10) continue;
    const [h, s, v] = rgb2hsv(d[k], d[k + 1], d[k + 2]);
    if ((h < 14 || h > 340) && s > 0.5 && v > 0.3) {
      const [r, gg, b] = hsv2rgb(skin.h, clamp(s * skin.s, 0, 1), clamp(v * skin.v, 0, 1));
      d[k] = r; d[k + 1] = gg; d[k + 2] = b;
    }
  }
  g.putImageData(img, 0, 0);
  return (skinCache[id] = c);
}
const sheetReady = s => s && (s instanceof HTMLCanvasElement || (s.complete && s.naturalWidth));
// recolore le bleu (et la ceinture portée) dès le chargement, pour éviter un à-coup au premier combat
BASE_SHEETS.red.addEventListener('load', () => { skinSheet('bleu'); setTimeout(() => skinSheet(save.skin), 0); });

export { CROWD, FRAME, MAP, SKINS, SPRITE_SIZE, pickFrame, sheetReady, skinSheet };
