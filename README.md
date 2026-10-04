https://ikono85.github.io/Game/

# Dohyō Duel

Jeu de sumo 1v1 dans le navigateur. Pousse ton adversaire hors du cercle avant
qu'il ne te sorte — et le cercle rétrécit à chaque instant.

Tout le jeu tient dans un seul fichier, `index.html` (sprites intégrés, sons
synthétisés en WebAudio, bibliothèque réseau PeerJS intégrée). Pour jouer en
local : ouvrir `index.html` dans un navigateur. Les sources sont découpées en
modules dans `src/` (voir « Organisation du projet »).

## Modes

- **Carrière** — monte le banzuke du Jonokuchi au Yokozuna. Un basho = 7 jours,
  un combat en une manche par jour. Majorité de victoires (kachi-koshi) =
  promotion, sinon rétrogradation. Les rangs débloquent des mawashi (ceintures)
  au Vestiaire. Progression sauvegardée en local (`localStorage`).
- **Dojo** — huit leçons courtes contre un apprenti, une par technique : le dash,
  le départ (tachiai), la garde, la feinte, le henka, tenir au bord, l'utchari,
  les hanches basses. Les leçons réussies sont sauvegardées en local.
- **Arènes** — en plus de la salle de Ryōgoku, quatre lieux en plein air,
  chacun avec sa propre carte : le sanctuaire aux cerisiers (torii, hall du
  sanctuaire, pique-niques sous les fleurs), le matsuri d'été (de nuit, entre les
  échoppes, les lanternes et les feux d'artifice), le temple d'automne (pagode,
  étang aux carpes, érables) et le village sous la neige (fermes au toit de
  chaume, huttes de neige, braseros, ombrelles). Purement visuelles : les cartes
  sont dessinées par le code, sans image. En carrière, chaque basho suit le vrai
  calendrier (Hatsu en janvier, Haru en mars… six par an) et se déroule dans son
  arène ; atteindre un basho débloque son arène au Vestiaire pour les autres
  modes (ou « Au hasard »). En ligne, c'est l'arène de l'hôte.
- **2 joueurs** — même clavier ou deux manettes, premier à 3 manches.
- **Contre l'IA** — 5 lutteurs aux styles différents, premier à 3 manches.
- **En ligne** — un joueur par écran, voir ci-dessous.

## Ralentis partagés

