## 1. Epic Alignment

- [x] 1.1 Review the MVP scope against the roadmap spec and confirm excluded mechanics remain out of the first implementation.
- [x] 1.2 Confirm the initial implementation order starts with `catalog-huppermage-spells-effects` before `add-turn-simulation-engine`.
- [x] 1.3 Decide whether the first GUI target is Vite web-only or Tauri-backed desktop.

## 2. Architecture Baseline

- [x] 2.1 Define the initial module boundaries for domain, catalog, simulation, optimization, and GUI.
- [x] 2.2 Document the core rule that simulation and optimization must be testable without GUI rendering.
- [x] 2.3 Confirm the data-driven spell/effect model before implementation starts.

## 3. Roadmap Follow-Up Changes

- [ ] 3.1 Prepare a future change for combo search and optimization after exploring scoring criteria.
- [x] 3.2 Prepare and complete the MVP GUI change.
- [ ] 3.3 Prepare later changes for real Wakfu constraints, sublimations, multi-objective scoring, and advanced visualizations.

## 4. Verification

- [x] 4.1 Validate this epic change with OpenSpec strict validation.
- [ ] 4.2 Decide whether to archive this epic after the combo optimizer direction is captured.
