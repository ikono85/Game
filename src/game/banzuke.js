/**
 * Règles du banzuke : ce que vaut un basho terminé (promotion, maintien, rétrogradation, yusho).
 * Aucune dépendance au DOM ni aux images : testé directement sous Node (tests/career.test.mjs).
 */
const BASHO_DAYS = 7;
const YOKOZUNA = 9, OZEKI = 8;

/** Le basho en cours est-il fini (7 combats joués) mais pas encore clos ? */
const bashoOver = c => !!(c && c.basho && (c.basho.day >= BASHO_DAYS || (c.basho.results || []).length >= BASHO_DAYS));

/**
 * Clôt le basho : met à jour rank, best et yusho de la carrière c, et renvoie le bilan à afficher.
 * Ne touche ni à bashoNo ni au basho suivant (voir closeBasho dans game/career.js).
 */
function judgeBasho(c) {
  const results = c.basho.results.slice(0, BASHO_DAYS);
  const wins = results.filter(x => x).length;
  const before = c.rank, bestBefore = c.best;
  const perfect = wins === BASHO_DAYS, kachi = wins * 2 > BASHO_DAYS;
  let verdict, cls;
  if (perfect) c.yusho = (c.yusho || 0) + 1;
  if (c.rank === YOKOZUNA) {                           // un Yokozuna ne monte ni ne descend
    cls = kachi ? 'up' : 'down';
    verdict = perfect ? 'Sept victoires sur sept : un basho parfait pour le Yokozuna'
      : kachi ? 'Plus de victoires que de défaites : le Yokozuna tient son rang'
      : 'Plus de défaites que de victoires, mais un Yokozuna ne descend pas';
  } else if (c.rank === OZEKI && wins >= 6) { c.rank = YOKOZUNA; verdict = 'Promu Yokozuna'; cls = 'up'; }
  else if (c.rank === OZEKI && kachi) { verdict = 'Plus de victoires que de défaites : tu restes Ōzeki. Il en faut 6 pour devenir Yokozuna'; cls = 'up'; }
  else if (perfect) { c.rank = Math.min(OZEKI, c.rank + 2); verdict = c.rank - before === 2 ? 'Sept victoires sur sept : tu montes de deux rangs' : 'Sept victoires sur sept : promotion'; cls = 'up'; }
  else if (kachi) { c.rank++; verdict = 'Plus de victoires que de défaites : promotion'; cls = 'up'; }
  else { c.rank = Math.max(0, c.rank - 1); verdict = before === 0 ? 'Plus de défaites que de victoires : tu restes Jonokuchi' : 'Plus de défaites que de victoires : rétrogradation'; cls = 'down'; }
  c.best = Math.max(c.best, c.rank);
  return { wins, results, before, bestBefore, verdict, cls };
}

export { BASHO_DAYS, bashoOver, judgeBasho };
