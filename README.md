https://ikono85.github.io/Game/

# Dohyō Duel

Jeu de sumo 1v1 dans le navigateur. Pousse ton adversaire hors du cercle avant
qu'il ne te sorte — et le cercle rétrécit à chaque instant.

Tout le jeu tient dans un seul fichier, `index.html` (sprites intégrés, sons
synthétisés en WebAudio, bibliothèque réseau PeerJS intégrée). Pour jouer en
local : ouvrir `index.html` dans un navigateur.

## Modes

- **Carrière** — monte le banzuke du Jonokuchi au Yokozuna. Un basho = 7 jours,
  un combat en une manche par jour. Majorité de victoires (kachi-koshi) =
  promotion, sinon rétrogradation. Les rangs débloquent des mawashi (ceintures)
  au Vestiaire. Progression sauvegardée en local (`localStorage`).
- **2 joueurs** — même clavier ou deux manettes, premier à 3 manches.
- **Contre l'IA** — 5 lutteurs aux styles différents, premier à 3 manches.
- **En ligne** — un joueur par écran, voir ci-dessous.

## En ligne

| Mode | Comment |
|---|---|
| Partie rapide | Affronte le premier joueur qui lance aussi une partie rapide (premier à 3 manches). |
| Duel privé | Tu reçois un code de 5 lettres (et un lien) à envoyer à ton ami. Format au choix : 1 manche, premier à 2 ou premier à 3. |
| Rejoindre avec un code | Tape le code de ton ami, ou ouvre simplement son lien. |
| Classé | Pas encore : il faut des comptes et un serveur (voir `ROADMAP.md`). |

Pas de serveur de jeu : les deux navigateurs se connectent directement
(WebRTC). Le serveur public gratuit de PeerJS sert uniquement à se trouver
(le code du duel est un identifiant PeerJS) ; il est libéré dès que le combat
commence. La partie rapide marche de la même façon, avec 6 emplacements fixes
où un joueur attend qu'un autre le rejoigne.

Netcode à **rollback** : chacun simule la partie (simulation déterministe) et
on n'échange que les commandes, appliquées 2 ticks (17 ms) plus tard. La
commande adverse qui n'est pas encore arrivée est prédite (il continue ce
qu'il faisait) ; quand elle arrive et diffère, on revient à l'état sauvegardé
et on resimule jusqu'à maintenant. Celui qui a de l'avance ralentit un peu
pour que les corrections restent courtes. Comme `Math.sin`, `Math.exp`… peuvent
différer d'un navigateur à l'autre au dernier chiffre près, l'hôte envoie son
état toutes les 0,5 s et l'invité se recale dessus ; la fin du match est
décidée par l'hôte. Pas de pause en ligne : Échap propose d'abandonner
(victoire par forfait pour l'autre). Ping affiché dans le bandeau.

Limites : certains réseaux (école, entreprise) bloquent les connexions
directes ; PeerJS fournit un relais (TURN) gratuit, sans garantie. Au-delà
d'environ 150 ms de ping, les corrections deviennent visibles.

## Commandes

Toutes les touches se changent dans le menu **Commandes** : clique sur une
touche (ou sur **+** pour en ajouter une seconde), puis appuie sur la nouvelle.
Ça marche pour le clavier des deux joueurs et pour les boutons de manette
(Dash, Garde, Feinte). Une touche déjà prise ailleurs est échangée avec
l'ancienne ; Échap reste la pause. Les réglages sont sauvegardés dans le
navigateur, et « Touches par défaut » remet tout comme au départ.

Touches par défaut :

| Action | Rouge | Bleu | Manette |
|---|---|---|---|
| Bouger | Z Q S D (W A S D en QWERTY) | Flèches | Stick / croix |
| Dash | Espace | Entrée | A |
| Garde (maintenir) | E | Maj droite / 0 pavé | B / gâchettes |
| Feinte | F | Ctrl droit / 1 pavé | X |
| Pause | Échap | Échap | Start |
| Tenir au bord | Sur la paille, pousser vers le centre | idem | Stick vers le centre |
| Utchari | Au bord, quand il te pousse : Espace | Entrée | A |
| Hanches basses (contre) | Quand on tente l'utchari sur toi : E | Maj droite | B |

Touche **M** : couper le son. Contre l'IA et en ligne, les deux jeux de
touches contrôlent ton lutteur.

**Tenir au bord (tawara)** : les talons sur les ballots de paille, pousser vers
le centre freine la poussée adverse, mais vide la jauge de garde (1 s). Jauge
vide = les talons glissent.

**Utchari** : quand l'adversaire te pousse sur les ballots, « Utchari » s'affiche
au-dessus de ton lutteur : un dash (dans n'importe quelle direction, elle ne
fait que choisir le sens du pivot) fait pivoter les deux lutteurs autour du
point de contact, et c'est l'attaquant qui sort. L'invite reste valable 0,45 s
pour laisser le temps de réagir. Impossible si l'attaquant pousse garde levée ;
coûte le dash et une partie de la jauge.

**Hanches basses** : l'utchari commence par 0,28 s où l'on soulève l'adversaire.
Pendant ce temps, l'attaquant voit « Hanches basses » et peut appuyer sur sa
garde : l'utchari échoue (« Contré ! ») et celui qui l'a tenté reste
déséquilibré au bord une demi-seconde, sans dash.

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
6. **En ligne** — connexion PeerJS, rollback, synchro de l'hôte, écrans du
   mode en ligne. PeerJS est intégré dans une balise `<script type="text/plain">`
   et n'est exécuté que si l'on joue en ligne.

## Tests

```bash
node --test tests/sim.test.mjs
```

Les tests extraient la simulation directement de `index.html` et vérifient le
déterminisme, le faux départ, le tachiai, le rétrécissement du cercle, que
chaque IA termine ses matchs, et les deux propriétés dont dépend le jeu en
ligne : revenir à un état copié puis resimuler redonne la même partie, et un
état passé par JSON (la synchro de l'hôte) continue la même partie. Ils tournent aussi à chaque push
(`.github/workflows/tests.yml`).

## Publication

GitHub Pages publie la branche `main` telle quelle (Settings → Pages →
Deploy from a branch → `main`, `/ (root)`) : le jeu est sur
https://ikono85.github.io/Game/. Le fichier `.nojekyll` évite à GitHub de
passer les fichiers dans Jekyll.

## Feuille de route

Voir [`ROADMAP.md`](ROADMAP.md) : solidifier le local (en cours), puis comptes
et persistance, puis online classé.
