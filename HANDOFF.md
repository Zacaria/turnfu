# Handoff - reprise sublimations

Derniere mise a jour: 2026-06-01.

## Contexte

- Worktree: `/Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/add-sublimations`
- Branche: `codex/add-sublimations`
- Package manager impose par `AGENTS.md`: `pnpm`
- Commandes manuelles a prefixer avec `rtk`
- Etat git au moment du handoff: nombreux fichiers modifies et non commit, plus `public/assets/sublimations/` et `src/ui/sublimationIcons.ts` non suivis.

Ne pas revenir a `npm`. Les verifications recentes ont ete lancees avec:

```bash
rtk pnpm test
rtk pnpm build
```

Resultats:

- `rtk pnpm test`: OK, 227 tests passes.
- `rtk pnpm build`: OK. Warning Vite attendu sur un chunk JS > 500 kB.

## Objectif de la branche

Ajouter les sublimations comme composante du build Wakfu, au meme niveau que les passifs:

- selection dans les setups/build snapshots;
- validation des slots: 10 normales, 1 epique, 1 relique;
- aggregation des familles et caps de cumul;
- support explicite `supported` / `planned` / `ignored`;
- effets supportes appliques dans la simulation;
- prise en compte dans l'optimizer;
- affichage dans les candidats optimizer, le detail de setup et le state tracker du combo.

Les sublimations restent une propriete du build, pas du combo. Modifier les sublimations cree un nouveau `SetupSnapshot` au lieu de muter l'ancien, afin de ne pas melanger anciens runs et nouvelles selections.

## Etat fonctionnel actuel

### Simulation

Les sublimations sont deja branchees dans le simulateur:

- validation de build via `validateSublimationBuild`;
- application des stats/ressources initiales;
- conditions d'action et bonus de degats;
- effets elementaires reportes;
- alternance;
- compteurs de sorts;
- declencheurs sur ressources depensees;
- carryover PA/PM en fin de tour;
- effets appliques/skippes exposes dans `appliedEffects`.

Fichiers principaux:

- `src/core/sublimations/types.ts`
- `src/core/sublimations/catalog.ts`
- `src/core/sublimations/validation.ts`
- `src/core/simulation/types.ts`
- `src/core/simulation/simulator.ts`
- `src/core/simulation/comboSimulator.ts`

Tests importants qui passent:

- `src/core/simulation/simulator.test.ts`
  - stats flat et conditions d'action;
  - HP-threshold inactive si assumption ne matche pas;
  - degats elementaires hors lumiere;
  - Brulure secondaire / carryover elementaire;
  - Alternance;
  - Concentration elementaire;
  - Exces;
  - Puissance brute;
  - rejet des sublimations non supportees.
- `src/core/simulation/comboSimulator.test.ts`
  - carryover PA de Sauvegarde;
  - carryover elementaire multi-tour.

### Optimizer

L'optimizer experimental prend les sublimations en compte:

- `src/core/optimizer/optimizerExperiment.ts` genere des `sublimationIds`;
- `createCandidateCharacter` construit un character candidat avec ces sublimations;
- l'evaluation appelle `simulateCombo` avec ce character;
- le score est calcule depuis la simulation;
- les resultats conservent `sublimationIds` et `sublimations`.

La page optimizer fournit les sublimations supportees via:

- `src/ui/optimizerWorkspace.ts`
  - `availableSublimationIds`;
  - `maxSublimationCount: 12`;
  - mapping des resultats vers `OptimizerCandidateViewModel`.

Tests importants qui passent:

- `src/core/optimizer/optimizerExperiment.test.ts`
  - `ranks sublimation chromosomes by simulated score`;
  - `hybrid search explores sublimation neighbors before spending the short-run budget`.
- `src/ui/optimizerWorkspace.test.ts`
  - mapping options optimizer;
  - handoff candidat vers builder avec sublimations.

Point d'attention: dans `createOptimizerExperimentEvaluator`, le scoring utilise bien le character candidat avec sublimations. En revanche, le chemin `requireSustainableCycle` appelle encore `evaluateSustainableCycle` avec le character de base dans la version inspectee. Si l'option cycle soutenable est activee, verifier/corriger pour passer le character candidat, puis ajouter un test qui echoue sans cette correction.

### UI / resume de combo

Ce qui est deja affiche:

- Detail de setup: bloc `Sublimations`, assumptions PV/allies/contact, violations et stacks effectifs.
- Builder/catalogue: choix des sublimations avec boutons `+` / `-`, limites, raisons de blocage, icones Wakfuli quand mappees.
- Optimizer: chaque candidat affiche une section `Sublimations` sous les passifs.
- Builder state tracker: affiche les sublimations actives et leur etat selon les `appliedEffects` du snapshot courant.
- Inspector d'action: les effets de sublimation apparaissent dans les effets appliques via `describeEffect`.

