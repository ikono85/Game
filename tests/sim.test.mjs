// Tests de la simulation de Dohyō Duel (src/sim/), sans navigateur.
// Lancer : npm test   (ou : node --test tests/sim.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, step, hashState, NOCMD, canUtchari } from '../src/sim/simulation.js';
import { aiCommand, makeProfile, STYLES } from '../src/sim/ai.js';

const D = { newMatch, step, aiCommand, makeProfile, hashState, NOCMD, STYLES, canUtchari };

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

/** Un dash lancé à « distance » de l'adversaire, qui garde de face sans bouger. Bloqué ? */
function dashIntoGuard(distance) {
  const S = D.newMatch({ seed: 1, win: 1, ai: [null, null] });
  S.phase = 'play'; S.roundT = 2;
  S.p[0].x = S.p[0].px = 704 - distance / 2; S.p[1].x = S.p[1].px = 704 + distance / 2;
  S.p[0].face = 0; S.p[1].face = Math.PI;
  let blocked = false;
  for (let n = 0; n < 120; n++) {
    D.step(S, [{ ...D.NOCMD, mx: 1, dash: n === 0 }, { ...D.NOCMD, guard: true }]);
    if (S.events.some(e => e.type === 'block' && e.who === 1)) blocked = true;
    S.events.length = 0;
  }
  return blocked;
}

test('garde : une charge lancée de loin reste bloquable si elle arrive encore lancée', () => {
  for (const d of [120, 200, 260]) assert.ok(dashIntoGuard(d), `dash à ${d} px non bloqué`);
  assert.ok(!dashIntoGuard(340), 'une charge essoufflée (340 px) ne compte plus comme un dash');
});

/**
 * Le bleu charge le rouge depuis 200 px ; le rouge fait (ou pas) un pas de côté quand la distance
 * passe sous « at ». bleuFeinte : le bleu feinte au lieu de dasher. Renvoie les événements.
 */
function henkaScene({ at = 160, edge = false, bleuFeinte = false, side = true } = {}) {
  const S = D.newMatch({ seed: 1, win: 1, ai: [null, null] });
  S.phase = 'play'; S.roundT = 2;
  const x0 = edge ? 704 - 330 : 704 - 60;
  S.p[0].x = S.p[0].px = x0; S.p[1].x = S.p[1].px = x0 + 200; S.p[0].face = 0; S.p[1].face = Math.PI;
  const ev = [];
  let done = false;
  for (let n = 0; n < 240; n++) {
    const d = S.p[1].x - S.p[0].x;
    const go = !done && d < at;
    if (go) done = true;
    D.step(S, [go ? { ...D.NOCMD, mx: side ? 0 : 1, my: side ? 1 : 0, dash: true } : D.NOCMD,
      { ...D.NOCMD, mx: -1, dash: !bleuFeinte && n === 0, feint: bleuFeinte && n === 0 }]);
    ev.push(...S.events); S.events.length = 0;
  }
  return ev;
}

test('henka : un pas de côté sur une vraie charge la fait passer dans le vide', () => {
  const ev = henkaScene({ at: 160 });
  assert.ok(ev.some(e => e.type === 'henka' && e.who === 0));
  assert.ok(ev.some(e => e.type === 'henkaWhiff' && e.who === 0));
  assert.ok(!ev.some(e => e.type === 'hit' && e.force > 250), 'il ne doit pas me toucher');
});

test('henka : au bord, il sort emporté par son élan (hatakikomi)', () => {
  const win = henkaScene({ at: 160, edge: true }).find(e => e.type === 'roundWin');
  assert.equal(win && win.who, 0);
  assert.equal(win.kimarite, 'hatakikomi');
});

test('henka : contre une feinte ou dash droit devant, pas de henka', () => {
  assert.ok(!henkaScene({ at: 140, bleuFeinte: true }).some(e => e.type === 'henka'), 'feinte');
  assert.ok(!henkaScene({ at: 160, side: false }).some(e => e.type === 'henka'), 'tout droit');
});

test('henka : trop tard (déjà au contact), c\'est un dash normal', () => {
  assert.ok(!henkaScene({ at: 80 }).some(e => e.type === 'henka'));
});

