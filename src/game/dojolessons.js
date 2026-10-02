/**
 * Les leçons du dojo : où placer les deux lutteurs, ce que fait l'apprenti (le partenaire
 * d'entraînement) et ce qui compte comme réussi. Aucune dépendance au DOM : les leçons se testent
 * sous Node avec un joueur scripté.
 *
 * Une leçon :
 *   setup(S, D)      place les lutteurs (S vient de newMatch) ; D = mémoire de la tentative
 *   dummy(S, D)      commande de l'apprenti à ce tick
 *   check(S, ev, D)  après chaque tick, avec ses événements : null, { ok, msg }, { fail, msg } ou { info }
 *   goal(k)          consigne ; k(action) donne le nom de la touche ('dash', 'guard', 'feint', 'move')
 *   reps             nombre de réussites demandées (counter : la leçon compte elle-même, dans D.count)
 *   shikiri          garde l'attente du signal (sinon le combat commence tout de suite)
 */
import { C, PI, R0, TACHIAI_WINDOW } from '../sim/constants.js';
import { NOCMD, canUtchari } from '../sim/simulation.js';

function put(p, x, y, face) {
  p.x = p.px = x; p.y = p.py = y; p.face = face; p.vx = p.vy = 0;
  p.usedTachiai = true;                      // pas de « temps de réaction » affiché hors de la leçon du départ
}
/** Combat lancé tout de suite, sans attendre le signal. */
function playNow(S) { S.phase = 'play'; S.phaseT = 0; S.roundT = 2; }
const toward = (a, b, k = 1) => ({ ...NOCMD, mx: (b.x - a.x) * k, my: (b.y - a.y) * k });
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const has = (ev, type, who) => ev.find(e => e.type === type && (who == null || e.who === who));
const fmt = t => t.toFixed(2).replace('.', ',') + ' s';
/** L'apprenti qui te pousse vers le bord : il avance et donne des coups d'épaule (feintes) à répétition. */
const bully = () => ({ ...NOCMD, mx: -1, feint: true });
const out = (ev, who) => ev.some(e => e.type === 'roundWin' && e.who === 1 - who);   // « who » est sorti

