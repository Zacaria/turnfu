## 1. Epic Alignment

- [ ] 1.1 Review the MVP scope against the roadmap spec and confirm excluded mechanics remain out of the first implementation.
- [ ] 1.2 Confirm the initial implementation order starts with `catalog-huppermage-spells-effects` before `add-turn-simulation-engine`.
- [ ] 1.3 Decide whether the first GUI target is Vite web-only or Tauri-backed desktop.

## 2. Architecture Baseline

- [ ] 2.1 Define the initial module boundaries for domain, catalog, simulation, optimization, and GUI.
- [ ] 2.2 Document the core rule that simulation and optimization must be testable without GUI rendering.
- [ ] 2.3 Confirm the data-driven spell/effect model before implementation starts.

## 3. Roadmap Follow-Up Changes

- [ ] 3.1 Prepare a future change for exhaustive one-turn optimization after the simulation engine exists.
- [ ] 3.2 Prepare a future change for the MVP GUI after the optimizer contract exists.
- [ ] 3.3 Prepare later changes for real Wakfu constraints, sublimations, multi-turn simulation, multi-objective scoring, and advanced visualizations.

## 4. Verification

- [ ] 4.1 Validate this epic change with OpenSpec strict validation.
- [ ] 4.2 Keep this epic open as a planning umbrella until the MVP foundation changes are implemented.
