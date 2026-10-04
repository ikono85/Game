/**
 * Portraits des lutteurs (écran « VS », choix de l'adversaire) : une image de la planche, vue de
 * dessus comme en jeu, dans une pose qui dit le style du lutteur, tournée dans le sens voulu.
 * Chaque style a aussi son kanji et sa couleur.
 */
import { FRAME, sheetReady, skinSheet } from './sprites.js';

// [rangée, image] dans la planche : 0 attente, 1 marche, 2 dash, 4 garde
const POSES = { player: [0, 0], oshi: [2, 3], kabe: [4, 0], kitsune: [1, 4], mai: [1, 7], yokozuna: [0, 3] };
const LOOKS = {
  oshi: { kanji: '押', color: '#e2603a', word: 'pousser' },
  kabe: { kanji: '壁', color: '#9aa7b3', word: 'le mur' },
  kitsune: { kanji: '狐', color: '#ee9a3a', word: 'le renard' },
  mai: { kanji: '舞', color: '#b07ce0', word: 'la danse' },
  yokozuna: { kanji: '綱', color: '#e8c35e', word: 'la corde du champion' },
};

/**
 * Un canevas carré de `size` pixels CSS (net sur écran haute densité) avec le lutteur.
 * angle : sens du regard (0 = vers la droite, Math.PI = vers la gauche, -Math.PI / 2 = vers le haut).
 */
function portrait(skin, pose, size, angle = 0, zoom = 1) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.className = 'portrait';
  const draw = () => {
    const sheet = skinSheet(skin);
    if (!sheetReady(sheet)) { setTimeout(draw, 120); return; }
    const g = c.getContext('2d'), [row, col] = POSES[pose] || POSES.player, s = c.width * zoom;
    g.clearRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = 'high';
    g.save();
    g.translate(c.width / 2, c.height / 2); g.rotate(angle);
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = c.width * 0.05; g.shadowOffsetY = c.width * 0.03;
    g.drawImage(sheet, col * FRAME, row * FRAME, FRAME, FRAME, -s / 2, -s / 2, s, s);
    g.restore();
  };
  draw();
  return c;
}

export { LOOKS, POSES, portrait };
