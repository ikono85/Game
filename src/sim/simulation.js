/**
 * SIMULATION déterministe : pas fixe de 1/120 s, RNG seedé dont l'état vit dans la partie,
 * commandes par tick. Aucune dépendance au DOM ni à Math.random : même graine + mêmes commandes
 * = même partie. C'est ce qui rend possibles le ralenti, les tests et le jeu en ligne.
 */
import { aiMem } from './ai.js';
import {
  ACC, C, CHARGE_T, CHARGE_V, DASH_CD, HENKA_POWER, HENKA_RANGE, HENKA_SIDE, HENKA_STUN, HENKA_WINDOW, DASH_IMPULSE, DASH_T, DT, EDGE_ZONE, FEINT_CD, FEINT_IMPULSE, FEINT_T, FRICTION,
  GUARD_MAX, HOLD_BRAKE, HOLD_DRAIN, HOLD_MASS, MATTA_STUN, MAXV, PI, R0, RMIN, ROUND_END_T,
  SHRINK_DELAY, SHRINK_SPEED, TACHIAI_BONUS, TACHIAI_WINDOW, UT_BRACE, UT_COST, UT_FAIL_STUN,
  UT_SWING, UT_THROW, UT_TOTAL,
} from './constants.js';

// RNG mulberry32 dont l'état est un simple entier stocké dans S.seed :
// l'état complet de la partie reste sérialisable (utile pour le réseau / replays).
function rand(S) {
  let t = (S.seed = (S.seed + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function makePlayer(x, y, face) {
  return { x, y, px: x, py: y, vx: 0, vy: 0, r: 38, face, cd: 0, dashT: 0, dashAge: 9, guard: false,
    stamina: GUARD_MAX, guardCd: 0, fakeT: 0, fakeCd: 0, stun: 0, squash: 0, walk: 0,
    breath: 0, fallT: -1, matta: false, usedTachiai: false,
    hold: false, holdTick: -99, holdTime: 0,                      // tenue au bord
    utT: -1, utS: 1, utMx: 0, utMy: 0, utFace: 0, thrown: false,  // utchari en cours (utT = temps écoulé)
    utReadyTick: -99, gIn: false,
    touchT: 9, henkaT: 0, whiffT: 9, lockT: 0 };                              // dernier contact, henka en cours, passé dans le vide                                // gIn : touche de garde au tick précédent                                             // dernier instant où l'utchari était possible
}

const NOCMD = Object.freeze({ mx: 0, my: 0, dash: false, feint: false, guard: false });

/** cfg : { seed, win, ai: [profil|null, profil|null] } */
function newMatch(cfg) {
  const S = { seed: cfg.seed | 0, tick: 0, score: [0, 0], round: 1, win: cfg.win,
    ai: cfg.ai || [null, null], mem: [null, null], events: [], phase: 'shikiri', phaseT: 0,
    winner: -1, matchWinner: -1, p: null, ring: R0, roundT: 0, signalAt: 0, rn: 0 };   // rn : numéro de manche jouée (égalités comprises)
  startRound(S);
  return S;
}

function startRound(S) {
  S.p = [makePlayer(C - 150, C, 0), makePlayer(C + 150, C, PI)];
  S.rn++;
  S.ring = R0; S.roundT = 0; S.phase = 'shikiri'; S.phaseT = 0; S.winner = -1;
  S.signalAt = 1.4 + rand(S) * 1.1;           // moment du « Hakkeyoi », imprévisible
  S.mem = [S.ai[0] ? aiMem() : null, S.ai[1] ? aiMem() : null];
  S.events.push({ type: 'roundStart', round: S.round });
}

function setGuard(p, want) {
  if (want && !p.guard && p.guardCd <= 0 && p.stamina > 0.2 && p.dashT <= 0 && p.stun <= 0) p.guard = true;
  else if (!want) p.guard = false;
}

function tryDash(S, i) {
  const p = S.p[i];
  if (p.cd > 0 || p.guard || p.stun > 0) return;
  let imp = DASH_IMPULSE;
  const perfect = !p.usedTachiai && S.roundT <= TACHIAI_WINDOW && !p.matta;
  if (perfect) {                                   // départ parfait
    imp *= TACHIAI_BONUS;
    S.events.push({ type: 'tachiai', who: i });
  }
  // temps de réaction : premier dash de la manche, peu après le signal
  if (!p.usedTachiai && !p.matta && S.roundT < 1.5) S.events.push({ type: 'reaction', who: i, t: S.roundT, perfect });
  p.usedTachiai = true;
  p.vx += Math.cos(p.face) * imp; p.vy += Math.sin(p.face) * imp;
  p.cd = DASH_CD; p.dashT = DASH_T; p.dashAge = 0;
  S.events.push({ type: 'dash', who: i, x: p.x - Math.cos(p.face) * p.r, y: p.y - Math.sin(p.face) * p.r });
}

// Feinte : même élan visuel qu'un dash, mais presque pas de poussée. Ne consomme pas le dash.
function tryFeint(S, i) {
  const p = S.p[i];
  if (p.fakeCd > 0 || p.guard || p.dashT > 0 || p.stun > 0) return;
  p.vx += Math.cos(p.face) * FEINT_IMPULSE; p.vy += Math.sin(p.face) * FEINT_IMPULSE;
  p.fakeT = FEINT_T; p.fakeCd = FEINT_CD;
  S.events.push({ type: 'feint', who: i, x: p.x - Math.cos(p.face) * p.r, y: p.y - Math.sin(p.face) * p.r });
}

function steer(p, ix, iy) {
  const n = Math.hypot(ix, iy);
  if (n > 0) {
    ix /= n; iy /= n;
    const acc = p.guard ? ACC * 0.12 : ACC;
    p.vx += ix * acc * DT; p.vy += iy * acc * DT;
    const target = Math.atan2(iy, ix);
    const diff = Math.atan2(Math.sin(target - p.face), Math.cos(target - p.face));
    p.face += diff * Math.min(1, DT * 12);
  }
}

function integrate(p) {
  const f = Math.exp(-(p.guard ? FRICTION * 2.6 : FRICTION) * DT);
  p.vx *= f; p.vy *= f;
  if (p.guard) {
    p.stamina -= DT;
    if (p.stamina <= 0) { p.guard = false; p.guardCd = 1.2; p.stamina = 0; }
  } else if (!p.hold) {
    p.stamina = Math.min(GUARD_MAX, p.stamina + DT * 0.8);
    p.guardCd = Math.max(0, p.guardCd - DT);
  }
  const sp = Math.hypot(p.vx, p.vy);
  const cap = p.dashT > 0 ? 900 : MAXV;
  if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
  p.x += p.vx * DT; p.y += p.vy * DT;
  p.cd = Math.max(0, p.cd - DT); p.dashT = Math.max(0, p.dashT - DT); p.dashAge += DT;
  p.touchT += DT; p.whiffT += DT; p.lockT = Math.max(0, p.lockT - DT);
  p.fakeT = Math.max(0, p.fakeT - DT); p.fakeCd = Math.max(0, p.fakeCd - DT);
  p.stun = Math.max(0, p.stun - DT);
  p.squash = Math.max(0, p.squash - DT * 4);
  p.walk += sp * DT / 45;
  p.breath += DT;
  if (p.fallT >= 0) p.fallT += DT;
}

// Poids effectif : le dash alourdit, la garde encore plus si le coup arrive de face
function mass(p, tx, ty) {
  if (p.guard) {
    const front = Math.cos(p.face) * tx + Math.sin(p.face) * ty;
    return front > 0.3 ? 5 : 1.3;          // de dos, la garde ne protège presque pas
  }
  if (p.hold) {                            // talons sur la paille : lourd seulement si on est poussé du côté du centre
    const ix = C - p.x, iy = C - p.y, il = Math.hypot(ix, iy) || 1;
    if ((tx * ix + ty * iy) / il > 0.3) return HOLD_MASS;
  }
  return p.dashT > 0 ? 2.2 : 1;
}

/** Tenir au bord : dans la zone des ballots, en poussant vers le centre, pendant qu'on est poussé. */
function updateHold(S, i, c) {
  const p = S.p[i], o = S.p[1 - i];
  const dx = p.x - C, dy = p.y - C, dist = Math.hypot(dx, dy) || 1;
  const ox = dx / dist, oy = dy / dist;                              // vers l'extérieur
  const inZone = dist > S.ring - EDGE_ZONE;
  const n = Math.hypot(c.mx, c.my);
  const inward = n > 0 && -(c.mx * ox + c.my * oy) / n > 0.5;        // à moins de 60° du centre
  const vout = p.vx * ox + p.vy * oy;
  const contact = Math.hypot(o.x - p.x, o.y - p.y) < p.r + o.r + 6;
  const can = inZone && inward && !p.guard && p.dashT <= 0 && p.stun <= 0 && p.guardCd <= 0 && p.stamina > 0 && p.utT < 0;
  if (can && (vout > 30 || contact)) {
    if (!p.hold) S.events.push({ type: 'holdStart', who: i, x: p.x + ox * p.r, y: p.y + oy * p.r });
    p.hold = true; p.holdTick = S.tick; p.holdTime += DT;
    p.stamina -= HOLD_DRAIN * DT;
    if (vout > 0) { const k = 1 - Math.exp(-HOLD_BRAKE * DT); p.vx -= ox * vout * k; p.vy -= oy * vout * k; }
    if (p.stamina <= 0) {                                            // plus de jauge : les talons glissent
      p.stamina = 0; p.guardCd = 1.2; p.hold = false;
      S.events.push({ type: 'slip', who: i, x: p.x + ox * p.r, y: p.y + oy * p.r });
    }
  } else {
    p.hold = false;
    if (!inZone) p.holdTime = 0;
  }
}

/**
 * L'utchari est prêt (sans regarder les touches) : je suis près des ballots, on me pousse ou je tenais
 * à l'instant, l'adversaire est collé et avance sur moi, et mon dash est disponible.
 * Sert à la simulation, à l'IA et à l'invite affichée au joueur.
 */
function utchariReady(S, i) {
  const p = S.p[i], o = S.p[1 - i];
  if (S.phase !== 'play' || p.utT >= 0 || o.utT >= 0 || p.cd > 0 || p.stun > 0 || p.guard || p.stamina < 0.15) return false;
  const ex = p.x - C, ey = p.y - C, dist = Math.hypot(ex, ey) || 1;
  if (dist < S.ring - 14) return false;                                 // il faut être sur les ballots
  const vout = (p.vx * ex + p.vy * ey) / dist;
  if (S.tick - p.holdTick > 24 && vout < 120) return false;             // je tiens (ou tenais à l'instant), ou on me repousse fort
  const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
  if (d > p.r + o.r + 60) return false;                                 // au corps à corps (les chocs font rebondir)
  const toward = (o.vx * -dx + o.vy * -dy) / d;
  const facing = (Math.cos(o.face) * -dx + Math.sin(o.face) * -dy) / d;
  if (o.guard && facing > 0.3) return false;                            // il pousse garde levée : bien campé, pas de prise
  return o.dashT > 0 || (toward > 60 && facing > 0.3);                  // il charge, ou il avance vraiment sur moi
}
/**
 * Au bord, quand on me pousse : Dash = utchari, quelle que soit la direction (elle choisit juste le sens du pivot).
 * Reste possible 0,45 s après le dernier instant favorable : le temps de voir l'invite et de réagir.
 */
function canUtchari(S, i) {
  const p = S.p[i], o = S.p[1 - i];
  if (S.phase !== 'play' || S.tick - p.utReadyTick > 54) return false;
  if (p.utT >= 0 || o.utT >= 0 || p.cd > 0 || p.stun > 0 || p.guard || p.stamina < 0.15) return false;
  if (o.guard && (Math.cos(o.face) * (p.x - o.x) + Math.sin(o.face) * (p.y - o.y)) > 0) return false;
  return Math.hypot(o.x - p.x, o.y - p.y) < p.r + o.r + 110 && Math.hypot(p.x - C, p.y - C) > S.ring - 50;
}
function startUtchari(S, i, c) {
  const p = S.p[i], o = S.p[1 - i];
  const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
  // sens du pivot : du côté où je pousse le stick ; sans direction de côté, du côté d'où il arrive
  let cross = (dx / d) * c.my - (dy / d) * c.mx;
  if (Math.abs(cross) < 0.25 * (Math.hypot(c.mx, c.my) || 1)) cross = -((dx / d) * o.vy - (dy / d) * o.vx) || -1;
  p.utS = cross > 0 ? -1 : 1;
  p.utT = 0; p.utMx = (p.x + o.x) / 2; p.utMy = (p.y + o.y) / 2;
  p.utFace = Math.atan2(dy, dx); p.face = p.utFace;
  p.hold = false; p.cd = DASH_CD; p.stamina = Math.max(0, p.stamina - UT_COST);
  p.vx = p.vy = o.vx = o.vy = 0; o.dashT = 0; o.guard = false;
  S.events.push({ type: 'utchariStart', who: i, x: p.utMx, y: p.utMy });
}
/** Utchari contré (hanches basses) : celui qui l'a tenté reste déséquilibré au bord, sans dash. */
function counterUtchari(S, i) {
  const p = S.p[i], o = S.p[1 - i];
  p.utT = -1; p.stun = UT_FAIL_STUN; p.hold = false;
  const ex = p.x - C, ey = p.y - C, el = Math.hypot(ex, ey) || 1;
  p.vx = ex / el * 120; p.vy = ey / el * 120;                         // il bascule vers les ballots
  o.guard = true;                                                     // l'adversaire est campé, garde levée
  S.events.push({ type: 'utchariCounter', who: 1 - i, x: (p.x + o.x) / 2, y: (p.y + o.y) / 2 });
}

/** Déroulé de l'utchari : appui, pivot des deux lutteurs autour du point de contact, puis projection. */
function updateUtchari(S, i) {
  const p = S.p[i], o = S.p[1 - i];
  if (p.utT < 0) return;
  const t0 = p.utT, t1 = p.utT + DT;
  p.utT = t1;
  if (t0 < UT_BRACE + UT_SWING) {
    p.vx = p.vy = o.vx = o.vy = 0;
    const a0 = Math.max(0, Math.min(UT_SWING, t0 - UT_BRACE)), a1 = Math.max(0, Math.min(UT_SWING, t1 - UT_BRACE));
    const da = p.utS * PI * (a1 - a0) / UT_SWING;
    if (da !== 0) {
      const cs = Math.cos(da), sn = Math.sin(da);
      for (const q of [p, o]) {
        const rx = q.x - p.utMx, ry = q.y - p.utMy;
        q.x = p.utMx + rx * cs - ry * sn; q.y = p.utMy + rx * sn + ry * cs;
      }
      o.face += da;
    }
    if (t1 >= UT_BRACE + UT_SWING) {                                  // lâcher : son élan l'emporte dehors
      const ox = o.x - C, oy = o.y - C, ol = Math.hypot(ox, oy) || 1;
      o.vx = ox / ol * UT_THROW; o.vy = oy / ol * UT_THROW;
      o.stun = 0.45; o.thrown = true;
      p.vx = -ox / ol * 140; p.vy = -oy / ol * 140;
      S.events.push({ type: 'utchari', who: i, x: o.x, y: o.y });
    }
  }
  if (t1 >= UT_TOTAL) { p.utT = -1; p.face = p.utFace + p.utS * PI; }
}
const swinging = p => p.utT >= 0 && p.utT < UT_BRACE + UT_SWING;

/**
 * Henka (pas de côté) : il me charge, il est tout près mais ne me touche pas encore, et je dashe sur le
 * côté (la direction choisie s'écarte nettement de la ligne entre nous). Mon dash part dans cette
 * direction, il me frôle sans me pousser, puis il est emporté par son élan. Contre une feinte, ça ne
 * marche pas : ce n'est pas une charge, mon dash part droit devant.
 */
function canHenka(S, i, c) {
  const p = S.p[i], o = S.p[1 - i];
  if (S.phase !== 'play' || p.cd > 0 || p.guard || p.stun > 0 || p.utT >= 0 || o.utT >= 0 || !charging(o)) return false;
  const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
  if (d > p.r + o.r + HENKA_RANGE || d < p.r + o.r + 8) return false;   // trop loin, ou déjà au contact
  const ux = dx / d, uy = dy / d;
  if (o.vx * ux + o.vy * uy < CHARGE_V) return false;               // il fonce vraiment sur moi
  const n = Math.hypot(c.mx, c.my);
  return n > 0 && Math.abs(ux * c.my - uy * c.mx) / n > HENKA_SIDE;
}
function startHenka(S, i, c) {
  const p = S.p[i], n = Math.hypot(c.mx, c.my), ix = c.mx / n, iy = c.my / n;
  p.face = Math.atan2(iy, ix);
  p.vx += ix * DASH_IMPULSE * HENKA_POWER; p.vy += iy * DASH_IMPULSE * HENKA_POWER;
  p.cd = DASH_CD; p.dashT = DASH_T; p.dashAge = 0; p.usedTachiai = true;
  p.henkaT = HENKA_WINDOW;
  S.p[1 - i].lockT = HENKA_WINDOW;                 // il est lancé : il ne peut plus corriger sa trajectoire
  S.events.push({ type: 'henka', who: i, x: p.x - ix * p.r, y: p.y - iy * p.r });
}
/** Fin du pas de côté : il est passé dans le vide, emporté par son élan. */
function updateHenka(S) {
  for (let i = 0; i < 2; i++) {
    const p = S.p[i];
    if (p.henkaT <= 0) continue;
    p.henkaT -= DT;
    if (p.henkaT > 0) continue;
    const o = S.p[1 - i];
    o.stun = Math.max(o.stun, HENKA_STUN); o.whiffT = 0; o.guard = false; o.hold = false;
    S.events.push({ type: 'henkaWhiff', who: i, x: o.x, y: o.y });
  }
}

/**
 * Nom de la prise gagnante (kimarite), d'après la façon dont le perdant est sorti.
 */
function kimarite(S, w) {
  const win = S.p[w], los = S.p[1 - w];
  if (los.thrown) return 'utchari';                                   // pivot au bord
  if (los.whiffT < 1.2) return 'hatakikomi';                          // esquivé, emporté par son élan
  const dx = win.x - los.x, dy = win.y - los.y, d = Math.hypot(dx, dy) || 1;
  if (los.touchT < 0.6 && (Math.cos(los.face) * dx + Math.sin(los.face) * dy) / d < -0.3) return 'okuridashi';   // poussé de dos
  if (win.dashAge < 1) return 'oshidashi';                            // sorti par une charge
  if (los.touchT > 0.8) return 'isamiashi';                           // sorti tout seul
  return 'yorikiri';                                                  // poussé au corps à corps
}

/**
 * Il charge : son dash est en cours, ou il l'a lancé il y a peu et arrive encore lancé dans sa
 * direction (une charge lancée de loin touche souvent juste après la fin du dash).
 */
function charging(p) {
  if (p.dashT > 0) return true;
  if (p.dashAge >= CHARGE_T) return false;
  return Math.cos(p.face) * p.vx + Math.sin(p.face) * p.vy > CHARGE_V;
}

function blocked(S, gi, oi, nx, ny, oCharging) {
  const g = S.p[gi];
  if (g.guard && oCharging && Math.cos(g.face) * nx + Math.sin(g.face) * ny > 0.3) {
    g.stamina = Math.max(0.05, g.stamina - 0.35);
    S.events.push({ type: 'block', who: gi, x: g.x + nx * g.r, y: g.y + ny * g.r });
  }
}

function collide(S) {
  const [a, b] = S.p;
  if (swinging(a) || swinging(b)) return;      // pendant le pivot, les deux lutteurs bougent ensemble
  if (a.henkaT > 0 || b.henkaT > 0) return;    // pas de côté : il ne fait que le frôler et passe
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
  if (d >= min || d === 0) return;
  a.touchT = b.touchT = 0;
  const nx = dx / d, ny = dy / d, overlap = min - d;
  const ma = mass(a, nx, ny), mb = mass(b, -nx, -ny);
  const wa = 1 / ma, wb = 1 / mb;
  a.x -= nx * overlap * wa / (wa + wb); a.y -= ny * overlap * wa / (wa + wb);
  b.x += nx * overlap * wb / (wa + wb); b.y += ny * overlap * wb / (wa + wb);
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv > 0) return;
  const ch = [charging(a), charging(b)];       // avant le choc, qui renverse les vitesses
  const e = 1.35;                         // rebond un peu exagéré, c'est plus drôle
  const j = -(1 + e) * rv / (wa + wb);
  a.vx -= j * nx * wa; a.vy -= j * ny * wa;
  b.vx += j * nx * wb; b.vy += j * ny * wb;
  blocked(S, 0, 1, nx, ny, ch[1]); blocked(S, 1, 0, -nx, -ny, ch[0]);
  const force = Math.abs(rv);
  if (force > 250) { a.squash = b.squash = 1; }
  S.events.push({ type: 'hit', force, x: a.x + nx * a.r, y: a.y + ny * a.r, dash: ch });
}

const isOut = (S, p) => Math.hypot(p.x - C, p.y - C) > S.ring + p.r * 0.35;

/** Avance la simulation d'un tick. cmds = [cmdJoueur1, cmdJoueur2] */
function step(S, cmds) {
  if (S.phase === 'matchEnd') return;
  S.tick++;
  S.phaseT += DT;
  for (const p of S.p) { p.px = p.x; p.py = p.y; }

  if (S.phase === 'shikiri') {
    // Accroupis sur les lignes : on ne bouge pas. Dasher avant le signal = faux départ (matta).
    for (let i = 0; i < 2; i++) {
      const p = S.p[i];
      if (cmds[i].dash && !p.matta) {
        p.matta = true;
        S.events.push({ type: 'matta', who: i });
      }
      integrate(p);
    }
    if (S.phaseT >= S.signalAt) {
      S.phase = 'play'; S.phaseT = 0;
      for (const p of S.p) if (p.matta) p.stun = MATTA_STUN;
      S.events.push({ type: 'hakkeyoi' });
    }
    return;
  }

  if (S.phase === 'play') {
    S.roundT += DT;
    if (S.roundT > SHRINK_DELAY) S.ring = Math.max(RMIN, S.ring - DT * SHRINK_SPEED);
    for (let i = 0; i < 2; i++) {
      const p = S.p[i], c = cmds[i], o = S.p[1 - i];
      const guardPressed = c.guard && !p.gIn; p.gIn = c.guard;
      // hanches basses : pendant que l'autre me soulève, un appui sur la garde fait échouer son utchari
      // (il faut appuyer pendant le soulevé : garder la touche enfoncée d'avance ne compte pas)
      if (o.utT >= 0 && o.utT < UT_BRACE && guardPressed && p.guardCd <= 0 && p.stamina > 0.2) counterUtchari(S, 1 - i);
      if (p.utT >= 0 || S.p.some(swinging)) { p.hold = false; continue; }   // pendant l'utchari, personne ne contrôle rien
      setGuard(p, c.guard);
      if (c.dash && canUtchari(S, i)) startUtchari(S, i, c);
      else if (c.dash && canHenka(S, i, c)) startHenka(S, i, c);
      else if (c.dash) tryDash(S, i);
      if (c.feint) tryFeint(S, i);
      if (p.utT < 0) {
        updateHold(S, i, c);
        if (p.stun <= 0 && p.lockT <= 0) steer(p, c.mx, c.my);
      }
    }
  }
  if (S.phase === 'play' || S.phase === 'roundEnd') { updateUtchari(S, 0); updateUtchari(S, 1); }
  integrate(S.p[0]); integrate(S.p[1]);
  collide(S);
  updateHenka(S);

  for (const q of S.p) if (q.thrown && q.stun <= 0) q.thrown = false;   // rattrapé : ce n'est plus un utchari
  for (let i = 0; i < 2; i++) if (utchariReady(S, i)) S.p[i].utReadyTick = S.tick;
  if (S.phase === 'play' && !S.p.some(swinging)) {
    const o1 = isOut(S, S.p[0]), o2 = isOut(S, S.p[1]);
    if (o1 && o2) { S.events.push({ type: 'draw' }); startRound(S); }
    else if (o1 || o2) {
      const w = o1 ? 1 : 0;
      S.winner = w; S.score[w]++;
      S.phase = 'roundEnd'; S.phaseT = 0;
      const loser = S.p[1 - w];
      loser.fallT = 0; loser.guard = false; loser.hold = false;
      S.events.push({ type: 'roundWin', who: w, x: loser.x, y: loser.y, kimarite: kimarite(S, w) });
    }
  } else if (S.phase === 'roundEnd' && S.phaseT >= ROUND_END_T) {
    if (S.score[S.winner] >= S.win) {
      S.phase = 'matchEnd'; S.matchWinner = S.winner; S.endTick = S.tick;
      S.events.push({ type: 'matchWin', who: S.winner });
    } else { S.round++; startRound(S); }
  }
}

/** Empreinte de l'état, pour vérifier le déterminisme (même seed + mêmes commandes = même hash). */
function hashState(S) {
  const f = v => Math.round(v * 1000);
  let h = 2166136261;
  const mix = v => { h ^= v; h = Math.imul(h, 16777619); };
  mix(S.tick); mix(S.seed); mix(S.score[0]); mix(S.score[1]); mix(f(S.ring));
  for (const p of S.p) [p.x, p.y, p.vx, p.vy, p.face, p.stamina].forEach(v => mix(f(v)));
  return (h >>> 0).toString(16);
}

export { NOCMD, canHenka, canUtchari, charging, hashState, newMatch, rand, startRound, step, utchariReady };
