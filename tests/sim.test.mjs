// Tests de la simulation de Dohyō Duel, extraite directement de index.html.
// Lancer : node --test tests/sim.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadSim() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const a = html.indexOf("'use strict';"), b = html.indexOf('// 4. PRÉSENTATION');
  assert.ok(a > 0 && b > a, 'sections de simulation introuvables dans index.html');
  const src = html.slice(a, b) + '\nreturn { newMatch, step, aiCommand, makeProfile, hashState, NOCMD, STYLES, canUtchari };';
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

test('temps de réaction : émis au premier dash après le signal, une seule fois', () => {
  const S = D.newMatch({ seed: 4, win: 1, ai: [null, null] });
  while (S.phase === 'shikiri') D.step(S, [D.NOCMD, D.NOCMD]);
  S.events.length = 0;
  for (let i = 0; i < 24; i++) D.step(S, [D.NOCMD, D.NOCMD]);      // 0,2 s d'attente
  D.step(S, [{ ...D.NOCMD, dash: true }, D.NOCMD]);
  const r = S.events.filter(e => e.type === 'reaction');
  assert.equal(r.length, 1);
  assert.ok(Math.abs(r[0].t - 25 / 120) < 1e-9 && r[0].perfect === true);
  S.events.length = 0;
  for (let i = 0; i < 200; i++) D.step(S, [D.NOCMD, D.NOCMD]);
  D.step(S, [{ ...D.NOCMD, dash: true }, D.NOCMD]);
  assert.equal(S.events.filter(e => e.type === 'reaction').length, 0);
});

// --- Tenir au bord et utchari ---
function edgeSetup(seed) {
  const S = D.newMatch({ seed, win: 1, ai: [null, null] });
  while (S.phase === 'shikiri') D.step(S, [D.NOCMD, D.NOCMD]);
  for (let i = 0; i < 200; i++) D.step(S, [D.NOCMD, D.NOCMD]);   // au-delà de la fenêtre du départ
  S.events.length = 0;
  return S;
}

test('tenir au bord : pousser vers le centre freine la sortie et vide la jauge', () => {
  const run = hold => {
    const S = edgeSetup(1), p = S.p[0];
    p.x = 704 + S.ring - 6; p.y = 704; p.vx = 330; p.vy = 0; p.face = Math.PI;
    S.p[1].x = 704 - 300;
    let minSt = p.stamina, n = 0, held = false;
    while (S.phase === 'play' && n < 60) {
      D.step(S, [{ ...D.NOCMD, mx: hold ? -1 : 0 }, D.NOCMD]);
      held = held || S.events.some(e => e.type === 'holdStart');
      S.events.length = 0; minSt = Math.min(minSt, p.stamina); n++;
    }
    return { out: S.phase !== 'play', held, minSt };
  };
  const without = run(false), withHold = run(true);
  assert.equal(without.out, true);
  assert.equal(withHold.out, false);
  assert.equal(withHold.held, true);
  assert.ok(withHold.minSt < 1.8);
});

test('utchari : en tenant, un dash sur le côté fait pivoter et sortir l\'attaquant', () => {
  const S = edgeSetup(2), p = S.p[0], o = S.p[1];
  p.x = 704 + S.ring - 3; p.y = 704; p.face = Math.PI; p.vx = p.vy = 0;
  o.x = p.x - 200; o.y = 704; o.face = 0; o.vx = o.vy = 0;
  const seen = [];
  let startTick = -1;
  for (let n = 0; n < 240 && S.phase !== 'matchEnd'; n++) {
    let c0 = { ...D.NOCMD, mx: -1 };
    const close = Math.hypot(o.x - p.x, o.y - p.y) < 95;            // collé à l'attaquant
    if (p.hold && p.holdTime > 0.04 && close && startTick < 0) { c0 = { ...D.NOCMD, my: 1, dash: true }; startTick = n; }
    D.step(S, [c0, n === 2 ? { ...D.NOCMD, mx: 1, dash: true } : { ...D.NOCMD, mx: 1 }]);
    for (const e of S.events) seen.push(e.type + (e.kimarite ? ':' + e.kimarite : ''));
    S.events.length = 0;
  }
  assert.ok(seen.includes('utchariStart') && seen.includes('utchari'));
  assert.ok(seen.includes('roundWin:utchari'));
  assert.equal(S.matchWinner, 0);
});

test('utchari impossible sans contact : c\'est un simple dash', () => {
  const S = edgeSetup(3), p = S.p[0];
  p.x = 704 + S.ring - 3; p.y = 704; p.vx = 300; p.face = Math.PI;
  S.p[1].x = 704 - 300;
  for (let n = 0; n < 6; n++) D.step(S, [{ ...D.NOCMD, mx: -1 }, D.NOCMD]);
  S.events.length = 0;
  D.step(S, [{ ...D.NOCMD, my: 1, dash: true }, D.NOCMD]);
  assert.ok(S.events.some(e => e.type === 'dash'));
  assert.ok(!S.events.some(e => e.type === 'utchariStart'));
});

function pinned(seed, attackerGuard) {
  // le rouge tient au bord, le bleu arrive dessus en dash (garde levée ou non au contact)
  const S = edgeSetup(seed), p = S.p[0], o = S.p[1];
  p.x = 704 + S.ring - 3; p.y = 704; p.face = Math.PI; p.vx = p.vy = 0;
  o.x = p.x - 200; o.y = 704; o.face = 0; o.vx = o.vy = 0;
  return { S, p, o, attackerGuard };
}
function playPinned({ S, p, o, attackerGuard }, dashCmd) {
  const seen = [];
  let fired = false;
  for (let n = 0; n < 240 && S.phase !== 'matchEnd'; n++) {
    let c0 = { ...D.NOCMD, mx: -1 };
    // le joueur réagit dès que l'invite « Utchari » apparaît (ou, garde levée en face, quand il est collé)
    const now = D.canUtchari(S, 0) || (attackerGuard && n > 22 && Math.hypot(o.x - p.x, o.y - p.y) < 110);
    if (!fired && now) { c0 = { ...c0, ...dashCmd, dash: true }; fired = true; }
    const near = Math.hypot(o.x - p.x, o.y - p.y) < 140;
    D.step(S, [c0, { ...D.NOCMD, mx: 1, dash: n === 2, guard: attackerGuard && near && n > 12 }]);
    for (const e of S.events) seen.push(e.type + (e.kimarite ? ':' + e.kimarite : ''));
    S.events.length = 0;
  }
  return seen;
}

test('utchari : un dash tout droit suffit (la direction choisit seulement le sens du pivot)', () => {
  const seen = playPinned(pinned(4, false), { mx: -1, my: 0 });
  assert.ok(seen.includes('utchari'), seen.join(' '));
});

test('utchari : impossible contre un attaquant qui pousse garde levée', () => {
  const seen = playPinned(pinned(5, true), { mx: 0, my: 1 });
  assert.ok(!seen.includes('utchariStart'), seen.join(' '));
});
