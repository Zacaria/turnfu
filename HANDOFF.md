# Handoff - Sublimations

## Etat courant

- Worktree cible: `/Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/add-sublimations`
- Branche: `codex/add-sublimations`
- Commit principal: `0895a63 feat(sublimations): model build sublimations`
- Base de depart: branche Rust `codex/port-hybrid-engine-to-rust-wasm` autour de `99a49f7 feat(optimizer): port rust gameplay primitives`
- Le worktree de port Rust a ete nettoye des changements de sublimations. Il ne contient que son commit d'infra `.worktrees/` ignore.

## Objectif fonctionnel

Integrer les sublimations comme partie du build Wakfu, au meme niveau que les passifs:

- elles ne changent pas pendant un combo;
- on peut avoir 10 sublimations normales, 1 epique et 1 relique;
- les prerequis de runes/equipement sont ignores;
- le cumul max d'une famille est applique, meme si plusieurs exemplaires depassent ce cap;
- les sublimations non supportees restent visibles mais bloquees;
- les sublimations exploitables influencent la simulation et l'optimizer;
- les resultats affichent les sublimations selectionnees avec un rendu proche de Wakfuli.

Le travail inclut aussi la gestion du degat critique attendu, necessaire avant les sublimations qui modifient les critiques.

## OpenSpec

Trois changes OpenSpec ont ete crees, implementes et valides:

1. `add-expected-critical-damage`
   - Ajoute `criticalMode` avec les modes `expected`, `forcedCritical`, `forcedNonCritical`.
   - Le mode par defaut UI est `expected`.
   - La formule de degat expose le taux critique effectif et le mode utilise.

2. `add-sublimation-catalog-and-build-slots`
   - Ajoute le catalogue de sublimations et les types de build.
   - Ajoute validation des slots: 10 normales, 1 epique, 1 relique.
   - Ajoute validation des cumuls et conflits de PV.
   - Ajoute les selections de sublimations aux snapshots de setup.

3. `add-supported-sublimation-effects`
   - Applique les effets supportes dans le simulateur.
   - Supporte les stats flat, ressources flat, bonus conditionnels par action, et report PA/PM.
   - Bloque les sublimations event-critical et death-trigger.
   - Integre les effets aux scores optimizer et au replay de soutenabilite.

Commandes validees depuis le worktree cible:

```bash
openspec validate add-expected-critical-damage --strict --no-interactive
openspec validate add-sublimation-catalog-and-build-slots --strict --no-interactive
openspec validate add-supported-sublimation-effects --strict --no-interactive
```

Les trois commandes passent.

## Fichiers principaux

### Core sublimations

- `src/core/sublimations/types.ts`
  - Types de categorie, statut support, requirements PV, conditions d'action, effets, selection de build, stacks effectifs.

- `src/core/sublimations/catalog.ts`
  - Premier catalogue manuel.
  - Contient notamment:
    - `appret-3`
    - `critique-maitrise-1`
    - `distance-1`
    - `diagonale-1`
    - `zone-1`
    - `report-pa`
    - `vitalite-90`
    - `berserk-20`
    - `premier-critique` bloque
    - `retour-pa` ignore

- `src/core/sublimations/validation.ts`
  - Valide les slots.
  - Agrege les stacks par famille.
  - Applique le cap de cumul.
  - Detecte les conflits de conditions PV incompatibles.
  - Rejette les sublis `planned` ou `ignored`.

### Simulation

- `src/core/simulation/damage.ts`
  - Ajoute le calcul expected crit:
    - `expected = nonCrit * (1 - critChance) + crit * critChance`
  - Preserve les modes forces pour tests ou actions explicites.

- `src/core/simulation/simulator.ts`
  - Valide les sublimations avant simulation.
  - Applique les stats/ressources initiales.
  - Applique les effets conditionnels d'action selon le profil du sort.
  - Enregistre les effets appliques/skippes.
  - Calcule les reports PA/PM de fin de tour.

- `src/core/simulation/comboSimulator.ts`
  - Transporte le carryover de ressources entre tours.

### Optimizer

- `src/core/optimizer/comboOptimizer.ts`
  - Clone les selections de sublimations dans les candidats.
  - Les scores candidats utilisent les effets de simulation.
  - Le replay de soutenabilite tient compte des reports.

### Catalog DSL

- `src/core/catalog/types.ts`
- `src/core/catalog/dsl.ts`
  - Ajoute `castProfile` sur les sorts.
  - Infere des profils utiles depuis les metadata de portee/zone quand possible.
  - Sert aux conditions melee/distance/zone/ligne/diagonale.

### Workspace / UI

- `src/ui/researchWorkspace.ts`
  - Ajoute `SetupSnapshot.sublimations` et `hpAssumption`.
  - Ajoute `createSetupSnapshotWithSublimations`.
  - Les changements de sublis creent un nouveau snapshot versionne pour eviter d'afficher des sublis sur un vieux run.

- `src/ui/ResearchWorkspacePages.tsx`
  - Page detail setup:
    - bloc `Sorts`;
    - bloc `Passifs` avec hauteur limitee;
    - bloc `Sublimations` sous les passifs.
  - Setup:
    - catalogue visible;
    - boutons `+` / `-`;
    - sublis bloquees visibles avec raison.
  - Optimizer:
    - chaque candidat affiche les sublimations du setup sous les passifs.

- `src/ui/sublimationPreview.ts`
  - Formatte les items d'aperçu Wakfuli-like.
  - Utilise les stacks effectifs apres cap.

- `src/ui/styles.css`
  - Styles de catalogue, chips, tooltip Wakfuli-like, blocs de detail.

