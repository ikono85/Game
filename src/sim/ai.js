/**
 * IA : chaque lutteur a son schéma de décision, pas seulement des stats. Elle produit les mêmes
 * commandes qu'un joueur, à partir de ce qu'un joueur peut voir.
 */
import { C, DT, EDGE_ZONE, SIM_HZ, UT_BRACE, clamp } from './constants.js';
import { NOCMD, canHenka, canUtchari, charging, rand } from './simulation.js';

// Ce que l'IA a le droit de « voir » : positions, vitesses, orientation, garde,
// jauges (affichées à l'écran), animation de dash/feinte. Pas fakeT vs dashT
// directement : pour lire une feinte elle doit regarder la vitesse réelle.
const STYLES = {
  oshi: {
    id: 'oshi', label: 'le Pousseur', stars: 1,
    desc: "Fonce tout droit et dashe dès qu'il est aligné. Garde rarement, ignore les feintes.",
    rate: 5, react: 0.32, guardP: 0.3, read: 0, feintP: 0, dashRange: 260, aimCos: 0.8,
    edgeCare: 0.85, dodge: 0, tachiaiP: 0.55, mattaP: 0.18, flank: 0, patience: 0, adapt: 0, holdP: 0.15, utchariP: 0, counterP: 0,
  },
  kabe: {
    id: 'kabe', label: 'le Mur', stars: 2,
    desc: "Tient le centre et garde dès qu'un dash arrive. Contre-attaque quand ta jauge de dash est vide.",
    // réflexes vifs pour lever la garde, mais lent à décider (3 fois par seconde) et moins têtu au bord :
    // il tient tête au Pousseur, mais les lutteurs à trois étoiles trouvent la faille
    rate: 3, react: 0.25, guardP: 0.6, read: 0.1, guardHold: 0.55, feintP: 0, dashRange: 220, aimCos: 0.92,
    edgeCare: 0.5, dodge: 0, tachiaiP: 0.2, mattaP: 0.03, flank: 0, patience: 1, adapt: 0, center: true, holdP: 0.4, utchariP: 0, counterP: 0.6,
  },
  kitsune: {
    id: 'kitsune', label: 'le Renard', stars: 3,
    desc: "Feinte pour te faire garder, puis frappe quand ta garde est vide ou que tu lui tournes le dos.",
    rate: 6, react: 0.2, guardP: 0.55, read: 0.5, feintP: 0.45, dashRange: 240, aimCos: 0.9,
    edgeCare: 0.6, dodge: 0.1, tachiaiP: 0.4, mattaP: 0.05, flank: 0.6, patience: 0.6, adapt: 0, holdP: 0.55, utchariP: 0.07, counterP: 0.5, henkaP: 0.12,
  },
  mai: {
    id: 'mai', label: 'le Danseur', stars: 3,
    desc: "Tourne autour de toi, esquive tes charges d'un pas de côté (henka) au lieu de garder, et attend que tu sois près du bord.",
    rate: 9, react: 0.15, guardP: 0.45, read: 0.4, feintP: 0.15, dashRange: 250, aimCos: 0.9,
    edgeCare: 0.55, dodge: 0.4, tachiaiP: 0.25, mattaP: 0.04, flank: 0.3, patience: 0.5, adapt: 0, orbit: 220, orbitP: 0.35, holdP: 0.5, utchariP: 0.07, counterP: 0.4, henkaP: 0.45,
  },
  yokozuna: {
    id: 'yokozuna', label: 'le Yokozuna', stars: 5,
    desc: "Lit tes feintes, gère le bord, varie ses attaques et s'adapte à tes habitudes.",
    rate: 12, react: 0.1, guardP: 0.85, read: 0.85, feintP: 0.3, dashRange: 250, aimCos: 0.93,
    edgeCare: 0.55, dodge: 0.25, tachiaiP: 0.7, mattaP: 0.02, flank: 0.5, patience: 0.8, adapt: 1, holdP: 0.9, utchariP: 0.3, counterP: 0.85, henkaP: 0.15,
  },
};
const STYLE_ORDER = ['oshi', 'kabe', 'kitsune', 'mai', 'yokozuna'];

