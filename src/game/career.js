/**
 * Carrière : rangs du banzuke, adversaires d'un basho, ceintures débloquées.
 */
import { save } from './save.js';
import { SKINS } from '../render/sprites.js';
import { clamp } from '../sim/constants.js';
import { rand } from '../sim/simulation.js';

const RANKS = [
  { name: 'Jonokuchi', kanji: '序ノ口' }, { name: 'Jonidan', kanji: '序二段' }, { name: 'Sandanme', kanji: '三段目' },
  { name: 'Makushita', kanji: '幕下' }, { name: 'Jūryō', kanji: '十両' }, { name: 'Maegashira', kanji: '前頭' },
  { name: 'Komusubi', kanji: '小結' }, { name: 'Sekiwake', kanji: '関脇' }, { name: 'Ōzeki', kanji: '大関' },
  { name: 'Yokozuna', kanji: '横綱' },
];
const BASHO_DAYS = 7;
// Noms de combat inventés
const SHIKONA = ['Kumonami', 'Yukibashi', 'Tetsuiwa', 'Shiokaze', 'Kitsunebi', 'Harusame', 'Kazeguruma', 'Oboroumi',
  'Ishidatami', 'Hotarubi', 'Tsukikage', 'Kaminariyama', 'Kurogane', 'Sazanami', 'Mikazuki', 'Yamabiko', 'Ganseki', 'Shimotsuki'];
// Styles rencontrés selon le rang
const TIER_STYLES = [
  ['oshi', 'oshi', 'kabe'], ['oshi', 'kabe'], ['oshi', 'kabe', 'mai'], ['kabe', 'mai', 'kitsune'],
  ['kabe', 'kitsune', 'mai'], ['kitsune', 'mai', 'kabe'], ['kitsune', 'mai', 'yokozuna'],
  ['kitsune', 'mai', 'yokozuna'], ['yokozuna', 'kitsune', 'mai'], ['yokozuna', 'kitsune', 'mai'],
];

function newBasho(c) {
  let seed = (Date.now() ^ (c.bashoNo * 7919)) | 0;
  const R = { seed }, rank = c.rank;
  const names = SHIKONA.slice();
  const opps = [];
  for (let d = 0; d < BASHO_DAYS; d++) {
    const pool = TIER_STYLES[rank];
    let style = pool[(rand(R) * pool.length) | 0];
    const lastDay = d === BASHO_DAYS - 1;
    if (lastDay && rank >= 6) style = 'yokozuna';                  // le dernier jour, on affronte le meilleur
    const oppRank = clamp(rank + (lastDay ? 1 : Math.round(rand(R) * 2 - 1)), 0, 9);
    const name = names.splice((rand(R) * names.length) | 0, 1)[0];
    opps.push({ name, style, rank: oppRank, level: clamp(0.12 + rank / 9 * 0.8 + (rand(R) - 0.5) * 0.15 + (lastDay ? 0.1 : 0), 0, 1) });
  }
  c.basho = { day: 0, results: [], opps };
}
function career() {
  if (!save.career) { save.career = { rank: 0, best: 0, bashoNo: 1, yusho: 0, basho: null }; }
  if (!save.career.basho) newBasho(save.career);
  return save.career;
}
const unlockedSkins = () => SKINS.filter(s => s.rank <= (save.career ? save.career.best : 0));

export { BASHO_DAYS, RANKS, SHIKONA, career, newBasho };
