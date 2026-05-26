## Why

Le catalogue Huppermage et le moteur de simulation existent maintenant, mais ils ne sont utilisables qu'en code. Il faut une premiere GUI pour construire manuellement une timeline de tour, inspecter l'evolution des ressources/etats/statistiques, et comprendre les degats action par action avant d'ajouter un optimiseur.

## What Changes

- Ajouter une application GUI web locale pour le MVP Huppermage.
- Permettre de construire une timeline d'un tour avec une suite ordonnee d'actions.
- Permettre d'ajouter, retirer, reordonner et configurer les actions de la timeline.
- Brancher la timeline sur le catalogue de sorts Huppermage et le moteur `simulateTurn`.
- Ajouter un curseur d'inspection pour voir l'etat initial, l'etat apres chaque action, et l'etat final.
- Afficher l'evolution des ressources, runes, Coeur actif, Feu-Follets, passifs actifs, statistiques courantes et bonus appliques.
- Afficher les degats totaux du tour, les degats par action, et le detail de formule de chaque effet de degat.
- Afficher clairement les violations de simulation si la sequence devient invalide.
- Garder la GUI comme couche de presentation: aucune regle Wakfu ne doit etre recodee dans les composants.

## Capabilities

### New Capabilities

- `turn-timeline-gui`: Covers the GUI for manually building a one-turn action timeline, simulating it, inspecting state progression with a cursor, and visualizing calculated damage.

### Modified Capabilities

- `turn-simulation-engine`: Expose per-action stat snapshots and bonus/effect details needed by the timeline cursor without moving simulation logic into the GUI.

## Impact

- New frontend application files, expected under `src/ui` or equivalent Vite entrypoints.
- Package scripts and dependencies for a local React/TypeScript GUI.
- Integration points with `src/core/catalog` and `src/core/simulation`.
- Focused UI tests or component-level tests for timeline editing and simulation display.
- Small additive changes to simulation result shape for GUI inspection snapshots; no rule changes unless a GUI integration gap reveals a missing core API.
