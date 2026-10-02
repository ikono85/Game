/**
 * Bandeau du haut : noms, manches gagnées, jauges de dash et de garde, état de la manche.
 */
import { G } from '../game/state.js';
import { netHud } from '../net/screens.js';
import { DASH_CD, GUARD_MAX, RMIN, SHRINK_DELAY } from '../sim/constants.js';
import { $ } from './dom.js';

const hudEls = { d1: $('d1'), d2: $('d2'), g1: $('g1'), g2: $('g2'), status: $('status'), n1: $('n1'), n2: $('n2') };
const rankEls = document.querySelectorAll('.who .rank');
function setNames(n1, r1, n2, r2) {
  hudEls.n1.textContent = n1; hudEls.n2.textContent = n2;
  rankEls[0].textContent = r1; rankEls[1].textContent = r2;
}
function updateScore() {
  const S = G.screen === 'match' ? G.S : null;
  const win = S ? S.win : 3, score = S ? S.score : [0, 0];
  [['st1', 0], ['st2', 1]].forEach(([id, i]) => {
    $(id).replaceChildren(...Array.from({ length: win }, (_, k) => {
      const d = document.createElement('span');
      d.className = 'star' + (k < score[i] ? ' on' : '');
      return d;
    }));
  });
  $('roundNo').textContent = S ? S.round : 1;
}
function hud() {
  const S = G.screen === 'match' ? G.S : null;
  [[0, 'd1', 'g1'], [1, 'd2', 'g2']].forEach(([i, d, g]) => {
    const p = S ? S.p[i] : null;
    const cd = p ? p.cd : 0, st = p ? p.stamina : GUARD_MAX, br = p ? p.guardCd > 0 : false;
    hudEls[d].style.transform = `scaleX(${1 - cd / DASH_CD})`;
    hudEls[d].classList.toggle('ready', cd <= 0);
    hudEls[g].style.transform = `scaleX(${st / GUARD_MAX})`;
    hudEls[g].classList.toggle('broken', br);
  });
  let st = '';
  if (S) {
    if (G.paused) st = 'En pause';
    else if (S.phase === 'shikiri') st = 'Attends le signal…';
    else if (S.phase === 'play') st = S.roundT < SHRINK_DELAY ? `Le cercle rétrécit dans ${Math.ceil(SHRINK_DELAY - S.roundT)}` : (S.ring > RMIN ? 'Le cercle rétrécit' : 'Cercle au minimum');
  }
  if (hudEls.status.textContent !== st) hudEls.status.textContent = st;
  netHud();
}

export { hud, setNames, updateScore };