- `index.html`, `src/ui/main.tsx`, `src/ui/App.tsx`
  - Query params d'import mis a jour pour contourner le cache immutable Vite pendant le dev local.

## Verification deja faite

Depuis `.worktrees/add-sublimations`:

```bash
npm install --cache /private/tmp/wakfu-npm-cache
npm test
npm run build
openspec validate add-expected-critical-damage --strict --no-interactive
openspec validate add-sublimation-catalog-and-build-slots --strict --no-interactive
openspec validate add-supported-sublimation-effects --strict --no-interactive
```

Resultats:

- `npm test`: 207 tests, 207 pass.
- `npm run build`: OK.
- Les 3 validations OpenSpec: OK.

Note: `npm install` sans cache dedie peut echouer sur cette machine a cause de fichiers root-owned dans `~/.npm`. Utiliser:

```bash
npm install --cache /private/tmp/wakfu-npm-cache
```

## Verification navigateur faite

Le serveur Vite local a ete utilise sur:

```text
http://127.0.0.1:5173/
```

Flux verifie:

1. Ouvrir le build Huppermage.
2. Ouvrir un setup.
3. Ajouter `Apprêt III` via le bouton `+`.
4. Le setup passe en version suivante.
5. Ouvrir l'optimizer.
6. Lancer une optimisation 1T.
7. Les candidats affichent une section `Sublimations` sous les passifs.
8. Le detail du set affiche les blocs `Sorts`, `Passifs`, puis `Sublimations`.

Evidence observee dans le DOM:

```text
SublimationsApprêt IIIApprêt III+3 % Dommages infligés
```

## Decisions importantes

- Les sublimations sont une partie du build, pas du combo.
- Modifier les sublimations cree un nouveau `SetupSnapshot` au lieu de muter l'ancien.
- Les resultats optimizer affichent les sublimations du setup du run.
- Les anciens resultats ne doivent pas etre melanges avec de nouvelles selections de sublis.
- Les sublis supportees peuvent etre selectionnees; les autres restent visibles mais bloquees.
- Les sublis basees sur "premier CC du tour" restent bloquees tant qu'il n'y a pas de modele evenementiel des critiques.
- Les sublis declenchees par mort d'ennemi restent ignorees.
- Les conditions melee/distance/zone/ligne/diagonale sont considerees satisfaites quand le sort permet ce mode. Il n'y a pas encore de placement tactique ou recherche de case.
- Les sublis PV utilisent des assumptions; les conditions PV incompatibles sont bloquees ensemble.

## Limites connues

- Le catalogue est volontairement minimal, pas l'inventaire complet Wakfuli.
- Les sources `wakfu.guide` et Wakfuli sont notees comme releves manuels du 2026-05-31.
- Les icones de sublimations utilisent un pictogramme parchemin Lucide, pas encore les vrais assets Wakfuli.
- Il n'y a pas encore d'import Wakfuli complet.
- Les sublis "premier critique", event-critical et les effets qui changent fortement le gameplay ne sont pas modeles.
- Les sublis qui dependent de la mort d'un mob restent ignorees.
- Les HP assumptions ne sont pas encore pilotables finement depuis l'UI, au-dela de la representation/validation actuelle.
- Les query params Vite (`?v=sublimation-detail-v1`) sont un workaround dev-cache; a revisiter si une strategie de cache locale plus propre apparait.

## Points d'attention pour la suite

1. Completer le catalogue de sublimations.
   - Probable prochaine etape: importer/encoder plus d'entrees depuis Wakfuli.
   - Garder le statut `supported` / `planned` / `ignored` explicite.

2. Remplacer les icones generiques.
   - Recuperer ou generer des assets de sublis.
   - Brancher le rendu sur un mapping `sublimationId -> icon`.

3. Ajouter un controle UI pour `hpAssumption`.
   - Aujourd'hui la structure existe.
   - Le flux UI doit permettre de choisir normal / 90%+ / berserk.

4. Elargir les effets supportes.
   - Ajouter des types d'effets structurels uniquement quand la simulation peut les representer proprement.
   - Eviter de parser du texte de description en runtime.

5. Integrer avec le port Rust.
   - Cette branche part d'un commit Rust recent mais les effets sublis sont uniquement en TypeScript.
   - Quand le backend Rust/WASM sera la source d'optimizer, il faudra porter au moins:
     - expected crit;
     - selections de sublimations dans la requete;
     - validation/capping ou resultat deja normalise cote TS;
     - effets flat/action/carryover dans le moteur Rust.

6. Revoir la separation OpenSpec.
   - Les trois changes sont complets mais pas archives.
   - Quand la feature est acceptee, archiver avec le workflow OpenSpec habituel.

## Commandes utiles

Aller dans le worktree:

```bash
cd /Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/add-sublimations
```

Installer les deps:

```bash
npm install --cache /private/tmp/wakfu-npm-cache
```

Tester:

```bash
npm test
npm run build
```

Valider OpenSpec:

```bash
openspec validate add-expected-critical-damage --strict --no-interactive
openspec validate add-sublimation-catalog-and-build-slots --strict --no-interactive
openspec validate add-supported-sublimation-effects --strict --no-interactive
```

Lancer le dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Si le port `5173` sert une ancienne version, verifier les imports `?v=...` dans:

- `index.html`
- `src/ui/main.tsx`
- `src/ui/App.tsx`

## Etat git attendu

Avant ce handoff, le worktree cible etait clean apres le commit `0895a63`.
Ce fichier `HANDOFF.md` documente l'etat de reprise et doit etre conserve sur la branche `codex/add-sublimations`.