test('kimarite : une charge qui sort l\'adversaire est un oshidashi', () => {
  const S = D.newMatch({ seed: 1, win: 1, ai: [null, null] });
  S.phase = 'play'; S.roundT = 2;
  S.p[0].x = S.p[0].px = 704 + 140; S.p[1].x = S.p[1].px = 704 + 300; S.p[0].face = 0; S.p[1].face = Math.PI;
  let win = null;
  for (let n = 0; n < 240 && !win; n++) {
    D.step(S, [{ ...D.NOCMD, mx: 1, dash: n === 0 }, D.NOCMD]);
    win = S.events.find(e => e.type === 'roundWin'); S.events.length = 0;
  }
  assert.equal(win && win.kimarite, 'oshidashi');
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

// --- Hanches basses : contre de l'utchari ---
function utchariThenGuard(guardAtTicksAfterStart, holdGuardBefore = false) {
  const { S, p, o } = pinned(6, false);
  const seen = [];
  let start = -1;
  for (let n = 0; n < 300 && S.phase !== 'matchEnd'; n++) {
    let c0 = { ...D.NOCMD, mx: -1 };
    if (start < 0 && D.canUtchari(S, 0)) c0 = { ...c0, dash: true };
    const k = start < 0 ? -1 : n - start;
    const g = holdGuardBefore ? (start < 0 ? n > 30 : true) : k === guardAtTicksAfterStart || (k > guardAtTicksAfterStart && k < guardAtTicksAfterStart + 20);
    D.step(S, [c0, { ...D.NOCMD, mx: start < 0 ? 1 : 0, dash: n === 2, guard: g && (start >= 0 || holdGuardBefore) }]);
    for (const e of S.events) { seen.push(e.type); if (e.type === 'utchariStart') start = n; }
    S.events.length = 0;
  }
  return seen;
}

test('hanches basses : garder pendant le soulevé fait échouer l\'utchari', () => {
  const seen = utchariThenGuard(20);                 // 20 ticks ≈ 0,17 s après le début
  assert.ok(seen.includes('utchariStart') && seen.includes('utchariCounter'), seen.join(' '));
  assert.ok(!seen.includes('utchari'));
});

test('hanches basses : trop tard, l\'utchari passe', () => {
  const seen = utchariThenGuard(40);                 // 0,33 s : le soulevé (0,28 s) est fini
  assert.ok(seen.includes('utchari') && !seen.includes('utchariCounter'), seen.join(' '));
});

// --- En ligne : le netcode à rollback repose sur ces propriétés de la simulation ---
function randomCmds(seed, n) {
  const R = { seed };
  const rnd = () => { let t = (R.seed = (R.seed + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const one = () => ({ mx: Math.round(rnd() * 200 - 100), my: Math.round(rnd() * 200 - 100), dash: rnd() < 0.02, feint: rnd() < 0.01, guard: rnd() < 0.15 });
  return Array.from({ length: n }, () => [one(), one()]);
}
function straight(seed, cmds) {
  const S = D.newMatch({ seed, win: 5, ai: [null, null] });
  for (const c of cmds) { D.step(S, c); S.events.length = 0; }
  return D.hashState(S);
}

test('rollback : revenir à un état copié puis resimuler redonne exactement la même partie', () => {
  const cmds = randomCmds(77, 6000), ref = straight(3, cmds);
  const S0 = D.newMatch({ seed: 3, win: 5, ai: [null, null] });
  let S = S0;
  const snaps = new Map([[0, structuredClone(S)]]);
  for (let t = 1; t <= cmds.length; t++) {
    // de temps en temps on simule 12 ticks avec de fausses commandes adverses (prédiction ratée)…
    if (t % 97 === 0 && t + 12 <= cmds.length) {
      for (let k = 0; k < 12; k++) { D.step(S, [cmds[t - 1 + k][0], { mx: 0, my: 0, dash: true, feint: false, guard: false }]); S.events.length = 0; }
      // … puis on revient à l'état sauvegardé avant l'erreur
      S = structuredClone(snaps.get(t - 1));
    }
    D.step(S, cmds[t - 1]); S.events.length = 0;
    snaps.set(t, structuredClone(S));
  }
  assert.equal(D.hashState(S), ref);
});

test('synchro de l\'hôte : un état passé par JSON continue la même partie', () => {
  const cmds = randomCmds(91, 5000), ref = straight(11, cmds);
  let S = D.newMatch({ seed: 11, win: 5, ai: [null, null] });
  for (let t = 1; t <= cmds.length; t++) {
    D.step(S, cmds[t - 1]); S.events.length = 0;
    if (t % 60 === 0) S = JSON.parse(JSON.stringify(S));     // ce que l'invité reçoit de l'hôte
  }
  assert.equal(D.hashState(S), ref);
});
