/**
 * Éléments de la page utilisés partout : le canvas de l'arène et l'écran des menus.
 */
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const ov = $('ov'), card = $('card');

export { $, card, ctx, cv, ov };
