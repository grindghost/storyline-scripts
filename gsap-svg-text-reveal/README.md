# GSAP SVG text reveal

## Description

Ce script anime des textes SVG dans Storyline avec GSAP (entrée verticale, opacité et légère rotation). Il peut être utilisé en combinaison avec `gsap-splittype-loader`, qui charge les librairies externes nécessaires.

## Objectifs principaux :

- déclencher des animations de texte SVG plus dynamiques qu'une animation native ;
- séquencer plusieurs objets texte avec un délai configurable ;
- synchroniser le statut d'animation avec une variable Storyline (`isAnimating`) ;
- simplifier le ciblage via un alt-text dédié.

## Fonctionnement

1. Le script vérifie la variable Storyline `isAnimating` pour éviter les relances simultanées.
2. Il cible les objets portant l'alt-text `anim-par-4` (via `data-acc-text`).
3. Pour chaque objet ciblé, il ajoute la classe `.line` sur les `tspan` du texte SVG.
4. Il crée une timeline GSAP par objet, avec un délai basé sur son index.
5. Il anime les lignes (`tspan`) puis les blocs `text` SVG.
6. Il passe `isAnimating` à `true` au départ et à `false` à la fin de la séquence.

## Important

- Le script suppose que GSAP est déjà chargé (d'où l'usage recommandé avec `gsap-splittype-loader`).
- Le ciblage dépend de l'alt-text `anim-par-4` ; adapte cette valeur selon ton cas.
- Il est recommandé de déclencher ce script au début de la timeline de l'objet texte ciblé.
- Comme Storyline évolue au fil des versions, certains sélecteurs DOM peuvent nécessiter un ajustement.

## Utilisation

- Ajouter l'alt-text `anim-par-4` sur l'objet texte à animer.
- Déclencher ce script dans un trigger **Execute JavaScript**:
  - idéalement au début de la timeline de l'objet (ou layer) concerné.
- Vérifier que `gsap-splittype-loader` est exécuté avant ce script.
- Fichier principal : `script.js`.
