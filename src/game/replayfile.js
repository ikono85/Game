/**
 * Ralentis partageables : un match tient dans sa graine et les commandes des joueurs, tick par tick
 * (la simulation est déterministe). On les compresse dans un lien …#replay=… que n'importe qui peut
 * ouvrir pour revoir tout le combat.
 *
 * - Seules les commandes des humains sont enregistrées : l'IA est elle aussi déterministe, on la
 *   refait jouer à la lecture (elle tire son hasard dans la même graine, dans le même ordre).
 * - Par manche, on garde l'état de départ (graine, score, numéro) : si un autre navigateur calcule
 *   un sinus un poil différent et que le combat dérive, la manche suivante repart quand même
 *   exactement comme dans l'original, et le score final reste le vrai.
 *
 * Aucune dépendance au DOM : testé directement sous Node.
 */
import { aiCommand, makeProfile, STYLES } from '../sim/ai.js';
import { localCmd, unpackIn } from '../sim/cmd.js';
import { newMatch, startRound, step } from '../sim/simulation.js';

// À augmenter quand la physique ou l'IA change : un vieux ralenti ne rejouerait plus le même combat.
const REPLAY_VER = 2;
const MAX_TICKS = 120 * 60 * 15;          // 15 minutes de combat au plus
const MAX_ROUNDS = 64;

/** État de départ d'une manche, relevé juste après son lancement. */
const roundHead = S => ({ seed: S.seed | 0, signalAt: S.signalAt, score: S.score.slice(), round: S.round, rn: S.rn, tick: S.tick, n: 0, c: [[], []] });

/**
 * meta : { mode, names, skins, win, ai: [null | { style, level }, …] } — ai décrit les lutteurs IA,
 * dont on n'enregistre pas les commandes.
 */
function newRecorder(S, meta) {
  return { meta: { ...meta, ai: meta.ai || [null, null] }, rounds: [roundHead(S)], final: null, ticks: 0, over: false };
}
/** Après chaque tick : v = commandes compactées des deux joueurs, rn0 = numéro de manche avant le tick. */
function recordTick(R, S, v, rn0) {
  if (!R || R.over) return;
  if (++R.ticks > MAX_TICKS || R.rounds.length > MAX_ROUNDS) { R.over = true; return; }
  const cur = R.rounds[R.rounds.length - 1];
  cur.n++;
  for (let i = 0; i < 2; i++) if (!R.meta.ai[i]) cur.c[i].push(v[i]);
  if (S.rn !== rn0) R.rounds.push(roundHead(S));
  if (S.phase === 'matchEnd' && !R.final) R.final = { score: S.score.slice(), w: S.matchWinner };
}
/**
 * Match en ligne : on a rangé les commandes et les départs de manche par tick (une resimulation
 * les réécrit). On en fait un enregistrement normal, du tick 1 à la fin du match.
 */
function recordingFromTicks(T, endTick, final) {
  const R = { meta: { ...T.meta, ai: [null, null] }, rounds: [{ ...T.head0, n: 0, c: [[], []] }], final, ticks: 0, over: false };
  for (let t = 1; t <= endTick; t++) {
    const v = T.inp[t];
    if (!v || v[0] === undefined || v[1] === undefined) { R.over = true; break; }
    const cur = R.rounds[R.rounds.length - 1];
    cur.n++; cur.c[0].push(v[0]); cur.c[1].push(v[1]);
    const h = T.heads.get(t);
    if (h && t < endTick) R.rounds.push({ ...h, n: 0, c: [[], []] });
    if (++R.ticks > MAX_TICKS || R.rounds.length > MAX_ROUNDS) { R.over = true; break; }
  }
  return R;
}
/** Le match est-il complet et partageable ? */
const replayReady = R => !!(R && !R.over && R.final);

