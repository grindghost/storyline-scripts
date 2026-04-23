# GSAP + SplitType loader

## Description

Ce script charge des librairies JavaScript externes dans le `head` de la production Storyline, afin d'étendre les possibilités d'animation. Il charge actuellement `SplitType` et `GSAP`.

## Objectifs principaux :

- centraliser le chargement de librairies externes nécessaires aux animations ;
- préparer la slide pour des animations de texte plus avancées ;
- masquer les éléments cibles avant le début des animations pour éviter les flashs visuels.

## Fonctionnement

1. Le script récupère la balise `head` du document.
2. Il crée et injecte une balise `script` pour charger `SplitType`.
3. Il crée et injecte une balise `script` pour charger `GSAP`.
4. Il sélectionne tous les éléments qui ont l'alt-text Storyline `anim-par` (via `data-acc-text='anim-par'`).
5. Il applique `opacity = 0` à ces éléments pour les masquer au chargement.

## Important

- Ce script doit être exécuté assez tôt dans le cycle de la scène pour que les librairies soient disponibles au moment des animations.
- Les éléments à animer doivent avoir l'alt-text `anim-par`, sinon ils ne seront pas masqués automatiquement.
- Comme Storyline évolue au fil des versions, un ajustement peut être nécessaire selon le player exporté.

## Utilisation

- Option recommandée : coller ce script dans un déclencheur **Execute JavaScript** placé au début de la première diapositive.
- Ensuite, ajouter l'alt-text `anim-par` aux elements que tu veux animer avec `GSAP`.
- Fichier principal : `script.js`.
