## Context

Le projet part d'un depot presque vide et vise une application GUI de theorycraft Wakfu. Le besoin final est large: modelisation de tour, visualisation des actions, comparaison de sequences, optimisation automatique, sublimations, multi-tours et objectifs multiples.

Le risque principal est de demarrer par une modelisation trop exhaustive du jeu. Le design global impose donc une progression par paliers, avec un MVP reduit et testable: Huppermage, un tour, pas d'equipement, pas de sublimation, donnees de sorts saisies ou maintenues manuellement, objectif unique de degats bruts.

## Goals / Non-Goals

**Goals:**

- Cadrer le produit cible et les limites du MVP.
- Definir les frontieres entre modele de domaine, catalogue de sorts, moteur de simulation, moteur d'optimisation et GUI.
- Prioriser les premiers changes: catalogue Huppermage puis moteur de simulation.
- Garder une architecture compatible avec une future recherche exhaustive, puis un algorithme genetique.
- Rendre les futures implementations testables par modules purs.

**Non-Goals:**

- Implementer l'application.
- Modeliser toutes les classes Wakfu.
- Modeliser l'equipement, les sublimations, le placement, la ligne de vue ou les resistances complexes dans le MVP.
- Choisir definitivement toutes les regles Wakfu avancees.
- Implementer l'algorithme genetique dans les deux premiers changes.

## Decisions

### Decision: MVP volontairement reduit

Le premier produit utilisable se limite a Huppermage, un tour, ressources de base et degats bruts.

Alternative consideree: commencer par un simulateur Wakfu generique. Rejetee car la surface de regles serait trop grande avant d'avoir un moteur fiable.

### Decision: moteur de simulation pur

La simulation doit etre une fonction deterministe prenant personnage, catalogue de sorts et sequence d'actions, puis retournant un resultat complet. Elle ne depend pas de la GUI.

Alternative consideree: calculer directement dans les composants UI. Rejetee car cela rendrait les tests et l'optimisation difficiles.

### Decision: sorts decrits par donnees structurees

Les sorts et effets doivent etre structures dans un catalogue. Le simulateur interprete des types d'effets connus plutot que du texte libre.

Alternative consideree: coder chaque sort comme une fonction specifique. Rejetee pour le MVP car cela compliquerait la maintenance et les futures sublimations.

### Decision: optimisation exhaustive avant genetique

La recherche exhaustive sera privilegiee tant que l'espace de sequences reste petit. L'algorithme genetique viendra lorsque les combinaisons multi-tours, sublimations ou objectifs multiples rendront l'exhaustif trop couteux.

Alternative consideree: demarrer directement par genetique. Rejetee car cela masquerait les erreurs de simulation et rendrait les resultats moins explicables.

### Decision: GUI comme couche de configuration et visualisation

L'interface sert a configurer personnage et sorts, lancer les calculs et afficher sequences, scores et detail des degats. Les regles restent dans `core`.

Alternative consideree: architecture monolithique centree UI. Rejetee pour proteger la logique de domaine.

## Risks / Trade-offs

- Donnees Wakfu manuelles incompletes -> Ajouter provenance, statut de verification et notes d'effets non modelises.
- MVP trop simplifie par rapport au jeu reel -> Documenter explicitement les exclusions et ajouter les contraintes par changes incrementaux.
- Explosion combinatoire future -> Commencer par exhaustif, mais conserver une API d'optimiseur separee du simulateur.
- Formule de degats approximative -> La garder explicite, testee et remplacable.
- Couplage implicite entre catalogue et simulateur -> Definir des types d'effets supportes et rejeter clairement les effets non supportes.

## Migration Plan

Il n'y a pas de migration applicative initiale. Les changes doivent etre appliques dans cet ordre:

1. `catalog-huppermage-spells-effects`
2. `add-turn-simulation-engine`
3. change futur pour recherche exhaustive
4. change futur pour GUI MVP
5. changes futurs pour contraintes Wakfu, sublimations, multi-tours et optimisation genetique

## Open Questions

- Quelle source officielle ou communautaire sera utilisee pour verifier les sorts Huppermage?
- La premiere GUI doit-elle rester web locale via Vite ou viser directement Tauri?
- Faut-il stocker les donnees de sorts en TypeScript, JSON, YAML ou format hybride?
- Quelle formule de degats MVP exacte doit etre retenue avant d'integrer les resistances et critiques?
