// Tests de la saisie de la ceinture (mawashi), sans navigateur.
// Lancer : npm test   (ou : node --test tests/grab.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, step, hashState, NOCMD } from '../src/sim/simulation.js';
import { aiCommand, makeProfile } from '../src/sim/ai.js';
import { localCmd, packIn, unpackIn } from '../src/sim/cmd.js';
import { C, CLINCH_MAX, PI, R0 } from '../src/sim/constants.js';

/** Deux lutteurs face à face, collés (ou à `gap` du contact), le combat déjà lancé. */
function scene(gap = 4, ax = C - 60) {
  const S = newMatch({ seed: 9, win: 9, ai: [null, null] });
  S.phase = 'play'; S.roundT = 2;
  const put = (p, x, face) => { p.x = p.px = x; p.y = p.py = C; p.face = face; p.vx = p.vy = 0; p.usedTachiai = true; };
  put(S.p[0], ax, 0); put(S.p[1], ax + S.p[0].r + S.p[1].r + gap, PI);
  S.events.length = 0;
  return S;
}
const run = (S, n, f) => { const ev = []; for (let k = 0; k < n; k++) { step(S, f(S, k)); ev.push(...S.events); S.events.length = 0; } return ev; };
const cmd = o => ({ ...NOCMD, ...o });

test('saisie : la touche passe dans la commande compactée', () => {
  assert.equal(unpackIn(packIn(cmd({ grab: true }))).grab, true);
  assert.equal(unpackIn(localCmd(cmd({ mx: 1, grab: true }))).grab, true);
  assert.equal(unpackIn(packIn(NOCMD)).grab, false);
});

test('saisie : au contact et de face, les deux lutteurs sont liés', () => {
  const S = scene();
  const ev = run(S, 30, (S, k) => [cmd({ grab: k === 0 }), NOCMD]);
  assert.ok(ev.some(e => e.type === 'grab' && e.who === 0));
  assert.ok(S.clinch && S.clinch.a === 0);
  const d = Math.hypot(S.p[1].x - S.p[0].x, S.p[1].y - S.p[0].y);
  assert.ok(Math.abs(d - (S.p[0].r + S.p[1].r)) < 1, 'collés l\'un à l\'autre');
});

test('saisie : trop loin, la main se ferme dans le vide', () => {
  const S = scene(80);
  const ev = run(S, 5, (S, k) => [cmd({ grab: k === 0 }), NOCMD]);
  assert.ok(ev.some(e => e.type === 'grabMiss'));
  assert.equal(S.clinch, null);
});

test('saisie : la garde ne l\'arrête pas, une charge si', () => {
  const S = scene();
  run(S, 3, (S, k) => [cmd({ grab: k === 2 }), cmd({ guard: true })]);
  assert.ok(S.clinch, 'garde levée : saisi quand même');
  const T = scene(40);
  const ev = run(T, 12, (S, k) => [cmd({ grab: k === 6 }), cmd({ mx: -1, dash: k === 0 })]);
  assert.ok(ev.some(e => e.type === 'grabFail' && e.who === 0), 'il charge : la saisie échoue');
  assert.ok(!ev.some(e => e.type === 'grab'));
});

test('ceinture : en poussant, celui qui tient sort l\'autre (yorikiri)', () => {
  const S = scene(4, C + R0 - 200);
  const ev = run(S, 300, (S, k) => [cmd({ mx: 1, grab: k === 0 }), NOCMD]);
  const w = ev.find(e => e.type === 'roundWin');
  assert.ok(w && w.who === 0 && w.kimarite === 'yorikiri', JSON.stringify(w));
});

test('ceinture : la projection envoie l\'autre sur le côté, et dehors près du bord (uwatenage)', () => {
  const S = scene(4, C + R0 - 160);
  const ev = run(S, 240, (S, k) => [cmd({ grab: k === 0, dash: k === 10 }), NOCMD]);
  assert.ok(ev.some(e => e.type === 'throwStart' && e.who === 0));
  assert.ok(ev.some(e => e.type === 'throw' && e.who === 0));
  const w = ev.find(e => e.type === 'roundWin');
  assert.ok(w && w.who === 0 && w.kimarite === 'uwatenage', JSON.stringify(w));
});

test('ceinture : hanches basses pendant l\'élan font échouer la projection', () => {
  const S = scene();
  const ev = run(S, 60, (S, k) => [cmd({ grab: k === 0, dash: k === 10 }), cmd({ guard: k === 18 })]);
  assert.ok(ev.some(e => e.type === 'throwCounter' && e.who === 1));
  assert.ok(!ev.some(e => e.type === 'throw'));
  assert.equal(S.clinch, null);
  assert.ok(S.p[0].stun > 0 || ev.some(e => e.type === 'throwCounter'));
});

test('ceinture : le tenu se dégage d\'un coup d\'épaule (dash)', () => {
  const S = scene();
  const ev = run(S, 20, (S, k) => [cmd({ grab: k === 0 }), cmd({ dash: k === 8 })]);
  assert.ok(ev.some(e => e.type === 'grabBreak' && e.who === 1));
  assert.equal(S.clinch, null);
});

test('ceinture : sur la paille, le dash du tenu est un utchari', () => {
  const S = scene(4, C - R0 + 30);                     // le rouge tient, le bleu… est au centre ; on inverse
  S.p[1].x = S.p[1].px = C - R0 + 14; S.p[1].face = 0;
  S.p[0].x = S.p[0].px = S.p[1].x + 80; S.p[0].face = PI;
  const ev = run(S, 160, (S, k) => [cmd({ mx: -1, grab: k === 0 }), cmd({ mx: 1, dash: k === 10 })]);
  assert.ok(ev.some(e => e.type === 'utchariStart' && e.who === 1), 'utchari lancé depuis la ceinture');
});

test('ceinture : personne ne cède, on se sépare au bout du temps', () => {
  const S = scene();
  const ev = run(S, Math.ceil(CLINCH_MAX * 120) + 5, (S, k) => [cmd({ mx: 1, grab: k === 0 }), cmd({ mx: -1, guard: true })]);
  assert.ok(ev.some(e => e.type === 'grabRelease'));
  assert.equal(S.clinch, null);
});

test('ceinture : déterminisme et IA qui s\'en servent', () => {
  const play = () => {
    const S = newMatch({ seed: 77, win: 3, ai: [makeProfile('kabe', 0.8), makeProfile('yokozuna', 0.8)] });
    let grabs = 0;
    for (let n = 0; S.phase !== 'matchEnd' && n < 120 * 400; n++) {
      step(S, [unpackIn(localCmd(aiCommand(S, 0))), unpackIn(localCmd(aiCommand(S, 1)))]);
      grabs += S.events.filter(e => e.type === 'grab').length; S.events.length = 0;
    }
    return [hashState(S), grabs, S.phase];
  };
  const a = play(), b = play();
  assert.deepEqual(a, b);
  assert.equal(a[2], 'matchEnd');
  assert.ok(a[1] > 0, 'les IA saisissent la ceinture');
});
