// Tests de la simulation de Dohyō Duel, extraite directement de index.html.
// Lancer : node --test tests/sim.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadSim() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const a = html.indexOf("'use strict';"), b = html.indexOf('// 4. PRÉSENTATION');
  assert.ok(a > 0 && b > a, 'sections de simulation introuvables dans index.html');
  const src = html.slice(a, b) + '\nreturn { newMatch, step, aiCommand, makeProfile, hashState, NOCMD, STYLES };';
  return new Function('document', src)({ getElementById: () => null });
}
const D = loadSim();

function playAI(seed, a, b, win = 3, maxSec = 600) {
  const S = D.newMatch({ seed, win, ai: [D.makeProfile(a, 0.6), D.makeProfile(b, 0.6)] });
  for (let n = 0; S.phase !== 'matchEnd' && n < 120 * maxSec; n++) {
    D.step(S, [D.aiCommand(S, 0), D.aiCommand(S, 1)]);
    S.events.length = 0;
  }
  return S;
}

test('déterminisme : même graine + mêmes commandes = même état', () => {
  for (const seed of [1, 42, 123456]) {
    assert.equal(D.hashState(playAI(seed, 'kitsune', 'yokozuna')), D.hashState(playAI(seed, 'kitsune', 'yokozuna')));
  }
});

test('des graines différentes donnent des parties différentes', () => {
  assert.notEqual(D.hashState(playAI(1, 'mai', 'oshi')), D.hashState(playAI(2, 'mai', 'oshi')));
});

test('chaque style d\'IA termine un match en une manche', () => {
  for (const s of Object.keys(D.STYLES)) {
    const S = playAI(7, s, 'oshi', 1, 180);
    assert.equal(S.phase, 'matchEnd', `${s} ne termine pas`);
    assert.ok(S.score[S.matchWinner] === 1);
  }
});

test('faux départ (matta) : dasher avant le signal fige le lutteur', () => {
  const S = D.newMatch({ seed: 5, win: 1, ai: [null, null] });
  D.step(S, [{ ...D.NOCMD, dash: true }, D.NOCMD]);
  assert.equal(S.p[0].matta, true);
  while (S.phase === 'shikiri') D.step(S, [D.NOCMD, D.NOCMD]);
  assert.ok(S.p[0].stun > 0, 'le joueur fautif doit être figé au signal');
  assert.equal(S.p[1].stun, 0);
});

test('tachiai : un dash juste après le signal pousse plus fort', () => {
  const run = delayTicks => {
    const S = D.newMatch({ seed: 9, win: 1, ai: [null, null] });
    while (S.phase === 'shikiri') D.step(S, [D.NOCMD, D.NOCMD]);
    for (let i = 0; i < delayTicks; i++) D.step(S, [D.NOCMD, D.NOCMD]);
    D.step(S, [{ ...D.NOCMD, dash: true }, D.NOCMD]);
    return Math.hypot(S.p[0].vx, S.p[0].vy);
  };
  assert.ok(run(5) > run(120) * 1.15);
});

test('le cercle rétrécit jusqu\'au minimum puis s\'arrête', () => {
  const S = D.newMatch({ seed: 3, win: 1, ai: [null, null] });
  for (let n = 0; n < 120 * 60; n++) D.step(S, [D.NOCMD, D.NOCMD]);
  assert.equal(S.ring, 170);
});
