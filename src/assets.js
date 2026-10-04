/**
 * Images et données du décor. build.mjs les incorpore au fichier final (data URL),
 * donc index.html reste un fichier unique.
 */
import wrestler from '../assets/wrestler.webp';   // planche du lutteur rouge, 240 px par image
import map from '../assets/map.jpg';              // le dohyō et les loges, vus de dessus
import crowd from '../assets/crowd.png';          // spectateurs (16 variantes)
import title from '../assets/title.webp';         // l'illustration de l'écran titre (boutons dessinés dedans)
import SEATS from '../assets/seats.json';         // places occupées sur la carte : [x, y, variante, phase]

export const ASSETS = { wrestler, map, crowd, title };
export { SEATS };
