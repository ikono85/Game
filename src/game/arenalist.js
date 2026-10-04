/**
 * Les arènes (lieux où se dresse le dohyō, purement visuels) et le calendrier des basho. Données
 * seulement, sans DOM : utilisées par le rendu, la carrière, le vestiaire et les ralentis partagés.
 * Les identifiants restent ceux des saisons (sauvegardes et ralentis déjà partagés).
 *
 * Comme le vrai calendrier : six basho par an, un tous les deux mois. En carrière, chaque basho se
 * déroule dans son arène ; l'atteindre la débloque pour les autres modes (vestiaire).
 */
const ARENAS = [
  { id: 'ryogoku', name: 'Ryōgoku', season: 'Classique', desc: 'Le Kokugikan de Tokyo, comme toujours.' },
  { id: 'haru', name: 'Sanctuaire aux cerisiers', season: 'Haru basho', desc: 'En plein air, entre le hall du sanctuaire et le torii, sous les cerisiers en fleurs.' },
  { id: 'nagoya', name: 'Matsuri d’été', season: 'Nagoya basho', desc: 'De nuit, au milieu des échoppes, des lanternes et des feux d’artifice.' },
  { id: 'aki', name: 'Temple d’automne', season: 'Aki basho', desc: 'Dans la cour d’un vieux temple : pagode, étang aux carpes, érables rouges.' },
  { id: 'hatsu', name: 'Village sous la neige', season: 'Hatsu basho', desc: 'Sur la place d’un village de montagne, entre les fermes au toit de chaume.' },
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
