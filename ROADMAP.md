# Dohyō Duel — Vision & feuille de route

## Vision finale

Un jeu de sumo 1v1 (puis 2v2) **en ligne avec classement** : comptes joueurs,
matchmaking par ELO, parties classées contre des inconnus. Aujourd'hui le jeu
est un prototype 100% local (`Dohyō Duel.html`) — cette feuille de route
décrit le chemin pour y arriver, par paliers réalistes.

Contexte : dev solo, à l'aise techniquement. Le online/ranked est un objectif
**long terme** — l'étape en cours est de solidifier le jeu local avant
d'attaquer compte/backend/netcode.

## Palier 1 — Solidifier le local (en cours)

Reste un fichier front pur (HTML/JS), aucun serveur.

- **Physique & contrôles** : déjà solides (dash, garde, feinte, collisions
  avec masse variable). Ne pas re-designer, seulement ajuster si un problème
  de feel apparaît en testant.
- **IA à plusieurs niveaux de difficulté** : ne pas se contenter de gonfler
  des stats (vitesse/réaction). Chaque niveau doit avoir un pattern de
  décision différent (ex : facile = dash au hasard, ignore les feintes ;
  dur = feinte pour piéger la garde, gère la distance au bord). Base actuelle
  dans `inputAI()`.
- **Progression / déblocages** : skins de lutteur, éventuellement variantes
  d'arène. Reste stocké en local (`localStorage`) à ce stade — pas encore de
  compte.
- **Point de vigilance à anticiper dès maintenant** : garder la simulation
  aussi déterministe que possible (pas de `Math.random()` non seedé dans la
  boucle physique si évitable, dt fixe si possible). Ça ne sert à rien
  aujourd'hui, mais ça évite de devoir tout réécrire au Palier 3 pour la
  prédiction réseau.

## Palier 2 — Compte & persistance

- Ajout d'un backend minimal : comptes joueurs, sauvegarde de la progression
  et des déblocages, historique de parties.
- Choix de stack à trancher le moment venu (ex. Node/Express + DB légère, ou
  Firebase/Supabase pour aller vite en solo). Ne pas figer ce choix
  maintenant, tant que le Palier 1 n'est pas stable.
- Le jeu reste jouable en local sans compte ; le compte débloque la
  progression persistante et prépare le online.

## Palier 3 — Online & Ranked (le plus dur)

- **Netcode temps réel** (WebSocket). Point le plus risqué : un jeu avec
  dashs à 620px/s et collisions précises tolère mal le lag brut. Prévoir de
  la prédiction côté client + réconciliation serveur plutôt que d'envoyer les
  positions brutes.
- **Matchmaking + ELO** pour le classement.
- **2v2** : ajoute de la synchro à 4 joueurs, à traiter après que le 1v1
  online tourne correctement — ne pas paralléliser les deux.

## Ce qui ne change pas entre les paliers

- Le cœur du gameplay (dash / garde / feinte / rétrécissement du cercle)
  est figé et ne doit pas être redesigné à chaque palier — seulement affiné.
- Priorité desktop navigateur (clavier). Le mobile/tactile reste secondaire.
