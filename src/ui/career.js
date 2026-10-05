/**
 * Vestiaire et écrans de la carrière (basho, résultat du jour, classement de fin de basho).
 */
import { Sound } from '../audio/sound.js';
import { BASHO_DAYS, RANKS, arenaUnlocked, bashoOver, career, closeBasho, syncArenas } from '../game/career.js';
import { ARENAS, arenaById, bashoOf, firstBashoFor } from '../game/arenalist.js';
import { arenaPreview } from '../render/arenas.js';
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
  // Arènes : pour les combats hors carrière (en carrière, chaque basho a la sienne)
  syncArenas();
  const pick = save.arena || 'ryogoku';
  const agrid = el('div', 'swatches arenas');
  const choose = id => { save.arena = id; persist(); Sound.click(); wardrobe(backFn); };
  for (const A of ARENAS) {
    const ok = arenaUnlocked(A.id);
    const b = el('button', 'swatch' + (pick === A.id ? ' sel' : ''));
    b.type = 'button'; b.title = A.desc;
    b.append(arenaPreview(A.id), el('span', null, A.name),
      el('small', null, !ok ? `Basho ${firstBashoFor(A.id)} en carrière` : pick === A.id ? 'Choisie' : A.season));
    b.disabled = !ok;
    b.addEventListener('click', () => choose(A.id));
    agrid.append(b);
  }
  const rnd = el('button', 'swatch dice' + (pick === 'hasard' ? ' sel' : ''));
  rnd.type = 'button';
  rnd.append(el('span', 'dice-face', '?'), el('span', null, 'Au hasard'), el('small', null, pick === 'hasard' ? 'Choisie' : 'Parmi les tiennes'));
  rnd.addEventListener('click', () => choose('hasard'));
  agrid.append(rnd);
  showScreen({
    kanji: '締込',
    title: 'Vestiaire',
    lead: 'Choisis ta ceinture et ton arène. Monte au banzuke en carrière pour débloquer des ceintures ; chaque nouveau basho fait découvrir une arène.',
    body: [el('p', 'sub-h', 'Ceinture'), grid, el('p', 'sub-h', 'Arène (hors carrière : chaque basho a la sienne)'), agrid, list(mbtn('Retour', null, false, backFn, 'quiet'))],
    focus: '.swatch.sel',
    back: backFn,
  });
}

function careerHub() {
  const c = career(), b = c.basho;
  // basho fini mais pas encore clos (page fermée avant « Voir le classement ») : on le clôt d'abord
  if (bashoOver(c)) { bashoEnd(); return; }
  syncArenas();
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
    lead: `Basho ${c.bashoNo} : ${bashoOf(c.bashoNo).name}, à ${bashoOf(c.bashoNo).city} (${arenaById(bashoOf(c.bashoNo).arena).name.toLowerCase()}). Gagne au moins ${Math.floor(BASHO_DAYS / 2) + 1} combats sur ${BASHO_DAYS} pour monter au rang suivant.`,
    body: [ranks, recordEl(b.results, b.day), vs,
      list(mbtn('Combattre', 'Une manche, comme au vrai sumo', true, () => startMatch({ mode: 'career', opp: o })), row, reset)],
    back: menu,
  });
}

function careerBoutResult(won) {
  const c = career(), b = c.basho;
  if (bashoOver(c)) { bashoEnd(); return; }          // les 7 combats sont déjà joués : rien à ajouter
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
  if (!bashoOver(career())) { careerHub(); return; }  // déjà clos (double appui) : retour au basho en cours
  const { wins, results, verdict, cls, unlocked, newArenas: fresh } = closeBasho();
  const c = career();
  const newArenas = fresh.map(id => arenaById(id).name);
  const rk = RANKS[c.rank];
  const nb = bashoOf(c.bashoNo);
  showScreen({
    kanji: rk.kanji,
    title: rk.name,
    lead: `Fin du basho : ${wins} victoire${wins > 1 ? 's' : ''} sur ${BASHO_DAYS}.`,
    body: [
      el('p', 'verdict ' + cls, verdict),
      recordEl(results, -1),
      unlocked.length ? el('p', 'unlock', `Nouvelle${unlocked.length > 1 ? 's' : ''} ceinture${unlocked.length > 1 ? 's' : ''} au vestiaire : ${unlocked.map(s => s.name).join(', ')}.`) : null,
      newArenas.length ? el('p', 'unlock', `Nouvelle arène au vestiaire : ${newArenas.join(', ')}.`) : null,
      list(mbtn('Basho suivant', `${nb.name}, ${nb.city}`, true, careerHub), unlocked.length || newArenas.length ? mbtn('Vestiaire', null, false, () => wardrobe(careerHub), 'quiet') : null),
    ],
  });
}

export { careerBoutResult, careerHub, wardrobe };