/** Profil d'IA = style + niveau (0..1) qui affine réflexes et lecture. */
function makeProfile(styleId, level = 0.6) {
  const s = STYLES[styleId], k = clamp(level, 0, 1);
  return { ...s, level: k,
    react: s.react * (1.35 - 0.6 * k),
    guardP: clamp(s.guardP * (0.75 + 0.4 * k), 0, 0.97),
    read: clamp(s.read * (0.6 + 0.6 * k), 0, 0.95),
    rate: s.rate * (0.8 + 0.4 * k) };
}

function aiMem() {
  return { nextDecide: 0, mx: 0, my: 0, wantDash: false, wantFeint: false, guardUntil: 0,
    reactAt: -1, reactKind: '', punishUntil: 0, lastAnim: false, dodgeDir: 1, dodgeUntil: 0, tachiaiAt: -1,
    mattaDone: false, guardsVsFeint: 0, feintsSeen: 0, blockedAt: -1, orbitDir: 1,
    edgeRolled: false, holdOK: false, nextUt: 0, utSeen: -1, ctrAt: -1, ctrOK: false, henkaUntil: 0 };
}

/** Commande de l'IA : au bord, un dash serait un utchari ; l'IA ne le fait que si elle l'a décidé. */
function aiCommand(S, i) {
  const c = aiDecide(S, i), m = S.mem[i];
  if (m && c.dash && !m.utNow && canUtchari(S, i)) c.dash = false;
  if (m) m.utNow = false;
  return c;
}
function aiDecide(S, i) {
  const P = S.ai[i], m = S.mem[i];
  if (!P || !m) return NOCMD;
  const me = S.p[i], foe = S.p[1 - i];
  const tk = S.tick;
  const cmd = { mx: 0, my: 0, dash: false, feint: false, guard: false };

  if (S.phase === 'shikiri') {
    // Faux départ éventuel, sinon prépare la réaction au signal
    if (!m.mattaDone) {
      m.mattaDone = true;
      if (rand(S) < P.mattaP) m.tachiaiAt = Math.round((S.signalAt - 0.15 - rand(S) * 0.3) * SIM_HZ);
    }
    if (m.tachiaiAt > 0 && S.phaseT * SIM_HZ >= m.tachiaiAt) { cmd.dash = true; m.tachiaiAt = -1; }
    return cmd;
  }
  if (S.phase !== 'play') return cmd;

  // On me soulève pour un utchari : baisser les hanches (garde) si j'ai le réflexe et le temps
  if (foe.utT >= 0 && foe.utT < UT_BRACE) {
    if (m.ctrAt < 0) { m.ctrAt = tk + Math.round(P.react * SIM_HZ * (0.8 + rand(S) * 0.4)); m.ctrOK = rand(S) < (P.counterP || 0); }
    if (m.ctrOK && tk >= m.ctrAt) cmd.guard = true;
    return cmd;
  }
  m.ctrAt = -1;

  if (S.roundT < DT * 0.5) {   // premier tick après le signal : tachiai ?
    m.tachiaiAt = rand(S) < P.tachiaiP ? tk + Math.round((P.react * (0.6 + rand(S) * 0.6)) * SIM_HZ) : -1;
  }
  if (m.tachiaiAt > 0 && tk >= m.tachiaiAt) { m.tachiaiAt = -1; cmd.dash = true; }

  const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const mx = me.x - C, my = me.y - C, md = Math.hypot(mx, my) || 1;
  const fx = foe.x - C, fy = foe.y - C, fd = Math.hypot(fx, fy) || 1;
  const edge = md / S.ring, foeEdge = fd / S.ring;
  const foeFacingMe = Math.cos(foe.face) * -ux + Math.sin(foe.face) * -uy > 0.75;
  const aimed = Math.cos(Math.atan2(dy, dx) - me.face) > P.aimCos;
  const foeSpeed = Math.hypot(foe.vx, foe.vy);

  // --- Réaction à une attaque (après le temps de réaction du lutteur) ---
  const anim = foe.dashT > 0 || foe.fakeT > 0;
  if (anim && !m.lastAnim && d < 330 && foeFacingMe) {
    m.reactAt = tk + Math.round(P.react * SIM_HZ * (0.8 + rand(S) * 0.4));
  }
  m.lastAnim = anim;
  if (m.reactAt >= 0 && tk >= m.reactAt) {
    m.reactAt = -1;
    if (anim || foeSpeed > 300) {
      const looksFake = foeSpeed < 480;           // une feinte n'accélère presque pas
      const isRead = looksFake && rand(S) < P.read;
      if (looksFake) m.feintsSeen++;
      if (isRead) {
        if (me.cd <= 0 && aimed && d < P.dashRange) m.wantDash = true;   // punir la feinte
      } else if (!looksFake && P.henkaP && me.cd <= 0 && rand(S) < P.henkaP) {
        m.henkaUntil = tk + Math.round(0.35 * SIM_HZ); m.dodgeDir = rand(S) < 0.5 ? 1 : -1;   // pas de côté dès qu'il est assez près
      } else if (rand(S) < P.dodge) {
        m.dodgeUntil = tk + Math.round(0.3 * SIM_HZ); m.dodgeDir = rand(S) < 0.5 ? 1 : -1;
        m.punishUntil = m.dodgeUntil + Math.round(0.5 * SIM_HZ);
      } else if (rand(S) < P.guardP && (me.stamina > 0.45 || P.level < 0.4)) {
        m.guardUntil = tk + Math.round((P.guardHold || 0.35) * SIM_HZ);
        if (looksFake) m.guardsVsFeint++;
      }
    }
  }

  // --- Henka : la vraie charge arrive, pas de côté au dernier moment ---
  if (tk < m.henkaUntil) {
    const side = { mx: -uy * m.dodgeDir - mx / md * 0.25, my: ux * m.dodgeDir - my / md * 0.25 };   // de côté, plutôt vers le centre
    if (canHenka(S, i, side)) { m.henkaUntil = 0; m.utNow = true; return { ...cmd, ...side, dash: true }; }
    if (!charging(foe)) m.henkaUntil = 0;
  }

  // --- Garde en cours ---
  if (tk < m.guardUntil && (me.stamina > 0.25 || P.level < 0.4)) {
    if (foe.dashT > 0) m.guardUntil = Math.max(m.guardUntil, tk + 6);
    cmd.guard = true; cmd.mx = ux * 0.01; cmd.my = uy * 0.01;   // se tourner face au danger
    if (me.guard && foe.dashT > 0 && d < 90) m.blockedAt = tk;
    return cmd;
  }

  // --- Au bord : tenir, et tenter l'utchari si on sait le faire ---
  const myZone = md > S.ring - EDGE_ZONE - 6;
  if (!myZone) m.edgeRolled = false;
  else if (!m.edgeRolled) { m.edgeRolled = true; m.holdOK = rand(S) < P.holdP; }
  const pushedOut = (me.vx * mx + me.vy * my) / md > 30;
  const utReady = myZone && P.utchariP > 0 && canUtchari(S, i);
  if (!utReady) m.utSeen = -1; else if (m.utSeen < 0) m.utSeen = tk;
  if (utReady && tk - m.utSeen >= Math.round(P.react * SIM_HZ) && tk >= m.nextUt) {   // il lui faut son temps de réaction
    m.nextUt = tk + 12;
    if (rand(S) < P.utchariP) {
      m.utNow = true;
      const side = rand(S) < 0.5 ? 1 : -1;
      cmd.mx = -uy * side; cmd.my = ux * side; cmd.dash = true;
      return cmd;
    }
  }
  if (myZone && (d < 140 || pushedOut) && tk >= m.dodgeUntil) {
    if (m.holdOK && me.stamina > 0.05 && me.guardCd <= 0) {
      cmd.mx = -mx / md; cmd.my = -my / md;                       // talons plantés, poussée vers le centre
      return cmd;
    }
    // ne sait pas tenir : il part sur le côté le long du bord, sans planter les talons
    const side = (i === 0 ? 1 : -1);
    cmd.mx = -my / md * side * 0.94 - mx / md * 0.34; cmd.my = mx / md * side * 0.94 - my / md * 0.34;
    return cmd;
  }

  // --- Esquive latérale ---
  if (tk < m.dodgeUntil) {
    cmd.mx = -uy * m.dodgeDir - mx / md * 0.3; cmd.my = ux * m.dodgeDir - my / md * 0.3;
    return cmd;
  }

  // --- Décisions à cadence fixe ---
  if (tk >= m.nextDecide) {
    m.nextDecide = tk + Math.max(1, Math.round(SIM_HZ / P.rate));
    // Direction de déplacement
    // le Danseur tourne autour de toi, mais plus serré quand le cercle rétrécit (sinon il tournerait sur la paille)
    const orbit = Math.min(P.orbit || 0, S.ring * 0.5);
    let tx = ux, ty = uy;
    if (P.center) {                    // le Mur reste entre l'adversaire et le centre
      const gx = C + fx * 0.25, gy = C + fy * 0.25;
      tx = (gx - me.x) / 60 + ux * 0.3; ty = (gy - me.y) / 60 + uy * 0.3;
    } else if (P.orbit && d < orbit + 60 && foeEdge < 0.7 && rand(S) < P.orbitP) {   // le Danseur tourne
      if (rand(S) < 0.08) m.orbitDir *= -1;
      tx = -uy * m.orbitDir + ux * (d - orbit) / 80; ty = ux * m.orbitDir + uy * (d - orbit) / 80;
    }
    // viser le côté extérieur de l'adversaire pour le pousser dehors
    tx += fx / fd * 0.35; ty += fy / fd * 0.35;
    // contourner : la garde ne protège que de face, donc les styles malins arrivent de biais
    if (P.flank > 0 && foe.guard && d < 300 && rand(S) < P.flank) {
      if (!m.flankSide || rand(S) < 0.05) m.flankSide = rand(S) < 0.5 ? 1 : -1;
      tx += -uy * m.flankSide * 1.2; ty += ux * m.flankSide * 1.2;
    }
    // gestion du bord
    if (edge > P.edgeCare) {
      const pull = (edge - P.edgeCare) / (1 - P.edgeCare) * 2.2 + 0.6;
      tx = tx * 0.4 - mx / md * pull; ty = ty * 0.4 - my / md * pull;
    }
    const n = Math.hypot(tx, ty) || 1;
    m.mx = tx / n; m.my = ty / n;

    // Attaque ? (jamais pendant qu'un coup adverse arrive et qu'on n'a pas encore réagi)
    const busy = m.reactAt >= 0 || anim;
    if (!busy && d < P.dashRange && aimed && edge < 0.88) {
      const foeBack = Math.cos(foe.face) * ux + Math.sin(foe.face) * uy > 0.2;   // il me tourne le dos
      const foeExposed = !foe.guard || foeBack || foe.guardCd > 0;
      let feintP = P.feintP;
      if (P.adapt && m.feintsSeen >= 2) feintP = clamp(0.15 + m.guardsVsFeint / m.feintsSeen * 0.6, 0.1, 0.65);
      if (P.adapt) feintP = clamp(feintP + (foe.guard ? 0.2 : 0), 0, 0.8);
      const counter = m.blockedAt >= 0 && tk - m.blockedAt < 0.5 * SIM_HZ;
      // l'impatience monte quand la manche s'éternise : personne ne reste planté au centre
      const impatience = clamp((S.roundT - 15) / 20, 0, 1);
      const patience = P.patience * (1 - impatience);
      const foeNoDash = foe.cd > 0.5;
      const punish = tk < m.punishUntil;
      const wantAttack = punish || (
        P.id === 'oshi' ? rand(S) < 0.8 :
        P.id === 'kabe' ? (counter || foeNoDash || foeEdge > 0.8 || rand(S) < impatience * 0.5) :
        patience > 0 && !foeExposed ? rand(S) < (1 - patience) * 0.5 :
        rand(S) < 0.35 + 0.4 * P.level + (foeEdge > 0.75 ? 0.3 : 0));
      const foeCanUtchari = (foe.hold || foeEdge > 0.97) && foe.stamina > 0.8 && foe.cd <= 0;
      if (wantAttack && P.adapt && foeCanUtchari) { /* pas de dash : il avance et le colle pour vider sa jauge */ }
      else if (wantAttack) {
        if (foe.guard && !foeBack && me.fakeCd <= 0 && feintP > 0) m.wantFeint = true;
        else if (me.cd <= 0 && foeExposed) { if (rand(S) < feintP && me.fakeCd <= 0) m.wantFeint = true; else m.wantDash = true; }
        else if (me.cd <= 0 && P.id === 'oshi') m.wantDash = true;
        else if (me.fakeCd <= 0 && rand(S) < feintP) m.wantFeint = true;
      }
    }
  }
  cmd.mx = m.mx; cmd.my = m.my;
  if (m.wantDash && me.cd <= 0) cmd.dash = true;
  if (m.wantFeint && me.fakeCd <= 0) cmd.feint = true;
  m.wantDash = m.wantFeint = false;
  return cmd;
}

export { STYLES, STYLE_ORDER, aiCommand, aiMem, makeProfile };