Après chaque match (contre l'IA, à deux, en carrière ou en ligne), **Partager le
ralenti** copie un lien. Celui qui l'ouvre revoit tout le combat, manche par manche :
pause (Espace), vitesse ×1 / ×2 / ×0,5 (V), manche suivante (→).

Le lien ne contient pas de vidéo : seulement la graine du match et les commandes
des joueurs humains, tick par tick, compressées (quelques centaines à quelques
milliers de caractères). L'IA, déterministe, est rejouée telle quelle. Chaque
manche repart de son état enregistré : si un autre navigateur calcule un sinus un
poil différent et que le combat dérive, la manche suivante et le score final
restent justes. Un lien créé depuis le fichier local pointe vers le jeu publié
(https://ikono85.github.io/Game/).

`REPLAY_VER` (dans `src/game/replayfile.js`) est à augmenter quand la physique ou
l'IA change : un ancien lien affiche alors « Autre version du jeu » au lieu de
rejouer un combat faux.

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
| Henka (pas de côté) | Quand il charge : une direction sur le côté + Espace | côté + Entrée | côté + A |
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

**Garde** : de face, elle te rend très lourd et bloque les dashs (chaque blocage
coûte un peu de jauge). Une charge lancée de loin reste bloquable tant qu'elle
arrive encore lancée, moins de 0,45 s après son départ. De dos, la garde ne
protège presque pas.

**Henka** : quand l'adversaire charge (un vrai dash, pas une feinte) et qu'il
n'est pas encore sur toi, choisis une direction sur le côté et dash : il te
frôle sans te pousser, puis, emporté par son élan, ne contrôle plus rien un
instant (« Dans le vide ! »). Au bord, il sort tout seul. Trop tard (déjà au
contact), c'est un dash normal ; contre une feinte, ton dash part droit devant.
C'est légal mais mal vu : la foule siffle, et une victoire sur un henka ne fait
pas voler les coussins.

**Prises (kimarite)** : chaque manche gagnée affiche sa prise, aussi au ralenti,
dans les stats et dans les ralentis partagés : oshidashi (sorti par une charge),
yorikiri (poussé dehors au corps à corps), okuridashi (poussé par derrière),
hatakikomi (esquivé par un henka), utchari (pivot au bord), isamiashi (sorti
tout seul).

**Tachiai** : attends « Hakkeyoi ! ». Un dash juste après le signal pousse 30 %
plus fort ; un dash avant le signal est un faux départ (matta) qui te fige un
instant.

## Les adversaires IA

| Lutteur | Style |
|---|---|
| ★☆☆☆☆ le Pousseur | Fonce et dashe dès qu'il est aligné, garde rarement |
| ★★☆☆☆ le Mur | Tient le centre, garde, contre-attaque quand ta jauge de dash est vide |
| ★★★☆☆ le Renard | Feinte pour te faire garder, frappe quand ta garde est vide |
| ★★★☆☆ le Danseur | Tourne autour de toi, esquive tes charges d'un henka au lieu de garder |
| ★★★★★ le Yokozuna | Lit les feintes, gère le bord, s'adapte à tes habitudes |

Chaque style a son propre schéma de décision (pas seulement des stats
gonflées). Les décisions sont prises à cadence fixe et l'IA ne « triche » pas :
pour distinguer une feinte d'un vrai dash, elle regarde la vitesse réelle de
l'adversaire.

## Organisation du projet

Le jeu publié est **un seul fichier**, `index.html` : on peut l'ouvrir d'un
double-clic, le partager, le déposer n'importe où. Mais on ne le modifie pas à
la main : il est **fabriqué** à partir des sources.

```
index.html          le jeu, fabriqué par build.mjs (ne pas modifier à la main)
build.mjs           assemble src/ + assets/ + PeerJS en un seul index.html
src/
  index.html        le squelette de la page (bandeau, arène, boutons tactiles)
  style.css         tout le style (menus, bandeau, commandes…)
  main.js           point d'entrée : démarre le jeu
  assets.js         liste des images du décor
  sim/              la simulation, sans rien d'affichage
    constants.js      tailles, physique, temps (dash, garde, utchari…)
    cmd.js            commandes compactées (jeu en ligne, ralentis)
    simulation.js     un tick de jeu : déplacements, chocs, bord, utchari, manches
    ai.js             les 5 lutteurs IA et leurs styles
  render/           ce qui se dessine
    sprites.js        planche du lutteur, ceintures (skins)
    draw.js           l'arène, les lutteurs, les invites à l'écran
    effects.js        particules, sons et stats déclenchés par la simulation
    arenas.js         ambiance des arènes : pétales, feuilles, neige, feux d'artifice ; vignettes
    scenes/           les cartes dessinées par le code (une par arène) et leurs outils
    replay.js         le ralenti du coup gagnant
    view.js           plein écran, fond mis en cache, gradins prolongés
  audio/sound.js    les sons, synthétisés
  input/            clavier (touches modifiables), manette, tactile
  ui/               écrans : menu, commandes, carrière, vestiaire, pause, bandeau
  game/             état partagé, boucle principale, match local, carrière, sauvegarde,
                    dojo (dojo.js, leçons dans dojolessons.js),
                    ralentis partagés (replayfile.js : enregistrement et lien ; watch.js : lecteur),
                    arènes et calendrier des basho (arenalist.js)
  net/              le mode en ligne (connexion, rollback, écrans)
assets/             les vraies images : wrestler.webp (planche), map.jpg, crowd.png
tests/              tests de la simulation
```

La simulation (`src/sim/`) est **déterministe** : pas fixe de 1/120 s, RNG
seedé dont l'état vit dans la partie, commandes par tick
`{mx, my, dash, feint, guard}`, aucune dépendance au DOM ni à `Math.random`.
Même graine + mêmes commandes = même partie : c'est ce qui permet le ralenti,
les tests et le jeu en ligne à rollback. L'affichage, lui, lit l'état de la
partie et les événements qu'elle émet (`hit`, `block`, `roundWin`…).

## Modifier le jeu

Il faut [Node.js](https://nodejs.org) (version 20 ou plus), une seule fois.
Dans le dossier du projet :

```bash
npm install        # une seule fois : installe esbuild et PeerJS
npm run dev        # ouvre le jeu dans le navigateur et le recharge à chaque modification
npm run build      # reconstruit index.html une fois
npm test           # tests de la simulation
```

`npm run dev` ouvre le jeu sur http://localhost:5173. Modifie un fichier de
`src/` ou `assets/` et enregistre : `index.html` est reconstruit et la page se
recharge toute seule. Si le code a une erreur, elle s'affiche dans la fenêtre
de commande et la page garde la dernière version qui marchait. Pour changer un sprite, remplace l'image
dans `assets/` (même taille et même disposition : 240 px par image, une rangée
par animation).

Sur GitHub, chaque modification de `main` lance les tests et reconstruit
`index.html` s'il n'est pas à jour ; GitHub Pages publie ensuite le jeu.

## Tests

Les tests (`tests/sim.test.mjs`) importent la simulation et vérifient le
déterminisme, le faux départ, le tachiai, le rétrécissement du cercle, la
tenue au bord, l'utchari et son contre, que chaque IA termine ses matchs, et
les deux propriétés dont dépend le jeu en ligne : revenir à un état copié
puis resimuler redonne la même partie, et un état passé par JSON (la synchro
de l'hôte) continue la même partie.

`tests/replay.test.mjs` vérifie qu'un lien de ralenti rejoue exactement le même
match, qu'un combat qui dérive retombe sur le bon score, et qu'un lien abîmé est
refusé proprement. `tests/dojo.test.mjs` joue chaque leçon du dojo avec un joueur
scripté : elle se réussit en suivant la consigne, et pas en restant immobile.

## Publication

GitHub Pages publie la branche `main` telle quelle (Settings → Pages →
Deploy from a branch → `main`, `/ (root)`) : le jeu est sur
https://ikono85.github.io/Game/. Le fichier `.nojekyll` évite à GitHub de
passer les fichiers dans Jekyll.

## Feuille de route

Voir [`ROADMAP.md`](ROADMAP.md) : solidifier le local (en cours), puis comptes
et persistance, puis online classé.
