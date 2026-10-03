/**
 * Les événements de la simulation deviennent effets visuels, sons et stats.
 * Coussins (zabuton) lancés par le public après un exploit.
 */
import { SEATS } from '../assets.js';
import { Sound } from '../audio/sound.js';
import { onMatchEnd } from '../game/match.js';
import { persist, save } from '../game/save.js';
import { G } from '../game/state.js';
import { isLocalHuman } from './draw.js';
import { C, COLORS, SIM_HZ, TAU } from '../sim/constants.js';
import { updateScore } from '../ui/hud.js';
import { KIMARITE } from '../sim/kimarite.js';

function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = 80 + Math.random() * 260;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color });
  }
}
function setFlash(text, color = '#efe3c8', t = 1) { G.flash = { text, color, t }; }

const fmtSec = t => `${t.toFixed(2).replace('.', ',')} s`;

/** Effets visuels et sons d'un événement ; rejoués tels quels pendant le ralenti. */
const VFX = new Set(['dash', 'feint', 'block', 'hit', 'roundWin', 'holdStart', 'slip', 'utchariStart', 'utchari', 'utchariCounter', 'henka', 'henkaWhiff']);
function playVfx(e) {
  switch (e.type) {
    case 'dash': burst(e.x, e.y, 8, '#e8d2a4'); Sound.whoosh(0.28); break;
    case 'feint': burst(e.x, e.y, 8, '#e8d2a4'); Sound.whoosh(0.12); break;
    case 'block': burst(e.x, e.y, 14, '#fff3c4'); Sound.block(); break;
    case 'hit':
      if (e.force > 250) {
        G.shake = Math.min(18, e.force / 45);
        burst(e.x, e.y, Math.min(18, e.force / 40 | 0), '#f3e6c9');
        Sound.hit(e.force);
      }
      if (e.force > 650) G.cheer = Math.max(G.cheer, 0.7);
      break;
    case 'roundWin': G.cheer = 2.4; G.shake = 20; burst(e.x, e.y, 30, '#e8d2a4'); Sound.thud(); break;
    case 'holdStart': burst(e.x, e.y, 10, '#c9a46b'); Sound.creak(); break;
    case 'slip': burst(e.x, e.y, 16, '#b08850'); Sound.slip(); break;
    case 'utchariStart': Sound.taiko(0, 60, 0.7); Sound.whoosh(0.35); G.cheer = Math.max(G.cheer, 1); break;
    case 'utchariCounter': G.shake = 10; burst(e.x, e.y, 18, '#fff3c4'); Sound.block(); Sound.taiko(0, 70, 0.6); G.cheer = Math.max(G.cheer, 1.5); break;
    case 'henka': burst(e.x, e.y, 10, '#e8d2a4'); Sound.whoosh(0.32); break;
    case 'henkaWhiff': burst(e.x, e.y, 14, '#e8d2a4'); Sound.boo(); break;   // la foule siffle : légal, mais mal vu
    case 'utchari': G.shake = 16; burst(e.x, e.y, 26, '#f3e6c9'); Sound.hit(900); Sound.taiko(0.05, 95, 0.8); G.cheer = 3; break;
  }
}

/** Temps de réaction au départ : étiquette au-dessus du lutteur, record personnel pour les humains. */
function onReaction(e) {
  const st = G.stats[e.who];
  st.best = st.best == null ? e.t : Math.min(st.best, e.t);
  let record = false;
  if (isLocalHuman(G.S, e.who)) {
    if (save.bestReact != null && e.t < save.bestReact) record = true;
    if (save.bestReact == null || e.t < save.bestReact) { save.bestReact = e.t; persist(); }
  }
  G.labels = G.labels.filter(l => l.who !== e.who);
  G.labels.push({ who: e.who, text: fmtSec(e.t), sub: record ? 'Record !' : e.perfect ? 'Tachiai parfait' : null,
    hot: record || e.perfect, t: 1.8 });
}

