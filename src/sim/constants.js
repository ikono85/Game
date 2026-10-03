/**
 * Constantes de la simulation (arène, physique, temps) et petits utilitaires.
 */
const W = 1408, C = W / 2;          // la map fait 352 px, affichée à l'échelle 4
const R0 = 380, RMIN = 170;          // rayon de départ et minimum du dohyō
const SIM_HZ = 120, DT = 1 / SIM_HZ; // pas fixe de la simulation
const GUARD_MAX = 1.8;               // secondes de garde avant de craquer
const DASH_CD = 1.4, DASH_T = 0.25, DASH_IMPULSE = 620;
// Une charge lancée de loin arrive souvent après la fin du dash (0,25 s) : elle compte encore comme
// une charge (bloquable par la garde) si elle arrive moins de CHARGE_T après le départ, encore lancée.
const CHARGE_T = 0.45, CHARGE_V = 300;
// Henka : un dash sur le côté au moment où l'adversaire charge, avant qu'il ne touche. Il me frôle
// pendant HENKA_WINDOW sans me pousser, puis, emporté par son élan, ne contrôle plus rien pendant HENKA_STUN.
const HENKA_RANGE = 170, HENKA_SIDE = 0.6, HENKA_POWER = 0.85, HENKA_WINDOW = 0.3, HENKA_STUN = 0.45;
const FEINT_CD = 0.7, FEINT_T = 0.25, FEINT_IMPULSE = 70;
const ACC = 1500, FRICTION = 3.2, MAXV = 420;
const SHRINK_DELAY = 6, SHRINK_SPEED = 9;
const TACHIAI_WINDOW = 0.35, TACHIAI_BONUS = 1.3, MATTA_STUN = 0.5;
const ROUND_END_T = 1.1;
// Tenir au bord (tawara) : les talons sur la paille, en poussant vers le centre
const EDGE_ZONE = 7;          // on « tient » dès que le centre dépasse (anneau - 7) ; on sort à (anneau + 13)
const HOLD_BRAKE = 4;         // freinage de la vitesse vers l'extérieur (par seconde)
const HOLD_DRAIN = 1.8;       // la jauge de garde se vide en 1 s
const HOLD_MASS = 1.3;        // plus lourd à pousser quand on tient face au centre
// Utchari : pivot autour du point de contact, l'adversaire est projeté dehors
// UT_BRACE : il soulève l'adversaire ; pendant ce temps, l'adversaire peut baisser les hanches (sa garde) pour contrer
const UT_BRACE = 0.28, UT_SWING = 0.22, UT_TOTAL = 0.62, UT_THROW = 520, UT_COST = 0.5, UT_FAIL_STUN = 0.5;
const PI = Math.PI, TAU = PI * 2;
const COLORS = { red: '#d2412f', blue: '#2f6fb3' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export {
  ACC, C, CHARGE_T, CHARGE_V, COLORS, DASH_CD, HENKA_POWER, HENKA_RANGE, HENKA_SIDE, HENKA_STUN, HENKA_WINDOW, DASH_IMPULSE, DASH_T, DT, EDGE_ZONE, FEINT_CD, FEINT_IMPULSE, FEINT_T,
  FRICTION, GUARD_MAX, HOLD_BRAKE, HOLD_DRAIN, HOLD_MASS, MATTA_STUN, MAXV, PI, R0, RMIN,
  ROUND_END_T, SHRINK_DELAY, SHRINK_SPEED, SIM_HZ, TACHIAI_BONUS, TACHIAI_WINDOW, TAU, UT_BRACE,
  UT_COST, UT_FAIL_STUN, UT_SWING, UT_THROW, UT_TOTAL, W, clamp,
};
