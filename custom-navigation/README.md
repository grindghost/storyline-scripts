# Custom navigation

## Description

Ce script personnalise les boutons précédent et suivant du player Storyline. Il s'agit d'un script expérimental.

## Objectifs principaux :

- déplacer les boutons précédent/suivant au centre vertical de la slide ;
- conserver un style visuel personnalisé ;
- éviter de casser la barre de contrôle audio/vidéo en bas ;
- corriger la répartition des contrôles (seek, refresh, volume, fullscreen) ;
- garder un comportement stable lors des changements de slide.

## Fonctionnement

1. Le script ajoute un style CSS dédié pour les boutons et leurs icônes.
2. Il déplace `#prev` et `#next` dans un overlay fixe (`#custom-storyline-nav-overlay`) au-dessus de la slide.
3. Il calcule la position des boutons à partir de la zone slide visible (`getSlideRect()`), puis les place à gauche et à droite.
4. Il applique un redimensionnement dynamique :
   - le bouton, l’icône, l’offset latéral et le rayon suivent la taille de la slide.
5. Il corrige la barre du bas :
   - réduit `#nav-controls` à la largeur utile ;
   - replace `playback-controls`, `misc-controls` et `nav-controls` ;
   - étire la seek bar pour utiliser l’espace disponible ;
   - rapproche `reset` et `volume`.
6. Il relance plusieurs recalculs via un intervalle court au chargement de slide pour laisser Storyline finir ses propres repositionnements.

## Important

- Pas de MutationObserver.
- Le script est idempotent :
  - il n’injecte le style qu’une seule fois ;
  - il réutilise `window.__storylineSliderNavRefresh` pour les slides suivantes.
- Le script attend des ids natifs Storyline tels que :
  - `prev`, `next`, `bottom-bar`, `playback-controls`, `misc-controls`, `nav-controls`, `seek`, `reset`.

## Utilisation

- Option recommandée : coller le script dans un déclencheur **Execute JavaScript** placé au début de la première diapositive, afin d'initialiser la navigation personnalisée dès l'ouverture du module.

