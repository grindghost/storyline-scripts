# Layer blur effect

## Description

Ce script applique un effet de flou sur les calques situés sous le calque de contenu principal, afin de créer un rendu visuel plus moderne dans Storyline.

## Objectifs principaux :

- améliorer la hiérarchie visuelle entre le premier plan et l'arrière-plan ;
- mettre l'accent sur le calque actif sans masquer complètement les autres ;
- conserver un effet fluide grâce à une transition CSS ;
- permettre une exécution simple via un trigger Storyline.

## Fonctionnement

1. Le script injecte (une seule fois) une classe CSS `.blurred-layer` dans le `head`.
2. Il détecte les calques Storyline visibles (`.slide-layer`).
3. Il identifie un calque global supérieur (UI persistante) via un `data-model-id` connu et l'exclut du tri.
4. Il retire d'abord tout flou déjà appliqué pour éviter l'accumulation.
5. Il trie les calques de contenu visibles selon leur `z-index` (du plus haut au plus bas).
6. Il applique le flou au deuxième calque de contenu visible (celui juste sous le calque principal).

## Important

- Le script dépend de la structure DOM Storyline (`.slide-layer`) et d'un `data-model-id` spécifique pour le calque global supérieur.
- Si ce `data-model-id` change dans ton projet, l'exclusion du calque supérieur devra être adaptée.
- Le script doit être relancé à chaque ouverture de couche/slide où tu veux recalculer l'effet.
- Comme Storyline évolue au fil des versions, un ajustement peut être nécessaire.

## Utilisation

- Option recommandée : coller ce script dans un déclencheur **Execute JavaScript**.
- Déclenchement typique :
  - au clic sur un bouton qui ouvre un layer ;
  - ou au démarrage de la timeline d'un layer/slide.
- Fichier principal : `script.js`.
