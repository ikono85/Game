/* =====================================================================
   Dohyō Duel — point d'entrée
   Le jeu est découpé en modules ; build.mjs les assemble en un seul
   fichier, index.html (images, son, PeerJS compris).

   sim/     la simulation, sans DOM : constantes, physique, IA
   render/  tout ce qui se dessine : images, rendu, effets, ralenti, vue
   audio/   les sons (synthétisés)
   input/   clavier, manette, tactile
   ui/      écrans de menu, bandeau, commandes, pause, carrière
   game/    état partagé, boucle, match local, carrière, sauvegarde
   net/     le mode en ligne
   ===================================================================== */
import { Sound } from './audio/sound.js';
import { frame } from './game/loop.js';
import { startMatch } from './game/match.js';
import { save } from './game/save.js';
import { G } from './game/state.js';
import { BIND, PAD, loadBinds } from './input/keyboard.js';
import { packIn, unpackIn } from './net/netcode.js';
import { joinScreen } from './net/screens.js';
import { render } from './render/draw.js';
import { fit } from './render/view.js';
import { STYLES, aiCommand, makeProfile } from './sim/ai.js';
import { NOCMD, canUtchari, hashState, newMatch, step, utchariReady } from './sim/simulation.js';
import { careerBoutResult } from './ui/career.js';
import { syncArenas } from './game/career.js';
import { updateScore } from './ui/hud.js';
import { menu } from './ui/menus.js';
import { syncMute } from './ui/pause.js';
import { openReplayLink } from './game/watch.js';


// Accès pour les tests (déterminisme, IA contre IA)
window.__dohyo = { newMatch, step, aiCommand, makeProfile, hashState, STYLES, NOCMD, G, careerBoutResult, startMatch, save, render, utchariReady, canUtchari, packIn, unpackIn, binds: () => ({ BIND, PAD }) };

loadBinds();                      // touches choisies par le joueur
syncArenas();                     // arènes découvertes en carrière
Sound.muted = save.muted; syncMute();
updateScore();
menu();
// lien d'invitation : …/#duel=ABCDE ouvre directement « Rejoindre », code rempli
const invite = /[#&]duel=([A-Za-z0-9]{5})\b/.exec(location.hash);
if (invite) {
  history.replaceState(null, '', location.pathname + location.search);
  joinScreen(invite[1].toUpperCase());
}
// ralenti partagé : …/#replay=… rejoue un combat
const shared = /[#&]replay=([A-Za-z0-9_-]+)/.exec(location.hash);
if (shared) {
  history.replaceState(null, '', location.pathname + location.search);
  openReplayLink(shared[1]);
}
fit();
requestAnimationFrame(frame);