Fichiers principaux:

- `src/ui/App.tsx`
- `src/ui/ResearchWorkspacePages.tsx`
- `src/ui/optimizerWorkspace.ts`
- `src/ui/researchWorkspace.ts`
- `src/ui/sublimationPreview.ts`
- `src/ui/sublimationIcons.ts`
- `src/ui/styles.css`
- `public/assets/sublimations/`

Nuance importante: les candidats optimizer affichent bien leurs sublimations, mais la liste courte `Combos sauvegardes` de la page build affiche encore seulement le nom et les degats. Les sublimations sont persistees/restaurees dans les `SavedComboReference`, mais pas visibles dans cette ligne courte. Si la demande "resume du combo" vise aussi cette liste, il reste a ajouter un apercu des sublis sauvegardees.

Tests UI importants qui passent:

- `src/ui/sublimationPreview.test.ts`
  - preview Wakfuli-like;
  - formats d'effets;
  - state tracker actif/en attente.
- `src/ui/researchWorkspace.test.ts`
  - snapshots versionnes quand les sublimations changent;
  - sauvegarde des combos avec sublimations.
- `src/ui/optimizerWorkspace.test.ts`
  - handoff candidat vers builder avec sublimations.

## OpenSpec

Le handoff precedent mentionnait trois changes:

- `add-expected-critical-damage`
- `add-sublimation-catalog-and-build-slots`
- `add-supported-sublimation-effects`

Ils etaient valides precedemment. Revalider si le prochain fil touche aux specs:

```bash
rtk openspec validate add-expected-critical-damage --strict --no-interactive
rtk openspec validate add-sublimation-catalog-and-build-slots --strict --no-interactive
rtk openspec validate add-supported-sublimation-effects --strict --no-interactive
```

## Points ouverts prioritaires

1. Corriger le filtre `requireSustainableCycle` dans `src/core/optimizer/optimizerExperiment.ts` pour utiliser le character candidat avec passifs/sublimations, pas le character de base.

2. Ajouter un test dedie dans `src/core/optimizer/optimizerExperiment.test.ts`:
   - selectionner une sublimation qui modifie la soutenabilite ou le score du replay;
   - activer `requireSustainableCycle`;
   - verifier que le filtre utilise bien le build candidat.

3. Decider si le "resume du combo" inclut la liste courte des combos sauvegardes. Si oui, afficher les sublimations de `combo.sublimations` dans `ResearchWorkspacePages.tsx` pour les `savedCombos`.

4. Refaire une verification navigateur apres les corrections:
   - selectionner une sublimation dans un setup;
   - lancer l'optimizer;
   - verifier les candidats avec sublis;
   - ouvrir un candidat dans le builder;
   - verifier state tracker, detail d'action et sauvegarde de combo.

5. Eventuellement revalider OpenSpec et archiver les changes une fois la feature acceptee.

## Commandes utiles

Depuis le worktree:

```bash
cd /Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/add-sublimations
rtk pnpm install
rtk pnpm test
rtk pnpm build
rtk pnpm dev -- --host 127.0.0.1
```

Inspecter l'etat:

```bash
rtk git status --short --branch
rtk rg -n "sublimation|sublimations|Sublimations" src
```

## Prompt de reprise conseille

```text
Tu reprends le travail dans le repo `/Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/add-sublimations`, branche `codex/add-sublimations`.

Lis d'abord `AGENTS.md` et `HANDOFF.md`. Respecte les consignes: utiliser `pnpm`, prefixer les commandes shell manuelles avec `rtk`, ne pas ecraser les changements non commites.

Contexte: l'implementation des sublimations est largement branchee. `rtk pnpm test` passait avec 227 tests et `rtk pnpm build` passait. Les sublimations sont appliquees dans la simulation, explorees par l'optimizer experimental, affichees dans les candidats optimizer et dans le state tracker. Les assets Wakfuli sont presents dans `public/assets/sublimations/` et mappees via `src/ui/sublimationIcons.ts`.

Travail a reprendre en priorite:
1. Verifier/corriger `requireSustainableCycle` dans `src/core/optimizer/optimizerExperiment.ts`: `evaluateSustainableCycle` doit utiliser le character candidat avec passifs/sublimations, pas le character de base.
2. Ajouter un test de regression dans `src/core/optimizer/optimizerExperiment.test.ts`.
3. Verifier si le "resume du combo" doit aussi couvrir la liste courte des combos sauvegardes; si oui, afficher les sublimations de `combo.sublimations` dans `src/ui/ResearchWorkspacePages.tsx`.
4. Relancer `rtk pnpm test` et `rtk pnpm build`.

Commence par inspecter `git status`, puis les fichiers cites. Donne un bref plan, implemente les corrections, et termine par les verifications executees.
```
