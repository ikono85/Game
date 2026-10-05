/**
 * Commandes compactées : direction (normalisée, au centième) + 4 boutons dans un entier de 24 bits.
 * Sert au jeu en ligne (on n'échange que ces entiers) et aux ralentis partageables (on n'enregistre
 * qu'eux). En local aussi, la simulation reçoit la commande compactée : le ralenti rejoue alors
 * exactement la même partie.
 */
import { NOCMD } from './simulation.js';

function packIn(c) {
  let qx = 0, qy = 0;
  const n = Math.hypot(c.mx, c.my);
  if (n > 0) { qx = Math.round(c.mx / n * 100); qy = Math.round(c.my / n * 100); }
  return ((qx + 128) << 16) | ((qy + 128) << 8) | (c.dash ? 1 : 0) | (c.feint ? 2 : 0) | (c.guard ? 4 : 0) | (c.grab ? 8 : 0);
}
function unpackIn(v) {
  return { mx: ((v >> 16) & 255) - 128, my: ((v >> 8) & 255) - 128, dash: !!(v & 1), feint: !!(v & 2), guard: !!(v & 4), grab: !!(v & 8) };
}
const NO_IN = packIn(NOCMD);

/**
 * Commande d'une partie locale (humain ou IA) : direction arrondie à l'une de 64 directions, puis
 * compactée. Le clavier ne donne que 8 directions de toute façon ; pour l'IA et le stick, l'écart est
 * invisible, et le ralenti partagé reste court (la commande change moins souvent).
 */
const DIRS = 64, STEP = 2 * Math.PI / DIRS;
function localCmd(c) {
  if (!c.mx && !c.my) return packIn(c);
  const a = Math.round(Math.atan2(c.my, c.mx) / STEP) * STEP;
  return packIn({ mx: Math.cos(a), my: Math.sin(a), dash: c.dash, feint: c.feint, guard: c.guard, grab: c.grab });
}

export { NO_IN, localCmd, packIn, unpackIn };
