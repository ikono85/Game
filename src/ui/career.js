/**
 * Vestiaire et écrans de la carrière (basho, résultat du jour, classement de fin de basho).
 */
import { Sound } from '../audio/sound.js';
import { BASHO_DAYS, RANKS, career, newBasho } from '../game/career.js';
import { startMatch, statsTable } from '../game/match.js';
import { shareButton } from '../game/watch.js';
import { kimariteText } from '../sim/kimarite.js';
import { persist, save } from '../game/save.js';
import { G } from '../game/state.js';
import { FRAME, SKINS, sheetReady, skinSheet } from '../render/sprites.js';
import { STYLES } from '../sim/ai.js';
import { PI } from '../sim/constants.js';
import { setNames, updateScore } from './hud.js';
import { menu } from './menus.js';
import { el, list, mbtn, recordEl, showScreen } from './widgets.js';

function wardrobe(backFn) {
  const best = save.career ? save.career.best : 0;
  const grid = el('div', 'swatches');
  SKINS.filter(s => !s.hidden).forEach(s => {
    const b = el('button', 'swatch' + (save.skin === s.id ? ' sel' : ''));
    b.type = 'button';
    const cnv = document.createElement('canvas'); cnv.width = 128; cnv.height = 128;
    const draw = () => {
      const sh = skinSheet(s.id);
      if (!sheetReady(sh)) return setTimeout(draw, 100);
      const g = cnv.getContext('2d'); g.clearRect(0, 0, 128, 128);
      g.translate(64, 64); g.rotate(-PI / 2); g.drawImage(sh, FRAME * 0.2, FRAME * 0.2, FRAME * 0.6, FRAME * 0.6, -64, -64, 128, 128);   // zoom sur le lutteur
    };
    draw();
    const unlocked = s.rank <= best;
    b.append(cnv, el('span', null, s.name), el('small', null, !unlocked ? `Rang ${RANKS[s.rank].name}` : save.skin === s.id ? 'Portée' : 'Disponible'));
    b.disabled = !unlocked;
    b.addEventListener('click', () => { save.skin = s.id; G.skins[0] = s.id; persist(); Sound.click(); wardrobe(backFn); });
    grid.append(b);
  });
  showScreen({
    kanji: '締込',
    title: 'Vestiaire',
    lead: 'Choisis ta ceinture. Monte dans le classement en mode Carrière pour en débloquer de nouvelles.',
    body: [grid, list(mbtn('Retour', null, false, backFn, 'quiet'))],
    focus: '.swatch.sel',
    back: backFn,
  });
}

function careerHub() {
  const c = career(), b = c.basho;
  G.screen = 'menu'; G.mode = null;
  setNames('Rouge', 'Est', 'Bleu', 'Ouest'); updateScore();
  const rk = RANKS[c.rank];
  const ranks = el('ol', 'ranks');
  ranks.setAttribute('aria-label', 'Rangs du banzuke');
  RANKS.forEach((r, k) => ranks.append(el('li', k === c.rank ? 'now' : k <= c.best ? 'done' : '', r.name)));
  const o = b.opps[b.day];
  const vs = el('div', 'versus');
  vs.append(el('p', 'sub-h', `Jour ${b.day + 1}, ton adversaire (${RANKS[o.rank].name})`), el('div', 'who2', o.name),
    el('div', 'sty', `${STYLES[o.style].label[0].toUpperCase() + STYLES[o.style].label.slice(1)}. ${STYLES[o.style].desc}`));
  const row = el('div', 'row-btns');
  row.append(mbtn('Vestiaire', null, false, () => wardrobe(careerHub), 'quiet'), mbtn('Menu', null, false, menu, 'quiet'));
  let armed = false;
  const reset = mbtn('Recommencer la carrière', null, false, () => {
    if (!armed) { armed = true; reset.firstChild.textContent = 'Tout effacer ? Clique encore pour confirmer'; reset.classList.add('danger'); return; }
    save.career = null; save.skin = 'rouge'; G.skins[0] = 'rouge'; persist(); careerHub();
  }, 'quiet');
  showScreen({
    kanji: rk.kanji,
    title: rk.name,
    lead: `Basho ${c.bashoNo}. Gagne au moins ${Math.floor(BASHO_DAYS / 2) + 1} combats sur ${BASHO_DAYS} pour monter au rang suivant.`,
    body: [ranks, recordEl(b.results, b.day), vs,
      list(mbtn('Combattre', 'Une manche, comme au vrai sumo', true, () => startMatch({ mode: 'career', opp: o })), row, reset)],
    back: menu,
  });
}

