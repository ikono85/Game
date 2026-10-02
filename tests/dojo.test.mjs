// Tests des leçons du dojo (src/game/dojolessons.js), sans navigateur : chaque leçon se réussit
// en suivant la consigne, et ne se réussit pas en restant les bras croisés.
// Lancer : npm test   (ou : node --test tests/dojo.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../src/game/dojolessons.js';
import { newMatch, step, NOCMD, canUtchari } from '../src/sim/simulation.js';
import { localCmd, unpackIn } from '../src/sim/cmd.js';
import { UT_BRACE } from '../src/sim/constants.js';

const near = (S, d) => Math.hypot(S.p[1].x - S.p[0].x, S.p[1].y - S.p[0].y) < d;
// un joueur qui suit la consigne de chaque leçon (avec un temps de réaction humain)
const GOOD = {
  dash: S => ({ ...NOCMD, mx: S.p[1].x - S.p[0].x, my: S.p[1].y - S.p[0].y, dash: near(S, 250) }),
  tachiai: S => ({ ...NOCMD, dash: S.phase === 'play' && S.roundT > 0.18 && S.roundT < 0.2 }),
  garde: S => ({ ...NOCMD, guard: Math.hypot(S.p[1].vx, S.p[1].vy) > 250 && near(S, 230) }),
  feinte: (S, M) => {
    const c = { ...NOCMD, mx: S.p[1].x - S.p[0].x, my: S.p[1].y - S.p[0].y };
    if (M.f == null && near(S, 260)) { c.feint = true; M.f = S.tick; }
    if (M.f != null && S.tick > M.f + 100) c.dash = true;
    return c;
  },
  tawara: S => ({ ...NOCMD, mx: S.tick > 36 ? 1 : 0 }),
  utchari: (S, M) => { if (canUtchari(S, 0) && M.seen == null) M.seen = S.tick; return { ...NOCMD, mx: 1, dash: M.seen != null && S.tick - M.seen > 30 }; },
  hanches: S => ({ ...NOCMD, mx: 1, guard: S.p[1].utT >= 0.12 && S.p[1].utT < UT_BRACE }),
};
function attempt(L, player, maxSec = 12) {
  const D = {}, M = {};
  let S;
  const setup = () => { S = newMatch({ seed: 4, win: 99, ai: [null, null] }); S.events.length = 0; L.setup(S, D); };
  setup();
  for (let n = 0; n < 120 * maxSec; n++) {
    if (!L.shikiri) S.roundT = Math.min(S.roundT, 2);
    step(S, [unpackIn(localCmd(player(S, M))), unpackIn(localCmd(L.dummy(S, D)))]);
    const ev = S.events.slice(); S.events.length = 0;
    const r = L.check(S, ev, D);
    if (r && (r.ok || r.fail)) return r.ok ? 'ok' : 'fail';
    if (r && r.reset) setup();                    // comme dans le jeu : on remet en place, les réussites restent
  }
  return 'rien';
}

test('dojo : chaque leçon se réussit en suivant la consigne', () => {
  for (const L of LESSONS) {
    assert.ok(GOOD[L.id], `pas de joueur scripté pour ${L.id}`);
    assert.equal(attempt(L, GOOD[L.id]), 'ok', `leçon ${L.id}`);
  }
});

test('dojo : rester immobile ne réussit aucune leçon', () => {
  for (const L of LESSONS) assert.notEqual(attempt(L, () => NOCMD), 'ok', `leçon ${L.id}`);
});
