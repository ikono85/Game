// Tests des ralentis partageables (src/game/replayfile.js), sans navigateur.
// Lancer : npm test   (ou : node --test tests/replay.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, step } from '../src/sim/simulation.js';
import { aiCommand, makeProfile } from '../src/sim/ai.js';
import { localCmd, packIn, unpackIn } from '../src/sim/cmd.js';
import { decodeReplay, encodeReplay, newPlayback, newRecorder, playbackStep, recordTick, replayReady } from '../src/game/replayfile.js';

// empreinte de la partie (positions, vitesses, score), sans la graine que l'IA consomme
const hashState = S => JSON.stringify([S.tick, S.score, S.round, Math.round(S.ring * 1000), S.p.map(p => [p.x, p.y, p.vx, p.vy, p.face, p.stamina].map(v => Math.round(v * 1000)))]);

/** Un match joué comme dans le jeu : commandes compactées, enregistrées tick par tick. */
function recordMatch(seed, a, b, win = 3, human = false) {
  const S = newMatch({ seed, win, ai: [makeProfile(a, 0.7), makeProfile(b, 0.7)] });
  const R = newRecorder(S, { mode: 'ai', names: ['Rouge', 'Tetsuiwa'], skins: ['rouge', 'blue'], win,
    ai: [human ? null : { style: a, level: 0.7 }, { style: b, level: 0.7 }] });
  let k = 0;
  // un « humain » scripté pour le joueur 1 : il tourne autour, dashe et garde de temps en temps
  const humanCmd = () => { k++; const p = S.p[0], o = S.p[1]; return { mx: o.x - p.x + Math.sin(k / 40) * 120, my: o.y - p.y, dash: k % 157 === 0, feint: k % 211 === 0, guard: k % 300 < 40 }; };
  const hashes = [];
  for (let n = 0; S.phase !== 'matchEnd' && n < 120 * 900; n++) {
    const v = [localCmd(human ? humanCmd() : aiCommand(S, 0)), localCmd(aiCommand(S, 1))];
    const rn0 = S.rn;
    step(S, [unpackIn(v[0]), unpackIn(v[1])]);
    recordTick(R, S, v, rn0);
    if (S.rn !== rn0 || S.phase === 'matchEnd') hashes.push(hashState(S));
    S.events.length = 0;
  }
  return { S, R, hashes };
}
function play(R) {
  const P = newPlayback(R), hashes = [];
  for (let n = 0; P.S.phase !== 'matchEnd' && n < 120 * 900; n++) {
    const rn0 = P.S.rn;
    playbackStep(P);
    if (P.S.rn !== rn0 || P.S.phase === 'matchEnd') hashes.push(hashState(P.S));
    P.S.events.length = 0;
  }
  return { P, hashes };
}

test('ralenti : le lien rejoue exactement le même match', async () => {
  for (const [seed, a, b, human] of [[3, 'kitsune', 'yokozuna', false], [11, 'oshi', 'mai', true], [29, 'kabe', 'kitsune', true]]) {
    const { S, R, hashes } = recordMatch(seed, a, b, 3, human);
    assert.ok(replayReady(R));
    const text = await encodeReplay(R);
    assert.match(text, /^[A-Za-z0-9_-]+$/);
    const back = await decodeReplay(text);
    const { P, hashes: h2 } = play(back);
    assert.deepEqual(h2, hashes, `${a} contre ${b} : le ralenti diverge`);
    assert.deepEqual(P.S.score, S.score);
    assert.equal(P.S.matchWinner, S.matchWinner);
    assert.equal(P.diverged, 0);
    assert.deepEqual(back.meta.names, ['Rouge', 'Tetsuiwa']);
  }
});

test('ralenti : un combat qui dérive repart juste à la manche suivante', async () => {
  const { S, R } = recordMatch(5, 'mai', 'kitsune', 3, true);
  const back = await decodeReplay(await encodeReplay(R));
  back.rounds[0].c[0] = back.rounds[0].c[0].map(() => packIn({ mx: 0, my: 0, dash: false, feint: false, guard: false }));   // rouge ne bouge plus en manche 1
  const { P } = play(back);
  assert.equal(P.S.phase, 'matchEnd');
  assert.deepEqual(P.S.score, S.score);                  // le score final reste celui du vrai match
  assert.equal(P.S.matchWinner, S.matchWinner);
});

test('ralenti : lien abîmé ou d\'une autre version refusé proprement', async () => {
  await assert.rejects(decodeReplay('pas un lien'));
  await assert.rejects(decodeReplay('AAAAAAAAAAAAAAAA'));
  const { R } = recordMatch(8, 'oshi', 'oshi', 1);
  const text = await encodeReplay(R);
  await assert.rejects(decodeReplay(text.slice(0, text.length - 6)));
});
