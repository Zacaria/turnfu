## 1. Domain Model

- [x] 1.1 Add sublimation catalog entry types for identity, category, level, cumulative maximum, support status, and source metadata.
- [x] 1.2 Add build selection types that store selected normal, epic, and relic sublimations alongside stats and passives.
- [x] 1.3 Add HP assumption types for high-HP, normal, and berserk-compatible build conditions.

## 2. Catalog and Validation

- [x] 2.1 Create an initial curated sublimation catalog structure with supported, planned, and ignored status values.
- [x] 2.2 Implement slot validation for 10 normal, 1 epic, and 1 relic sublimation.
- [x] 2.3 Implement duplicate-family aggregation and cumulative maximum capping.
- [x] 2.4 Implement support-status, ignored-status, and HP-condition conflict validation.
- [x] 2.5 Ensure rune and equipment prerequisites are stored if useful but ignored by build validation.

## 3. UI and Persistence

- [x] 3.1 Add setup defaults and persistence fields for sublimation selections and HP assumption.
- [x] 3.2 Add UI controls that show all cataloged sublimations and disable unsupported or ignored entries with reasons.
- [x] 3.3 Show effective duplicate levels after cumulative maximum capping.
- [x] 3.4 Surface build validation errors near the sublimation selection controls.

## 4. Verification

- [x] 4.1 Add tests for slot limits, support-state blocking, ignored-state blocking, and cumulative maximum capping.
- [x] 4.2 Add tests for HP-condition compatibility and conflict detection.
- [x] 4.3 Add UI/state tests for disabled entries and persisted sublimation selections.
- [x] 4.4 Run the affected test suite and OpenSpec validation for this change.