/** Les événements de la simu deviennent effets, sons, stats. Renvoie les effets du tick (pour le ralenti). */
function handleEvents(S) {
  const fx = [];
  for (const e of S.events) {
    const pc = e.who === 0 ? COLORS.red : COLORS.blue;
    if (VFX.has(e.type)) { playVfx(e); fx.push(e); }
    switch (e.type) {
      case 'roundStart':
        G.zabuton.length = 0; G.rec.length = 0; G.labels = [];
        Sound.taiko(0, 70, 0.5); Sound.taiko(0.18, 70, 0.35);
        break;
      case 'hakkeyoi':
        setFlash('Hakkeyoi !', '#efe3c8', 0.7); Sound.hyoshigi(); Sound.taiko(0.02, 90, 0.7);
        break;
      case 'matta':
        setFlash(`Matta ! ${G.names[e.who]}`, pc, 1); Sound.buzz(); G.stats[e.who].matta++;
        break;
      case 'tachiai':
        Sound.taiko(0, 110, 0.6); G.cheer = Math.max(G.cheer, 0.6);
        break;
      case 'reaction': onReaction(e); break;
      case 'dash': G.stats[e.who].dash++; G.dashOpen[e.who] = S.tick; break;
      case 'feint': G.stats[e.who].feint++; break;
      case 'block': setFlash('Bloqué !', '#efe3c8', 0.6); G.stats[e.who].block++; break;
      case 'hit':
        // un dash « touche » s'il y a un vrai choc dans la demi-seconde qui suit (compté une fois par dash)
        if (e.force > 200) for (let k = 0; k < 2; k++) {
          if (G.dashOpen[k] !== false && S.tick - G.dashOpen[k] <= SIM_HZ / 2) { G.stats[k].dashHit++; G.dashOpen[k] = false; }
        }
        break;
      case 'draw': setFlash('Égalité, on recommence', '#efe3c8', 1.2); break;
      case 'holdStart': G.stats[e.who].hold++; break;
      case 'henka': G.stats[e.who].henkaTry++; break;
      case 'henkaWhiff': G.stats[e.who].henka++; setFlash('Dans le vide !', '#efe3c8', 1); break;
      case 'utchari': G.stats[e.who].utchari++; setFlash('Utchari !', '#ffd166', 1.4); break;
      case 'utchariCounter': G.stats[e.who].counter++; setFlash('Contré !', '#efe3c8', 1.1); break;
      case 'roundWin':
        G.kimarite = e.kimarite;
        if (e.kimarite) G.stats[e.who].kim.push(e.kimarite);
        // le nom de la prise ; pour l'utchari, « Utchari ! » est déjà affiché
        if (e.kimarite !== 'utchari') setFlash(KIMARITE[e.kimarite] ? `${KIMARITE[e.kimarite].name} !` : `${G.names[e.who]} marque`, pc, 1.3);
        updateScore(); break;
      case 'matchWin': if (G.mode !== 'online') onMatchEnd(e.who); break;
    }
  }
  S.events.length = 0;
  return fx;
}

// Coussins lancés par le public lors d'un exploit
function throwZabuton(n = 40) {
  for (let i = 0; i < n; i++) {
    const s = SEATS[(Math.random() * SEATS.length) | 0];
    const a = Math.random() * TAU, r = Math.random() * 300;
    G.zabuton.push({ x0: s[0], y0: s[1], x1: C + Math.cos(a) * r, y1: C + Math.sin(a) * r,
      t: -Math.random() * 1.2, dur: 0.8 + Math.random() * 0.5, rot: Math.random() * TAU, spin: (Math.random() - .5) * 14,
      hue: ['#6b3a7a', '#8c2f3c', '#3d5a80', '#7a5c2e'][(Math.random() * 4) | 0] });
  }
  G.cheer = 4;
  if (Sound.ok()) for (let i = 0; i < 10; i++) Sound.noiseHit(Sound.ctx.currentTime + Math.random() * 1.6, { f: 400, vol: 0.12, dec: 0.12 });
}

export { VFX, burst, fmtSec, handleEvents, playVfx, throwZabuton };
