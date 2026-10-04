/**
 * État de présentation partagé (G) : écran, mode, partie en cours, effets, stats, réseau.
 */
import { C } from '../sim/constants.js';

const newStats = () => ({ dash: 0, dashHit: 0, block: 0, feint: 0, matta: 0, best: null, hold: 0, utchari: 0, counter: 0, henka: 0, henkaTry: 0, kim: [] });
const G = {
  screen: 'menu',       // 'menu' | 'match'
  mode: null,           // 'versus' | 'ai' | 'career'
  S: null, paused: false, acc: 0, last: performance.now(),
  t: 0, shake: 0, cheer: 0, flash: null, particles: [], zabuton: [],
  names: ['Rouge', 'Bleu'], skins: ['rouge', 'blue'], opp: null, focusX: C, focusY: C,
  down: [false, false],   // un joueur a été mené 0–(N-1) : sa victoire serait un exploit
  stats: [newStats(), newStats()], dashOpen: [false, false], labels: [],
  rec: [],                // dernières secondes de la manche, image par image, pour le ralenti
  replay: null, back: null, padFamily: null,
  recorder: null,         // enregistrement du match en cours (ralenti partageable)
  lastReplay: null,       // dernier match terminé, prêt à partager
  watch: null,            // lecture d'un ralenti partagé
  dojo: null,             // leçon du dojo en cours
  arena: 'ryogoku',       // arène affichée (voir game/arenalist.js)
  arenaLabel: null,       // « Haru basho · Osaka », affiché au premier départ
};

export { G, newStats };