const LESSONS = [
  {
    id: 'dash', title: 'Le dash', kanji: '突', reps: 1,
    goal: k => `Approche-toi avec ${k('move')}, puis ${k('dash')} pour charger. Sors l'apprenti du cercle.`,
    learned: 'Le dash est ta poussée la plus forte. Il se recharge en 1,4 s : la jauge « Dash » du bandeau le montre.',
    setup(S) { playNow(S); put(S.p[0], C - 170, C, 0); put(S.p[1], C + 110, C, PI); },
    dummy: () => NOCMD,
    check(S, ev) {
      if (out(ev, 1)) return { ok: true, msg: 'Dehors !' };
      if (out(ev, 0)) return { fail: true, msg: 'C’est toi qui es sorti. Vise l’apprenti, puis dash.' };
      return null;
    },
  },
  {
    id: 'tachiai', title: 'Le départ', kanji: '立合', reps: 2, shikiri: true,
    goal: k => `Attends « Hakkeyoi ! », puis ${k('dash')} tout de suite. En moins de 0,35 s, ta charge pousse 30 % plus fort.`,
    learned: 'Un bon tachiai fait souvent la manche. Mais un dash avant le signal est un faux départ (matta) : tu restes figé un instant.',
    setup() { /* l'attente du signal, comme en vrai */ },
    dummy: () => NOCMD,
    check(S, ev) {
      if (has(ev, 'matta', 0)) return { fail: true, msg: 'Trop tôt : faux départ (matta). Attends le signal.' };
      const r = has(ev, 'reaction', 0);
      if (r && r.perfect) return { ok: true, msg: `Tachiai parfait : ${fmt(r.t)}` };
      if (r) return { fail: true, msg: `Trop tard : ${fmt(r.t)}. Il faut moins de ${fmt(TACHIAI_WINDOW)}.` };
      if (S.phase === 'play' && S.roundT > 1.6 && !S.p[0].usedTachiai) return { fail: true, msg: 'Dash dès que « Hakkeyoi ! » s’affiche.' };
      return null;
    },
  },
  {
    id: 'garde', title: 'La garde', kanji: '守', reps: 3, counter: true,
    goal: k => `L'apprenti va charger. Reste face à lui et maintiens ${k('guard')} juste avant le choc. Bloque 3 dashs.`,
    learned: 'De face, la garde te rend très lourd. Mais elle ne protège pas de dos, et la jauge « Garde » se vide : ne la tiens pas en permanence.',
    setup(S, D) { playNow(S); put(S.p[0], C - 60, C, 0); put(S.p[1], C + 200, C, PI); D.next = S.tick + 100; D.charge = 0; },
    dummy(S, D) {
      const me = S.p[1], foe = S.p[0], d = dist(me, foe);
      if (S.tick < D.charge) return toward(me, foe);                          // la charge continue jusqu'au choc
      if (S.tick < D.next) return d < 260 ? toward(foe, me) : { ...NOCMD };   // il reprend ses distances, puis attend
      const c = toward(me, foe);                                   // il se tourne vers toi et charge
      const aimed = Math.cos(Math.atan2(foe.y - me.y, foe.x - me.x) - me.face) > 0.97;
      if (d <= 190 && aimed && me.cd <= 0) { c.dash = true; D.charge = S.tick + 40; D.next = S.tick + 190; }
      return c;
    },
    check(S, ev, D) {
      if (has(ev, 'block', 0)) { D.count = (D.count || 0) + 1; return D.count >= 3 ? { ok: true, msg: 'Trois dashs bloqués !' } : { info: `Bloqué ! ${D.count} sur 3` }; }
      if (out(ev, 0)) return { fail: true, msg: 'Tu es sorti. Garde levée, face à lui, juste avant le choc.' };
      if (out(ev, 1)) return { reset: true, msg: 'Il est sorti tout seul : on le remet en place.' };
      const hit = ev.find(e => e.type === 'hit' && e.dash[1] && e.force > 250);
      if (hit && !S.p[0].guard) return { info: 'Touché ! Garde levée avant qu’il arrive.' };
      return null;
    },
  },
  {
    id: 'feinte', title: 'La feinte', kanji: '偽', reps: 1,
    goal: k => `L'apprenti lève sa garde dès qu'il te voit charger. ${k('feint')} pour une feinte : il garde dans le vide. Quand sa garde retombe, ${k('dash')} et sors-le.`,
    learned: 'La feinte a l’allure d’un dash sans en avoir la force. Elle fait garder l’adversaire pour rien, et ne coûte pas ton dash.',
    setup(S, D) { playNow(S); put(S.p[0], C - 160, C, 0); put(S.p[1], C + 90, C, PI); D.guardUntil = 0; D.calmUntil = 0; },
    dummy(S, D) {
      const me = S.p[1], foe = S.p[0], d = dist(me, foe);
      const charging = foe.dashT > 0 || foe.fakeT > 0;
      if (charging && d < 420 && S.tick >= D.calmUntil && S.tick >= D.guardUntil) {
        D.guardUntil = S.tick + 72;                // garde 0,6 s…
        D.calmUntil = D.guardUntil + 120;          // …puis il lui faut 1 s pour la relever
      }
      const home = { x: C + 90, y: C }, guard = S.tick < D.guardUntil;
      // il revient à sa place (au centre) ; une fois arrivé, il ne bouge plus
      const c = !guard && dist(me, home) > 20 ? toward(me, home) : { ...NOCMD };
      return { ...c, guard };
    },
    check(S, ev, D) {
      if (has(ev, 'feint', 0)) { D.feinted = true; return { info: 'Il garde dans le vide… dash quand sa garde retombe !' }; }
      if (has(ev, 'block', 1)) return { info: 'Bloqué : il a vu venir ton dash. Feinte d’abord.' };
      if (out(ev, 1)) return D.feinted ? { ok: true, msg: 'Feinte, puis dash : dehors !' } : { fail: true, msg: 'Sorti, mais sans feinte. Recommence avec une feinte.' };
      if (out(ev, 0)) return { fail: true, msg: 'C’est toi qui es sorti.' };
      return null;
    },
  },
  {
    id: 'tawara', title: 'Tenir au bord', kanji: '俵', reps: 2,
    goal: k => `Tu es sur les ballots de paille et l'apprenti te pousse dehors. Pousse tout de suite vers le centre avec ${k('move')} : tes talons se plantent dans la paille.`,
    learned: 'Au bord, pousser vers le centre freine sa poussée. Mais ça vide ta jauge de garde en 1 s : ensuite, les talons glissent.',
    setup(S, D) { playNow(S); put(S.p[0], C - R0 + 14, C, 0); put(S.p[1], C - R0 + 204, C, PI); D.held = 0; },
    dummy: bully,
    check(S, ev, D) {
      if (S.p[0].hold) D.held += 1 / 120;
      if (D.held >= 0.3) return { ok: true, msg: 'Tenu !' };
      if (out(ev, 0)) return { fail: true, msg: 'Sorti. Pousse vers le centre dès qu’il arrive sur toi.' };
      if (out(ev, 1)) return { reset: true, msg: 'Pas besoin de le sortir : tiens juste au bord.' };
      return null;
    },
  },
  {
    id: 'utchari', title: 'L’utchari', kanji: '打棄', reps: 1,
    goal: k => `L'apprenti arrive sur toi. Quand « Utchari » s'affiche au-dessus de ton lutteur, ${k('dash')} : tu pivotes sur la paille et c'est lui qui sort.`,
    learned: 'L’utchari retourne une défaite au bord. La direction choisit seulement le sens du pivot. Impossible si l’adversaire pousse garde levée.',
    setup(S) { playNow(S); put(S.p[0], C - R0 + 14, C, 0); put(S.p[1], C - R0 + 204, C, PI); },
    dummy: bully,
    check(S, ev) {
      if (has(ev, 'utchari', 0)) return { ok: true, msg: 'Utchari !' };
      if (out(ev, 0)) return { fail: true, msg: 'Sorti. Dash dès que « Utchari » s’affiche au-dessus de toi.' };
      if (out(ev, 1)) return { reset: true, msg: 'Il est sorti, mais sans utchari. Encore une fois !' };
      return null;
    },
  },
  {
    id: 'hanches', title: 'Hanches basses', kanji: '腰', reps: 1,
    goal: k => `Pousse l'apprenti vers le bord avec ${k('move')}. Il va tenter l'utchari : pendant qu'il te soulève (« Hanches basses »), appuie sur ${k('guard')}.`,
    learned: 'Contre l’utchari, baisser les hanches au bon moment le fait échouer : celui qui l’a tenté reste déséquilibré au bord.',
    setup(S, D) { playNow(S); put(S.p[1], C + R0 - 6, C, PI); put(S.p[0], C + R0 - 150, C, 0); D.seen = -1; },
    dummy(S, D) {
      const me = S.p[1], foe = S.p[0];
      const c = dist(me, foe) < 130 ? { ...NOCMD, mx: C - me.x, my: C - me.y } : { ...NOCMD };   // il plante les talons quand tu arrives
      if (canUtchari(S, 1)) {
        if (D.seen < 0) D.seen = S.tick;
        if (S.tick - D.seen >= 18) { c.dash = true; c.mx = 0; c.my = 1; }
      } else D.seen = -1;
      return c;
    },
    check(S, ev) {
      if (has(ev, 'utchariCounter', 0)) return { ok: true, msg: 'Contré !' };
      if (has(ev, 'utchari', 1)) return { fail: true, msg: 'Projeté ! Pendant qu’il te soulève, appuie sur la garde.' };
      if (out(ev, 0)) return { fail: true, msg: 'C’est toi qui es sorti.' };
      if (out(ev, 1)) return { reset: true, msg: 'Sorti avant son utchari. Pousse-le en marchant, sans dash.' };
      return null;
    },
  },
];

export { LESSONS };
