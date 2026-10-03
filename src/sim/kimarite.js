/**
 * Les prises gagnantes (kimarite) que la simulation sait reconnaître, avec leur sens en français.
 * La simulation choisit la prise à chaque fin de manche (voir kimarite() dans simulation.js).
 */
const KIMARITE = {
  oshidashi: { name: 'Oshidashi', fr: 'sorti par une charge' },
  yorikiri: { name: 'Yorikiri', fr: 'poussé dehors au corps à corps' },
  okuridashi: { name: 'Okuridashi', fr: 'poussé dehors par derrière' },
  hatakikomi: { name: 'Hatakikomi', fr: 'esquivé, emporté par son élan' },
  utchari: { name: 'Utchari', fr: 'pivot sur la paille' },
  isamiashi: { name: 'Isamiashi', fr: 'sorti tout seul' },
};
const KIMARITE_IDS = Object.keys(KIMARITE);

/** « , par oshidashi (sorti par une charge). » pour les écrans de fin ; « . » si on ne sait pas. */
function kimariteText(k, verb = 'par') {
  const K = KIMARITE[k];
  return K ? `, ${verb} ${K.name.toLowerCase()} (${K.fr}).` : '.';
}

export { KIMARITE, KIMARITE_IDS, kimariteText };
