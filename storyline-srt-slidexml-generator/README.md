# Storyline SRT slide.xml generator

## Description

Ce script Python (interface Tkinter) génère automatiquement des boîtes de texte dans la timeline d'une slide Storyline à partir d'un fichier `.srt`.  
Il se base sur un `textBox` modèle déjà présent dans le `slide.xml` pour conserver le style, la structure et les comportements existants.

## Contexte et approche

Ce travail s'inscrit dans une piste plus large d'automatisation Storyline :

- un fichier `.story` peut être renommé en `.zip` ;
- son contenu peut être exploré/modifié (XML, JSON) ;
- l'archive peut être rezippée puis renommée en `.story` ;
- le projet modifié peut ensuite être réouvert dans Storyline.

Cette logique ouvre la porte à des workflows de génération semi-automatique basés sur des templates `.story`.

Un autre axe exploré en parallèle: conversion de contenus issus d'Adobe Illustrator (`.ai`) vers JSON, puis mapping vers le XML Storyline. C'est prometteur, mais encore en développement.

## Objectifs principaux :

- transformer des timecodes `.srt` en objets texte synchronisés sur une slide ;
- réutiliser le style d'un bloc texte modèle existant ;
- cloner automatiquement les blocs pour éviter le montage manuel ;
- ajuster les timings de slide pour couvrir l'ensemble des sous-titres.

## Fonctionnement

1. Sélectionner un `slide.xml` source (extrait d'un `.story` dézippé).
2. Sélectionner un fichier `.srt`.
3. Définir le fichier XML de sortie.
4. Le script repère un `textBox` modèle (par défaut via le texte repère `texte_1`).
5. Pour chaque segment `.srt`, il clone ce bloc, régénère les GUID, remplace le texte et applique le timing (`start` / `dur`).
6. Si l'alt-text du modèle contient une série numérique (ex: `anim-par-1`), le script incrémente automatiquement les nouveaux alt-text (`anim-par-2`, `anim-par-3`, etc.) et met à jour les sélecteurs JS liés.
7. Il ajuste la durée minimale de la slide selon la fin du dernier segment.

## Important

- Ce script travaille sur `test/story/slides/slide.xml` (ou équivalent) extrait d'un `.story`.
- Toujours garder une copie de sauvegarde du projet original avant modification.
- Le bloc modèle doit exister dans `shapeLst` et être identifiable via le texte repère.
- Selon la version de Storyline, certaines structures XML peuvent varier et nécessiter des ajustements.

## Utilisation

- Lancer le script Python : `script.py`.
- Dans l'interface :
  - choisir `slide.xml` ;
  - choisir `.srt` ;
  - choisir le chemin de sortie ;
  - ajuster le texte repère du bloc modèle si nécessaire ;
  - cliquer sur **Générer le slide.xml**.
- Réinjecter ensuite le XML généré dans le dossier du projet dézippé, rezipper, puis renommer en `.story`.
