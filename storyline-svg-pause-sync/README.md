# Storyline SVG pause sync

## Description

Ce script synchronise un état Storyline (Play/Pause) avec des animations SVG dans la page. Le cas d'usage initial était de mettre en pause une animation SVG de waveform lorsqu'un audio inséré dans Storyline se complétait.

La logique reste toutefois générique et peut être réutilisée dans d'autres scénarios de communication entre Storyline et SVG.

## Objectifs principaux :

- garder la cohérence visuelle entre l'état Storyline et l'animation SVG ;
- éviter qu'une animation SVG continue pendant une pause Storyline ;
- proposer une base réutilisable pour synchroniser Storyline et SVG dans d'autres cas.

## Fonctionnement

1. Le script s'installe une seule fois via un garde-fou global (`window.__pauseFreezeInstalled`).
2. Il attend l'apparition du bouton Storyline `#play-pause`.
3. Il dérive l'état pause/play via `aria-label` et, en fallback, via les icônes `#icon-play` / `#icon-pause`.
4. En pause, il injecte un style qui applique `animation-play-state: paused` sur les éléments SVG cibles (ici les classes contenant `bar`).
5. En lecture, il retire ce style pour laisser les animations reprendre.
6. Il surveille aussi les changements d'état externes avec un `MutationObserver`.

## Important

- Le script vise la structure du player Storyline (`#play-pause`, `#icon-play`, `#icon-pause`) et un sélecteur SVG cible (ici classes contenant `bar`).
- Si ton SVG n'utilise pas de classes `bar`, adapte le sélecteur dans le CSS injecté.
- Le script doit être exécuté sur les écrans/layers où le SVG cible est présent.
- Comme Storyline évolue au fil des versions, certains sélecteurs peuvent nécessiter un ajustement.

## Utilisation

- Option recommandée : coller le script dans un déclencheur **Execute JavaScript**.
- Déclenchement courant :
  - au début de la timeline de la slide/layer contenant le SVG à synchroniser ;
  - ou lors de l'ouverture d'un layer si le bouton player est déjà chargé.
- Fichier principal : `script.js`.