// --- Écriture binaire ---
function writer() {
  let buf = new Uint8Array(4096), n = 0;
  const need = k => { if (n + k > buf.length) { const b = new Uint8Array(Math.max(buf.length * 2, n + k)); b.set(buf); buf = b; } };
  return {
    u8(v) { need(1); buf[n++] = v & 255; },
    vu(v) { need(5); v >>>= 0; while (v > 127) { buf[n++] = (v & 127) | 128; v >>>= 7; } buf[n++] = v; },
    i32(v) { need(4); new DataView(buf.buffer).setInt32(n, v | 0, true); n += 4; },
    f64(v) { need(8); new DataView(buf.buffer).setFloat64(n, v, true); n += 8; },
    bytes(b) { need(b.length); buf.set(b, n); n += b.length; },
    done: () => buf.slice(0, n),
  };
}
function reader(buf) {
  let n = 0;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const need = k => { if (n + k > buf.length) throw new Error('court'); };
  return {
    u8() { need(1); return buf[n++]; },
    vu() { let v = 0, s = 0, b; do { need(1); b = buf[n++]; v += (b & 127) * 2 ** s; s += 7; if (s > 35) throw new Error('varint'); } while (b & 128); return v; },
    i32() { need(4); const v = dv.getInt32(n, true); n += 4; return v; },
    f64() { need(8); const v = dv.getFloat64(n, true); n += 8; return v; },
    bytes(k) { need(k); const b = buf.subarray(n, n + k); n += k; return b; },
    end: () => n === buf.length,
  };
}

// Commandes : beaucoup de répétitions (on tient une touche) → paires (valeur, nombre de ticks)
function writeRuns(w, list) {
  let i = 0;
  while (i < list.length) {
    let j = i + 1;
    while (j < list.length && list[j] === list[i]) j++;
    const v = list[i];
    w.u8(v >> 16); w.u8(v >> 8); w.u8(v); w.vu(j - i);
    i = j;
  }
}
function readRuns(r, count) {
  const out = new Array(count);
  let i = 0;
  while (i < count) {
    const v = ((r.u8() << 16) | (r.u8() << 8) | r.u8()) >>> 0, k = r.vu();
    if (k < 1 || i + k > count) throw new Error('runs');
    out.fill(v, i, i + k); i += k;
  }
  return out;
}

async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function toB64url(b) {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(t) {
  const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

/** Ralenti → texte court pour un lien (base64url d'un flux compressé). */
async function encodeReplay(R) {
  if (!replayReady(R)) throw new Error('incomplet');
  const w = writer();
  w.u8(0x44); w.u8(0x44); w.u8(REPLAY_VER);              // « DD », version
  const m = R.meta;
  const json = new TextEncoder().encode(JSON.stringify({
    mode: m.mode, names: m.names, skins: m.skins, win: m.win, ai: m.ai, final: R.final, kim: m.kimarite || null,
  }));
  w.vu(json.length); w.bytes(json);
  w.vu(R.rounds.length);
  for (const h of R.rounds) {
    w.i32(h.seed); w.f64(h.signalAt); w.vu(h.score[0]); w.vu(h.score[1]); w.vu(h.round); w.vu(h.rn); w.vu(h.tick);
    w.vu(h.n);
    for (let i = 0; i < 2; i++) if (!m.ai[i]) writeRuns(w, h.c[i]);
  }
  return toB64url(await pipe(w.done(), new CompressionStream('deflate-raw')));
}

/** Texte du lien → ralenti. Lève une erreur 'version' si le ralenti vient d'une autre version du jeu. */
async function decodeReplay(text) {
  if (!/^[A-Za-z0-9_-]{8,}$/.test(text)) throw new Error('format');
  let raw;
  try { raw = await pipe(fromB64url(text), new DecompressionStream('deflate-raw')); } catch { throw new Error('format'); }
  if (raw.length > 8e6) throw new Error('taille');
  const r = reader(raw);
  if (r.u8() !== 0x44 || r.u8() !== 0x44) throw new Error('format');
  if (r.u8() !== REPLAY_VER) throw new Error('version');
  const meta = JSON.parse(new TextDecoder().decode(r.bytes(r.vu())));
  const ai = [0, 1].map(i => {
    const a = meta.ai && meta.ai[i];
    return a && STYLES[a.style] && Number.isFinite(a.level) ? { style: a.style, level: Math.min(1, Math.max(0, a.level)) } : null;
  });
  const nr = r.vu();
  if (nr < 1 || nr > MAX_ROUNDS) throw new Error('manches');
  const rounds = [];
  let total = 0;
  for (let k = 0; k < nr; k++) {
    const h = { seed: r.i32(), signalAt: r.f64(), score: [r.vu(), r.vu()], round: r.vu(), rn: r.vu(), tick: r.vu(), n: r.vu(), c: [[], []] };
    if ((total += h.n) > MAX_TICKS || !Number.isFinite(h.signalAt)) throw new Error('taille');
    for (let i = 0; i < 2; i++) if (!ai[i]) h.c[i] = readRuns(r, h.n);
    rounds.push(h);
  }
  if (!r.end()) throw new Error('format');
  const win = [1, 2, 3].includes(meta.win) ? meta.win : 3;
  const final = meta.final && Array.isArray(meta.final.score) ? { score: meta.final.score.slice(0, 2).map(x => x | 0), w: meta.final.w === 1 ? 1 : 0 } : null;
  if (!final) throw new Error('format');
  const str = (v, d) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24) || d : d);
  return {
    meta: {
      mode: str(meta.mode, 'versus'), win, ai, kimarite: meta.kim === 'utchari' ? 'utchari' : null,
      names: [str(meta.names && meta.names[0], 'Rouge'), str(meta.names && meta.names[1], 'Bleu')],
      skins: [str(meta.skins && meta.skins[0], 'rouge'), str(meta.skins && meta.skins[1], 'blue')],
    },
    rounds, final, ticks: total, over: false,
  };
}

