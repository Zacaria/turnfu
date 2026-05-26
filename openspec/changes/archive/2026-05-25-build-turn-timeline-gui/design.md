## Context

Le moteur `simulateTurn` retourne deja une evaluation deterministe d'une sequence d'actions Huppermage: ressources, etats de classe, degats, violations et effets appliques. La prochaine etape utile est une GUI locale qui rend ce moteur manipulable par un joueur sans introduire de logique Wakfu dans l'interface.

Le besoin vise une timeline de tour construite manuellement. L'utilisateur choisit des actions, les ordonne, configure les options utiles, puis utilise un curseur pour inspecter l'etat initial, l'etat apres chaque action, les ressources, runes, Coeur, passifs, bonus et degats.

## Goals / Non-Goals

**Goals:**

- Creer une GUI web locale pour construire une timeline d'un tour.
- Utiliser le catalogue Huppermage existant comme source de sorts.
- Appeler le moteur de simulation existant pour tous les calculs.
- Afficher les ressources, etats Huppermage, statistiques courantes et effets appliques a chaque etape.
- Afficher les degats totaux et par action, avec detail de formule.
- Rendre les actions invalides explicites sans casser l'interface.
- Garder les composants UI separes du moteur de simulation.

**Non-Goals:**

- Implementer l'optimisation automatique.
- Ajouter un plateau tactique, placement reel, ligne de vue ou ciblage spatial.
- Ajouter l'equipement, les sublimations ou plusieurs tours.
- Recalculer les regles de sort dans les composants React.
- Produire une UI marketing ou une landing page.

## Decisions

### Decision: Vite + React + TypeScript pour le MVP GUI

La GUI sera une application web locale Vite/React/TypeScript. C'est le chemin le plus court pour obtenir une interface interactive, testable, et compatible avec une future distribution Tauri si necessaire.

Alternative consideree: Tauri directement. Rejetee pour ce change car l'objectif est de valider l'ergonomie et l'integration moteur avant la distribution desktop.

### Decision: timeline derivee d'une sequence de simulation

La source de verite UI sera une liste ordonnee d'actions compatible avec `ActionSequence`. A chaque modification, l'UI reconstruit la sequence et appelle `simulateTurn`.

Alternative consideree: maintenir un etat de tour mutable dans l'UI. Rejetee car cela dupliquerait la logique de simulation et rendrait les divergences probables.

### Decision: curseur d'inspection par index d'etape

Le curseur aura `N + 1` positions pour `N` actions: position 0 = etat initial, position `i` = etat apres l'action `i`. Les panneaux d'etat affichent les snapshots correspondant a la position selectionnee.

Alternative consideree: un curseur temporel continu. Rejetee car le tour est une sequence discrete d'actions.

### Decision: ajouter des snapshots de stats dans le simulateur

Pour afficher les statistiques et bonus au curseur, le simulateur doit exposer `statsBefore` et `statsAfter` dans chaque `ActionResult`. La GUI consommera ces snapshots au lieu de recalculer les bonus.

Alternative consideree: reconstruire les stats dans la GUI depuis `appliedEffects`. Rejetee car cela deplacerait de la logique de domaine dans la presentation.

### Decision: layout d'application utilitaire

Le premier ecran sera l'outil lui-meme:

- colonne gauche: configuration personnage, passifs, Coeur actif et ressources initiales;
- zone centrale: timeline d'actions et controls d'edition;
- colonne droite: inspecteur d'etape avec ressources, runes, stats, bonus et violations;
- bande inferieure ou panneau dedie: degats totaux, degats par action, detail de formule.

L'interface doit rester dense, lisible et orientee comparaison de sequences.

Alternative consideree: page d'accueil explicative. Rejetee car l'application doit etre directement utilisable.

## Risks / Trade-offs

- Pas de plateau tactique -> Les conditions de cible et de position restent configurees ou simplifiees comme dans le moteur.
- Simulation appelee a chaque changement -> Mitigation: les sequences MVP sont courtes; memoisation simple possible si necessaire.
- Catalogue incomplet ou effets non supportes -> Mitigation: afficher les effets appliques et les violations; ne pas masquer les limites.
- UI trop ambitieuse -> Mitigation: commencer par timeline manuelle, curseur, et panneaux de lecture avant tout drag-and-drop avance.
- Dependances frontend nouvelles -> Mitigation: garder la stack minimale et les composants locaux.

## Migration Plan

1. Ajouter les dependances Vite/React/TypeScript et scripts `dev`, `build`, `test` si necessaire.
2. Ajouter `statsBefore` et `statsAfter` au resultat de simulation.
3. Ajouter une couche UI d'adaptation qui transforme un `SimulationResult` en snapshots d'etapes.
4. Ajouter la premiere application GUI avec timeline, editeurs d'action, curseur, inspecteur et panneaux degats.
5. Verifier avec tests unitaires et build frontend.

## Open Questions

- Le premier controle de reorganisation doit-il etre des boutons monter/descendre ou du drag-and-drop?
- Quels champs d'action doivent etre visibles par defaut: cible, critique, position, distance/melee, blocage?
- Faut-il exposer toutes les statistiques configurables des maintenant ou seulement celles utilisees par la formule actuelle?
