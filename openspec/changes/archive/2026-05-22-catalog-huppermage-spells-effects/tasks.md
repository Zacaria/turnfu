## 1. Domain Types

- [x] 1.1 Create resource, element, spell cost, spell effect, spell constraint, spell metadata, and spell catalog types.
- [x] 1.2 Model costs separately from effects so pre-cast validation can use costs directly.
- [x] 1.3 Add explicit effect variants for damage, resource delta, conditional effects, tags, and unsupported mechanics.
- [x] 1.4 Add entry types for active spells, passives, and Huppermage class mechanics.
- [x] 1.5 Add level-200 baseline metadata, observed level, source references, screenshot references, extraction notes, and verification status.

## 2. Effect DSL

- [x] 2.1 Define DSL primitives for spell, passive, class mechanic, cost, damage, resource delta, condition, max casts, tags, unsupported mechanics, and screenshot source.
- [x] 2.2 Implement normalization from DSL-authored entries into the strict catalog data model.
- [x] 2.3 Reject arbitrary executable logic and unknown DSL primitives.
- [x] 2.4 Add examples documenting how to encode a level-200 Huppermage spell, passive, and class mechanic.

## 3. Huppermage Catalog

- [x] 3.1 Create the initial Huppermage catalog module or data file using the DSL.
- [x] 3.2 Add stable ids, display names, class name, level 200 baseline, element, costs, effects, constraints, and metadata for each entered active spell.
- [x] 3.3 Add placeholders or structured entries for passives and class mechanics discovered from screenshots.
- [x] 3.4 Mark entries as demo, unverified, extracted, or verified according to available source confidence.
- [x] 3.5 Capture unmodeled range, placement, area, line-of-sight, target, or state mechanics as unsupported notes.

## 4. Screenshot Extraction Workflow

- [x] 4.1 Define where screenshot references are stored in metadata and how extracted values are reviewed.
- [x] 4.2 Add a manual extraction checklist for screenshots covering spell name, level, costs, base damage, conditions, resource effects, passives, and unsupported mechanics.
- [x] 4.3 Ensure screenshot-derived entries cannot be marked verified without source reference and review metadata.

## 5. Catalog Validation

- [x] 5.1 Implement validation for duplicate ids, missing names, invalid resources, negative costs, unknown effect types, unknown DSL primitives, and invalid level metadata.
- [x] 5.2 Implement validation output that identifies the affected entry, field, and source reference when available.
- [x] 5.3 Ensure the catalog can be validated before simulator use.

## 6. Tests

- [x] 6.1 Add tests for valid DSL-authored Huppermage catalog entries.
- [x] 6.2 Add tests for duplicate entry ids.
- [x] 6.3 Add tests for negative costs and invalid resource references.
- [x] 6.4 Add tests proving unsupported mechanics are recorded explicitly instead of ignored.
- [x] 6.5 Add tests for conditional effects and passive/class-mechanic entries.
- [x] 6.6 Add tests rejecting arbitrary executable DSL logic.
- [x] 6.7 Add tests for screenshot provenance and level-200 baseline metadata.

## 7. Verification

- [x] 7.1 Run the project test suite for the catalog implementation.
- [x] 7.2 Run OpenSpec strict validation for `catalog-huppermage-spells-effects`.
