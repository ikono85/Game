/**
 * Pic des cascades (Kyūshū basho) : une carte peinte (assets/taki.webp), vue de haut et un peu de
 * biais. Le dohyō est posé au sommet d'un pilier de pierre au-dessus d'une gorge, entre cascades,
 * érables, torii et sanctuaire. Le bandeau et les lutteurs dessinés dans l'image d'origine ont été
 * effacés ; l'image est étirée pour que son cercle de paille tombe exactement sur celui du jeu.
 * Au-delà de l'image (écran très haut ou très large), une version floue prolonge le décor.
 */
import { ASSETS } from '../../assets.js';
import { C } from '../../sim/constants.js';

const IMG = new Image();
IMG.src = ASSETS.taki;
// le centre des ballots de paille dans l'image (pixels) et leur rayon, en largeur et en hauteur
const CX = 829.5, CY = 386, KX = 390 / 236.5, KY = 390 / 214;   // unités du monde par pixel
const ready = () => IMG.complete && IMG.naturalWidth > 0;

let soft = null, blur = null;
/** L'image aux bords fondus, et une toute petite copie qui, agrandie, fait un flou gratuit. */
function prepare() {
  if (soft) return;
  const w = IMG.naturalWidth, h = IMG.naturalHeight;
  soft = document.createElement('canvas'); soft.width = w; soft.height = h;
  const g = soft.getContext('2d');
  g.drawImage(IMG, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const f = 0.035;
  const gx = g.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(f, '#000'); gx.addColorStop(1 - f, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gx; g.fillRect(0, 0, w, h);
  const gy = g.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(f * 1.6, '#000'); gy.addColorStop(1 - f * 1.6, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0, 0, w, h);
  blur = document.createElement('canvas'); blur.width = 64; blur.height = 36;
  const b = blur.getContext('2d');
  b.drawImage(IMG, 0, 0, 64, 36);
  b.fillStyle = 'rgba(10,14,12,.35)'; b.fillRect(0, 0, 64, 36);
}

function paint(g, x0, y0, x1, y1) {
  if (!ready()) return;
  prepare();
  const w = IMG.naturalWidth * KX, h = IMG.naturalHeight * KY, X = C - CX * KX, Y = C - CY * KY;
  if (x0 < X || y0 < Y || x1 > X + w || y1 > Y + h) {
    // le décor flou, assez grand pour couvrir toute la vue
    const s = Math.max((x1 - x0) / w, (y1 - y0) / h, 1) * 1.15;
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(blur, C - w * s / 2, C - h * s / 2, w * s, h * s);
    g.restore();
  }
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(soft, X, Y, w, h);
}

export default {
  id: 'taki', base: '#2b3a2e', paint, ready, seats: () => [],
  fx: 'momiji', count: 34, vignette: null,
};
