## 1. Result Contract

- [x] 1.1 Define a Continuous verified-candidate payload that contains the candidate plan, simulator/oracle result, score breakdown, resolved-element damage, final resources, sustainability metadata, setup/set identifiers, and run metadata.
- [x] 1.2 Add mappers from Continuous verified-candidate payloads into the existing optimizer result view-model inputs.
- [x] 1.3 Add tests proving metrics-only Continuous progress cannot become an inspectable optimizer candidate.
- [x] 1.4 Add tests proving oracle-verified Continuous candidates can render through the same optimizer result model as existing candidates.

## 2. Continuous Run Integration

- [x] 2.1 Extend the Continuous stream/API path to emit progress events and verified candidate events separately.
- [x] 2.2 Persist enough verified candidate data in SQLite, or hydrate it from SQLite, so UI reloads can recover inspectable Continuous results.
- [x] 2.3 Map setup-scoped optimizer controls to Continuous launch arguments, including duration, scoring criterion, target element, sustainable-cycle requirement, worker count, chunk size, setup/set context, and learned policy defaults.
- [x] 2.4 Keep the validated learned policy as the default Continuous method behavior while allowing manual policy overrides only through diagnostics or advanced configuration.

## 3. Optimizer Workspace UI

- [x] 3.1 Add Continuous to the existing optimizer method selector.
- [x] 3.2 Start, stop, and display Continuous run lifecycle state from the optimizer workspace.
- [x] 3.3 Display Continuous attempts, valid rate, throughput, best verified score, and running/stopped state without replacing the standard result groups.
- [x] 3.4 Insert verified Continuous candidates into exact-duration result groups with standard spell icon rows, summary metrics, and details.
- [x] 3.5 Support pinning, saving, and timeline-builder handoff for Continuous candidates using the originating setup context.
- [x] 3.6 Remove or rename primary "preset" language so normal users choose Method: Continuous rather than low-level policy bundles.
- [x] 3.7 Demote the standalone Continuous page to diagnostics, or clearly separate it from the normal optimizer run workflow.

## 4. Verification

- [x] 4.1 Run affected TypeScript tests for optimizer workspace, Continuous workspace, stream argument mapping, and candidate result hydration.
- [x] 4.2 Run `pnpm build`.
- [x] 4.3 Validate the OpenSpec change with `openspec validate integrate-continuous-as-optimizer-method --strict --no-interactive`.
- [x] 4.4 Browser-test the Optimizer page by configuring a two-turn Air damage sustainable Continuous run and confirming verified candidates, when published, use the standard optimizer summary/detail workflow.
