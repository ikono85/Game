/**
 * Rendu canvas : dohyō, foule, lutteurs, étiquettes, invites (utchari, hanches basses), textes.
 */
import { G } from '../game/state.js';
import { PAD_GLYPHS, padForPlayer } from '../input/gamepad.js';
import { BIND, PAD, keyName } from '../input/keyboard.js';
import { drawYouMarker } from '../net/screens.js';
import { CROWD, FRAME, SPRITE_SIZE, pickFrame, sheetReady, skinSheet } from './sprites.js';
import { V, bgCache, crowdSeats, ensureBackground } from './view.js';
import { sceneFor } from './scenes/index.js';
import { drawArenaOver, drawArenaUnder } from './arenas.js';
import { C, DASH_CD, GUARD_MAX, PI, R0, TAU, UT_BRACE } from '../sim/constants.js';
import { canUtchari } from '../sim/simulation.js';
import { ctx } from '../ui/dom.js';

function drawRing(ring, players) {
  // (la carte et les gradins prolongés sont dans le fond mis en cache, voir buildBackground)
  if (ring < R0) {        // zone perdue : le tatami s'assombrit à mesure que le cercle rétrécit
    ctx.beginPath();
    ctx.arc(C, C, R0 + 10, 0, TAU); ctx.arc(C, C, ring + 16, 0, TAU, true);
    ctx.fillStyle = 'rgba(28,16,8,.32)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(C, C, ring, 0, TAU);
  ctx.fillStyle = 'rgba(236,214,160,.16)'; ctx.fill();
  const rr = ring + 10;    // ballots de paille (tawara)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.lineWidth = 24; ctx.strokeStyle = '#6f5a2e';
  ctx.beginPath(); ctx.arc(C, C, rr, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 19; ctx.strokeStyle = '#d4bf83';
  ctx.beginPath(); ctx.arc(C, C, rr, 0, TAU); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,248,220,.55)';
  ctx.beginPath(); ctx.arc(C, C, rr - 4, 0, TAU); ctx.stroke();
  const bales = Math.max(20, Math.round(TAU * rr / 52));
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(95,70,30,.75)';
  ctx.beginPath();
  for (let i = 0; i < bales; i++) {
    const a = i / bales * TAU, ca = Math.cos(a), sa = Math.sin(a);
    ctx.moveTo(C + ca * (rr - 9), C + sa * (rr - 9)); ctx.lineTo(C + ca * (rr + 9), C + sa * (rr + 9));
  }
  ctx.stroke();
  if (players) for (const p of players) {        // tenir au bord : la paille s'illumine sous les talons
    if (!p.hold) continue;
    const a = Math.atan2(p.y - C, p.x - C), pulse = 0.55 + 0.25 * Math.sin(G.t * 16);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineWidth = 22;
    ctx.strokeStyle = `rgba(255,206,92,${pulse})`;
    ctx.shadowColor = 'rgba(255,190,60,.8)'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(C, C, rr, a - 0.16, a + 0.16); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#f7f1e3';     // lignes de départ (shikiri-sen)
  ctx.fillRect(C - 72, C - 40, 8, 80);
  ctx.fillRect(C + 64, C - 40, 8, 80);
}

let vignette = null, vigArena = null;
const resetVignette = () => { vignette = null; };   // la fenêtre a changé de taille
/** Ombrelle en papier huilé (janome-gasa) vue de dessus : un spectateur abrité de la neige. */
function drawKasa(x, y, v, ph, up) {
  const col = ['#b8322f', '#2d4f86', '#7b3a6b', '#c47a2c'][v & 3], r = 33 + (up ? 2 : 0);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ph * TAU + G.t * 0.15 * (v & 1 ? 1 : -1));
  ctx.fillStyle = 'rgba(30,30,50,.25)'; ctx.beginPath(); ctx.arc(6, 8, r, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, r * 0.42, -2.2, -0.9); ctx.arc(0, 0, r * 0.2, -0.9, -2.2, true); ctx.fill();
  ctx.fillStyle = '#e9e1cf'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawCrowd() {
  if (CROWD.complete && CROWD.naturalWidth) {
    ctx.imageSmoothingEnabled = true;
    for (const [x, y, v, ph, kind] of crowdSeats) {
      const up = G.cheer > 0 && ((G.t * 2.4 + ph) % 1) < 0.35 + 0.4 * Math.min(1, G.cheer);
      if (kind === 'kasa') { drawKasa(x, y, v, ph, up); continue; }
      const a = Math.atan2(G.focusY - y, G.focusX - x);           // tout le monde suit le combat
      const s = (1 + 0.018 * Math.sin(G.t * 1.4 + ph * 6.28)) * (up ? 1.07 : 1);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
      ctx.drawImage(CROWD, v * 112, up ? 112 : 0, 112, 112, -28, -28, 56, 56);
      ctx.restore();
    }
  }
  if (vigArena !== G.arena) { vignette = null; vigArena = G.arena; }
  const sc = sceneFor(G.arena);
  if (sc && !sc.vignette) return;
  if (!vignette) {
    // lumière de scène : même dégradé qu'avant sur la carte, qui continue à s'assombrir sur les gradins ajoutés
    const R = Math.max(981, Math.hypot(Math.max(C - V.x0, V.x1 - C), Math.max(C - V.y0, V.y1 - C)));
    const t = r => Math.min(1, (r - 470) / (R - 470));
    vignette = ctx.createRadialGradient(C, C, 470, C, C, R);
    if (sc) {                                                      // en plein air : une ombre bien plus légère
      const { rgb, a } = sc.vignette;
      vignette.addColorStop(0, `rgba(${rgb},${a[0]})`);
      vignette.addColorStop(t(900), `rgba(${rgb},${a[1]})`);
      vignette.addColorStop(1, `rgba(${rgb},${a[2]})`);
    } else {
      vignette.addColorStop(0, 'rgba(12,7,4,0)');
      vignette.addColorStop(t(648), 'rgba(12,7,4,.22)');
      vignette.addColorStop(t(980), 'rgba(12,7,4,.66)');
      if (R > 981) vignette.addColorStop(1, 'rgba(12,7,4,.85)');
    }
  }
  ctx.fillStyle = vignette; ctx.fillRect(V.x0, V.y0, V.x1 - V.x0, V.y1 - V.y0);
}

function drawPlayer(p, sheet, alpha) {
  const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;   // interpolation entre deux ticks
  ctx.save();
  ctx.translate(x, y);
  // ombre douce au sol, décalée vers le bas comme la lumière de la salle
  if (p.fallT < 0.6) {
    const sh = ctx.createRadialGradient(4, 10, 6, 4, 10, p.r + 14);
    sh.addColorStop(0, 'rgba(30,18,8,.38)'); sh.addColorStop(1, 'rgba(30,18,8,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(4, 10, p.r + 14, 0, TAU); ctx.fill();
  }
  ctx.rotate(p.face);
  if (p.utT >= 0 && p.utS < 0) ctx.scale(1, -1);   // pivot dans l'autre sens : image en miroir
  const sq = 1 + p.squash * 0.15;
  ctx.scale(1 / sq, sq);
  if (p.dashT > 0 || p.fakeT > 0) {
    ctx.fillStyle = 'rgba(255,240,200,.3)';
    ctx.beginPath(); ctx.arc(0, 0, p.r + 14, 0, TAU); ctx.fill();
  }
  if (p.stun > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(G.t * 18));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (sheetReady(sheet)) {
    const [row, col] = pickFrame(p);
    ctx.drawImage(sheet, col * FRAME, row * FRAME, FRAME, FRAME, -SPRITE_SIZE / 2, -SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
  }
  ctx.restore();
  if (p.stamina < GUARD_MAX - 0.01 || p.guard) {         // jauge de garde
    const w = 64, h = 7, x0 = x - w / 2, y0 = y + p.r + 22;
    ctx.fillStyle = 'rgba(27,21,18,.6)'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = p.guardCd > 0 ? '#8a6a4a' : '#efe3c8';
    ctx.fillRect(x0, y0, w * p.stamina / GUARD_MAX, h);
  }
  if (p.cd > 0) {                                          // jauge de dash
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(27,21,18,.55)';
    ctx.beginPath(); ctx.arc(x, y, p.r + 12, -PI / 2, -PI / 2 + TAU * (1 - p.cd / DASH_CD)); ctx.stroke();
  }
}

function drawZabuton(dt) {
  for (const z of G.zabuton) {
    z.t += dt;
    if (z.t < 0) continue;
    const k = Math.min(1, z.t / z.dur);
    const x = z.x0 + (z.x1 - z.x0) * k, y = z.y0 + (z.y1 - z.y0) * k;
    const hgt = Math.sin(k * PI) * 160;
    const sc = 1 + hgt / 260;
    if (k < 1) z.rot += z.spin * dt;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, y, 22, 16, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y - hgt); ctx.rotate(z.rot); ctx.scale(sc, sc);
    ctx.fillStyle = z.hue; ctx.fillRect(-20, -20, 40, 40);
    ctx.strokeStyle = 'rgba(255,240,210,.5)'; ctx.lineWidth = 3; ctx.strokeRect(-17, -17, 34, 34);
    ctx.fillStyle = 'rgba(255,240,210,.7)'; ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
}

function drawText(text, color, size = 84, y = C - 250) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `400 ${size}px "Dela Gothic One", "Arial Black", sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(text, C + 5, y + 6);
  ctx.fillStyle = color; ctx.fillText(text, C, y);
}

/** Bouton de manette dessiné dans l'arène (coordonnées du monde). */
function drawPadGlyph(x, y, btn, r = 24) {
  const [t, c] = PAD_GLYPHS[G.padFamily || 'xbox'][btn] || ['?'];
  ctx.fillStyle = '#2a221c'; ctx.beginPath();
  if (t.length > 1) { ctx.roundRect(x - r * 1.3, y - r, r * 2.6, r * 2, r * 0.5); } else ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = c || '#f4ecd8';
  ctx.font = `700 ${t.length > 3 ? r * 0.75 : t.length > 2 ? r * 0.9 : r * 1.15}px "Zen Kaku Gothic New", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y + 1);
}

/** Temps de réaction affiché au-dessus du lutteur. */
function drawLabels(S, alpha) {
  for (const l of G.labels) {
    const p = S.p[l.who];
    const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha - 100 - (1.8 - l.t) * 14;
    ctx.globalAlpha = Math.min(1, l.t / 0.4);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 46px "Dela Gothic One", "Arial Black", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(l.text, x + 3, y + 4);
    ctx.fillStyle = l.hot ? '#ffd166' : '#f4ecd8'; ctx.fillText(l.text, x, y);
    if (l.sub) {
      ctx.font = '700 24px "Zen Kaku Gothic New", sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(l.sub, x + 2, y - 40 + 2);
      ctx.fillStyle = '#ffd166'; ctx.fillText(l.sub, x, y - 40);
    }
  }
  ctx.globalAlpha = 1;
}

/** Au bord, quand l'utchari est possible : invite dorée au-dessus du joueur humain, avec sa touche de dash. */
const isLocalHuman = (S, i) => G.mode === 'watch' ? false : G.mode === 'dojo' ? i === 0 : G.mode === 'online' && G.net ? i === G.net.me : !S.ai[i];
const keySlot = i => (G.mode === 'online' ? 0 : i);     // en ligne, j'utilise toujours les touches du joueur 1
function drawUtchariPrompt(S, alpha) {
  for (let i = 0; i < 2; i++) {
    if (!isLocalHuman(S, i)) continue;
    const foe = S.p[1 - i];
    if (foe.utT >= 0 && foe.utT < UT_BRACE) { drawCounterPrompt(S, i, alpha); continue; }
    if (!canUtchari(S, i)) continue;
    const p = S.p[i];
    const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha - 96;
    const pulse = 1 + 0.06 * Math.sin(G.t * 18);
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 30px "Dela Gothic One", "Arial Black", sans-serif';
    const pad = padForPlayer(keySlot(i));
    const key = pad ? null : keyName(BIND[keySlot(i)].dash[0]);
    const label = key ? `Utchari : ${key}` : 'Utchari';
    const w = ctx.measureText(label).width + (pad ? 56 : 0);
    ctx.fillStyle = 'rgba(28,19,13,.82)';
    ctx.beginPath(); ctx.roundRect(-w / 2 - 14, -24, w + 28, 48, 10); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.fillText(label, pad ? -24 : 0, 1);
    if (pad) drawPadGlyph(w / 2 - 20, 0, PAD.dash[0], 18);
    ctx.restore();
  }
}

/** On me soulève : « Hanches basses » + ma touche de garde, avec une barre qui se vide (le temps pour contrer). */
function drawCounterPrompt(S, i, alpha) {
  const p = S.p[i], foe = S.p[1 - i];
  const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha - 100;
  const left = 1 - foe.utT / UT_BRACE;
  ctx.save(); ctx.translate(x, y);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '400 30px "Dela Gothic One", "Arial Black", sans-serif';
  const pad = padForPlayer(keySlot(i));
  const key = pad ? null : keyName(BIND[keySlot(i)].guard[0]);
  const label = key ? `Hanches basses : ${key}` : 'Hanches basses';
  const w = ctx.measureText(label).width + (pad ? 56 : 0);
  ctx.fillStyle = 'rgba(28,19,13,.88)';
  ctx.beginPath(); ctx.roundRect(-w / 2 - 14, -26, w + 28, 58, 10); ctx.fill();
  ctx.fillStyle = '#ff9a7a'; ctx.fillText(label, pad ? -24 : 0, -2);
  if (pad) drawPadGlyph(w / 2 - 20, -2, PAD.guard[0], 18);
  ctx.fillStyle = 'rgba(255,154,122,.25)'; ctx.fillRect(-w / 2, 20, w, 6);
  ctx.fillStyle = '#ff9a7a'; ctx.fillRect(-w / 2, 20, w * left, 6);
  ctx.restore();
}

/** Indice au tout premier départ : quelle touche pour le dash. */
function drawStartHint(S) {
  if (S.round !== 1) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (G.arenaLabel) {                       // « Haru basho · Osaka »
    ctx.font = '700 32px "Zen Kaku Gothic New", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(G.arenaLabel, C + 2, C - 338 + 2);
    ctx.fillStyle = '#ffd166'; ctx.fillText(G.arenaLabel, C, C - 338);
  }
  if (G.mode === 'watch') return;
  const y = C - 160;
  ctx.font = '700 30px "Zen Kaku Gothic New", sans-serif';
  if (G.padFamily) {
    const label = 'Dash au signal';
    const w = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(label, C - 26 + 2, y + 2);
    ctx.fillStyle = '#efe3c8'; ctx.fillText(label, C - 26, y);
    drawPadGlyph(C - 26 + w / 2 + 34, y, PAD.dash[0], 20);
  } else {
    const touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches;   // téléphone, tablette
    const label = touchOnly && G.mode !== 'versus' ? 'Dash au signal : bouton Dash' : G.mode === 'versus' ? `Dash au signal : ${keyName(BIND[0].dash[0])} et ${keyName(BIND[1].dash[0])}` : `Dash au signal : ${keyName(BIND[0].dash[0])}`;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(label, C + 2, y + 2);
    ctx.fillStyle = '#efe3c8'; ctx.fillText(label, C, y);
  }
}

/**
 * cam (facultatif) : { z, fx, fy } zoome de z autour du point du monde (fx, fy), utilisé par le ralenti.
 */
function render(S, alpha, dt, cam) {
  const shx = G.shake > 0 ? (Math.random() - .5) * G.shake : 0, shy = G.shake > 0 ? (Math.random() - .5) * G.shake : 0;
  const z = cam ? cam.z : 1, fx = cam ? cam.fx : C, fy = cam ? cam.fy : C;
  const tx = V.ox + V.s * (C - z * fx) + shx * V.s, ty = V.oy + V.s * (C - z * fy) + shy * V.s;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a120c'; ctx.fillRect(0, 0, V.cw, V.ch);
  ensureBackground();
  // le fond est mis en cache en pixels écran : on lui applique le même zoom
  if (bgCache) { ctx.setTransform(z, 0, 0, z, tx - z * V.ox, ty - z * V.oy); ctx.drawImage(bgCache, 0, 0); }
  ctx.setTransform(V.s * z, 0, 0, V.s * z, tx, ty);   // coordonnées du monde
  ctx.imageSmoothingEnabled = true;
  drawRing(S ? S.ring : R0, S ? S.p : null);
  drawCrowd();
  drawArenaUnder();                                   // teinte de l'arène (printemps, nuit d'été…)
  if (S) { drawPlayer(S.p[0], skinSheet(G.skins[0]), alpha); drawPlayer(S.p[1], skinSheet('bleu'), alpha); }
  for (const q of G.particles) {
    ctx.globalAlpha = Math.max(0, q.life * 1.6);
    ctx.fillStyle = q.color; ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
  drawArenaOver(dt);                                  // pétales, feuilles, neige, lucioles
  drawZabuton(dt);
  if (S && !S.view) {
    drawLabels(S, alpha); drawUtchariPrompt(S, alpha);
    if (G.mode === 'online' && G.net && S.phase === 'shikiri') drawYouMarker(S, alpha);
  }
  ctx.setTransform(V.s, 0, 0, V.s, V.ox, V.oy);
  if (!S || S.view) return;
  if (S.phase === 'shikiri') {
    // « Matta ! » (faux départ) ou « Égalité » arrivent pendant l'attente du signal : on les montre à la place de « Prêts… »
    if (G.flash) drawText(G.flash.text, G.flash.color, G.flash.text.length > 14 ? 72 : 84);
    else drawText('Prêts…', '#efe3c8', 104);
    drawStartHint(S);
  }
  else if (G.flash) drawText(G.flash.text, G.flash.color, G.flash.text.length > 14 ? 72 : 84);
}

export { isLocalHuman, render, resetVignette };