function careerBoutResult(won) {
  const c = career(), b = c.basho;
  const o = b.opps[b.day];
  b.results.push(won ? 1 : 0);
  b.day++;
  persist();
  const wins = b.results.filter(x => x).length, losses = b.results.length - wins;
  const next = b.day >= BASHO_DAYS
    ? mbtn('Voir le classement', 'Fin du basho', true, bashoEnd)
    : mbtn('Jour suivant', `${wins} victoire${wins > 1 ? 's' : ''}, ${losses} défaite${losses > 1 ? 's' : ''}`, true, careerHub);
  showScreen({
    kanji: won ? '勝' : '負', seal: won ? 'shu' : 'ink',
    title: won ? 'Victoire' : 'Défaite',
    lead: `Jour ${b.day} contre ${o.name}` + (G.S && G.S.phase === 'matchEnd' && G.S.endTick ? kimariteText(G.kimarite, won ? 'gagné par' : 'perdu par') : '.'),
    body: [recordEl(b.results, -1), statsTable(), list(next, G.S && G.S.phase === 'matchEnd' && G.S.endTick ? shareButton(G.lastReplay) : null)],
  });
}

function bashoEnd() {
  const c = career(), b = c.basho;
  const wins = b.results.filter(x => x).length, results = b.results.slice();
  const before = c.rank, bestBefore = c.best;
  let verdict, cls;
  const perfect = wins === BASHO_DAYS, kachi = wins * 2 > BASHO_DAYS;
  if (perfect) c.yusho++;
  if (c.rank === 9) {                                  // un Yokozuna ne monte ni ne descend
    cls = kachi ? 'up' : 'down';
    verdict = perfect ? 'Sept victoires sur sept : un basho parfait pour le Yokozuna'
      : kachi ? 'Plus de victoires que de défaites : le Yokozuna tient son rang'
      : 'Plus de défaites que de victoires, mais un Yokozuna ne descend pas';
  } else if (c.rank === 8 && wins >= 6) { c.rank = 9; verdict = 'Promu Yokozuna'; cls = 'up'; }
  else if (c.rank === 8 && kachi) { verdict = 'Plus de victoires que de défaites : tu restes Ōzeki. Il en faut 6 pour devenir Yokozuna'; cls = 'up'; }
  else if (perfect) { c.rank = Math.min(8, c.rank + 2); verdict = c.rank - before === 2 ? 'Sept victoires sur sept : tu montes de deux rangs' : 'Sept victoires sur sept : promotion'; cls = 'up'; }
  else if (kachi) { c.rank++; verdict = 'Plus de victoires que de défaites : promotion'; cls = 'up'; }
  else { c.rank = Math.max(0, c.rank - 1); verdict = before === 0 ? 'Plus de défaites que de victoires : tu restes Jonokuchi' : 'Plus de défaites que de victoires : rétrogradation'; cls = 'down'; }
  c.best = Math.max(c.best, c.rank);
  c.bashoNo++; c.basho = null; newBasho(c); persist();
  const unlocked = SKINS.filter(s => s.rank > bestBefore && s.rank <= c.best);
  const rk = RANKS[c.rank];
  showScreen({
    kanji: rk.kanji,
    title: rk.name,
    lead: `Fin du basho : ${wins} victoire${wins > 1 ? 's' : ''} sur ${BASHO_DAYS}.`,
    body: [
      el('p', 'verdict ' + cls, verdict),
      recordEl(results, -1),
      unlocked.length ? el('p', 'unlock', `Nouvelle${unlocked.length > 1 ? 's' : ''} ceinture${unlocked.length > 1 ? 's' : ''} au vestiaire : ${unlocked.map(s => s.name).join(', ')}.`) : null,
      list(mbtn('Basho suivant', `Basho ${c.bashoNo}`, true, careerHub), unlocked.length ? mbtn('Vestiaire', null, false, () => wardrobe(careerHub), 'quiet') : null),
    ],
  });
}

export { careerBoutResult, careerHub, wardrobe };