/** Lecture d'un ralenti : une partie neuve, remise à l'état de départ enregistré. */
function newPlayback(R) {
  const ai = R.meta.ai.map(a => (a ? makeProfile(a.style, a.level) : null));
  const S = newMatch({ seed: 0, win: R.meta.win, ai });
  applyHead(S, R.rounds[0]);
  return { R, S, r: 0, k: 0, diverged: 0 };
}
/** Remet l'état de départ enregistré d'une manche (graine, score…) dans la partie rejouée. */
function applyHead(S, h) {
  S.seed = h.seed; S.signalAt = h.signalAt; S.score = h.score.slice(); S.round = h.round; S.rn = h.rn; S.tick = h.tick;
}
/** Avance la lecture d'un tick (P.S est la partie rejouée). */
function playbackStep(P) {
  const S = P.S;
  if (S.phase === 'matchEnd') return;
  const h = P.R.rounds[P.r];
  if (!h || P.k >= h.n) { forceNext(P); return; }
  // même ordre que pendant le match : commande du joueur 1, puis du joueur 2 (l'IA tire son hasard dans S)
  const v = [0, 1].map(i => (S.ai[i] ? localCmd(aiCommand(S, i)) : h.c[i][P.k]));
  const rn0 = S.rn;
  step(S, [unpackIn(v[0]), unpackIn(v[1])]);
  P.k++;
  if (S.rn !== rn0) {                        // nouvelle manche : on repart de l'état enregistré
    P.r++; P.k = 0;
    const nx = P.R.rounds[P.r];
    if (nx) applyHead(S, nx);
  }
}
/**
 * Plus de commandes alors que la manche continue : le combat a dérivé (calculs d'un autre navigateur).
 * On passe directement à la manche suivante enregistrée, ou à la fin du match.
 */
function forceNext(P) {
  const S = P.S;
  P.diverged++;
  const nx = P.R.rounds[P.r + 1];
  if (nx) { startRound(S); applyHead(S, nx); P.r++; P.k = 0; return; }
  S.score = P.R.final.score.slice();
  S.phase = 'matchEnd'; S.matchWinner = P.R.final.w; S.endTick = S.tick;
  S.events.push({ type: 'matchWin', who: S.matchWinner });
}

export { REPLAY_VER, recordingFromTicks, roundHead, decodeReplay, encodeReplay, newPlayback, newRecorder, playbackStep, recordTick, replayReady };
