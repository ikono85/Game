https://ikono85.github.io/Game-navigateur/

# Dohyō Duel

Jeu de sumo 1v1 dans le navigateur. Pousse ton adversaire hors du cercle avant
qu'il ne te sorte — et le cercle rétrécit à chaque instant.

Tout le jeu tient dans un seul fichier, `index.html` (sprites intégrés, sons
synthétisés en WebAudio, aucune dépendance). Pour jouer en local : ouvrir
`index.html` dans un navigateur.

## Modes

- **Carrière** — monte le banzuke du Jonokuchi au Yokozuna. Un basho = 7 jours,
  un combat en une manche par jour. Majorité de victoires (kachi-koshi) =
  promotion, sinon rétrogradation. Les rangs débloquent des mawashi (ceintures)
  au Vestiaire. Progression sauvegardée en local (`localStorage`).
- **2 joueurs** — même clavier ou deux manettes, premier à 3 manches.
- **Contre l'IA** — 5 lutteurs aux styles différents, premier à 3 manches.

## Commandes

| Action | Rouge | Bleu | Manette |
|---|---|---|---|
| Bouger | Z Q S D (W A S D en QWERTY) | Flèches | Stick / croix |
| Dash | Espace | Entrée | A |
| Garde (maintenir) | E | Maj droite / 0 pavé | B / gâchettes |
| Feinte | F | Ctrl droit / 1 pavé | X |
| Pause | Échap | Échap | Start |

Touche **M** : couper le son. Contre l'IA, les deux jeux de touches contrôlent
le rouge.

**Tachiai** : attends « Hakkeyoi ! ». Un dash juste après le signal pousse 30 %
plus fort ; un dash avant le signal est un faux départ (matta) qui te fige un
instant.

## Les adversaires IA

| Lutteur | Style |
|---|---|
| ★☆☆☆☆ le Pousseur | Fonce et dashe dès qu'il est aligné, garde rarement |
| ★★☆☆☆ le Mur | Tient le centre, garde, contre-attaque quand ta jauge de dash est vide |
| ★★★☆☆ le Renard | Feinte pour te faire garder, frappe quand ta garde est vide |
| ★★★☆☆ le Danseur | Tourne autour de toi, esquive au lieu de garder |
| ★★★★★ le Yokozuna | Lit les feintes, gère le bord, s'adapte à tes habitudes |

Chaque style a son propre schéma de décision (pas seulement des stats
gonflées). Les décisions sont prises à cadence fixe et l'IA ne « triche » pas :
pour distinguer une feinte d'un vrai dash, elle regarde la vitesse réelle de
l'adversaire.

## Architecture (dans `index.html`)

1. **Simulation déterministe** — pas fixe de 1/120 s, RNG seedé (mulberry32,
   état stocké dans la partie), commandes par tick `{mx, my, dash, feint, guard}`,
   fin de manche en temps simulé. Aucune dépendance au DOM ni à `Math.random`.
   Même graine + mêmes commandes = même partie : base pour les replays et la
   prédiction réseau (voir `ROADMAP.md`).
2. **IA** — produit les mêmes commandes qu'un joueur, à partir de ce qu'elle
   peut voir.
3. **Présentation** — rendu canvas interpolé entre deux ticks, particules,
   foule, sons ; la simulation lui transmet des événements (`hit`, `block`,
   `roundWin`…).
4. **Entrées** — clavier par touche physique (`e.code`), API Gamepad, tactile
   (un doigt suivi par identifiant).
5. **Menus, carrière, vestiaire, sauvegarde.**

## Tests

```bash
node --test tests/sim.test.mjs
```

Les tests extraient la simulation directement de `index.html` et vérifient le
déterminisme, le faux départ, le tachiai, le rétrécissement du cercle et que
chaque IA termine ses matchs. Ils tournent aussi avant chaque déploiement
GitHub Pages (`.github/workflows/deploy.yml`).

## Feuille de route

Voir [`ROADMAP.md`](ROADMAP.md) : solidifier le local (en cours), puis comptes
et persistance, puis online classé.
