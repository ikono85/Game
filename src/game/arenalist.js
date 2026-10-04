/**
 * Les arènes (variantes visuelles du dohyō) et le calendrier des basho. Données seulement, sans DOM :
 * utilisées par le rendu, la carrière, le vestiaire et les ralentis partagés.
 *
 * Comme le vrai calendrier : six basho par an, un tous les deux mois. En carrière, chaque basho se
 * déroule dans son arène ; l'atteindre la débloque pour les autres modes (vestiaire).
 */
const ARENAS = [
  { id: 'ryogoku', name: 'Ryōgoku', season: 'Classique', desc: 'Le Kokugikan de Tokyo, comme toujours.' },
  { id: 'haru', name: 'Printemps', season: 'Haru basho', desc: 'Pétales de cerisier dans la salle.' },
  { id: 'nagoya', name: 'Nuit d’été', season: 'Nagoya basho', desc: 'Lanternes et lucioles, la salle dans la pénombre.' },
  { id: 'aki', name: 'Automne', season: 'Aki basho', desc: 'Feuilles d’érable rouges et dorées.' },
  { id: 'hatsu', name: 'Hiver', season: 'Hatsu basho', desc: 'La neige tombe sur le dohyō.' },
];
const ARENA_IDS = ARENAS.map(a => a.id);

const BASHO = [
  { name: 'Hatsu basho', month: 'janvier', city: 'Tokyo', arena: 'hatsu' },
  { name: 'Haru basho', month: 'mars', city: 'Osaka', arena: 'haru' },
  { name: 'Natsu basho', month: 'mai', city: 'Tokyo', arena: 'ryogoku' },
  { name: 'Nagoya basho', month: 'juillet', city: 'Nagoya', arena: 'nagoya' },
  { name: 'Aki basho', month: 'septembre', city: 'Tokyo', arena: 'aki' },
  { name: 'Kyūshū basho', month: 'novembre', city: 'Fukuoka', arena: 'aki' },
];
/** Le basho n° n de la carrière (1, 2, 3…) : on tourne dans le calendrier. */
const bashoOf = n => BASHO[(Math.max(1, n | 0) - 1) % BASHO.length];
/** Le premier basho du calendrier qui se joue dans cette arène (pour dire où la découvrir). */
const firstBashoFor = id => BASHO.findIndex(b => b.arena === id) + 1;
const arenaById = id => ARENAS.find(a => a.id === id) || ARENAS[0];

export { ARENAS, ARENA_IDS, BASHO, arenaById, bashoOf, firstBashoFor };
