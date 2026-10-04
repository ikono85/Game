/**
 * Les cartes dessinées par le code, une par arène (Ryōgoku garde l'image de la salle).
 * Chaque scène fournit :
 *   paint(g, x0, y0, x1, y1)  peint le sol, les bâtiments et les arbres (coordonnées du monde) ;
 *   seats()                   les places du public [x, y, variante, phase, genre?] ;
 *   base                      la couleur de fond ;
 *   fx, count                 ce qui tombe ou flotte (voir arenas.js) ;
 *   vignette                  { rgb, a: [centre, milieu, bord] } ou null ;
 *   under(g, rect, t)         facultatif : nuit, lueurs, guirlandes, dessinées par-dessus le public.
 */
import haru from './haru.js';
import nagoya from './nagoya.js';
import aki from './aki.js';
import hatsu from './hatsu.js';

const SCENES = { haru, nagoya, aki, hatsu };
const sceneFor = id => SCENES[id] || null;

export { sceneFor };
