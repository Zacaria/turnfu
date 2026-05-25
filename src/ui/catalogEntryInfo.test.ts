import assert from "node:assert/strict";
import test from "node:test";

import { damage, maxCastsPerTurn, movement, range, resourceDelta, spell, unsupported, when, zone } from "../core/catalog/index.ts";
import type { CatalogEntry } from "../core/catalog/types.ts";
import {
  describeCatalogConstraint,
  describeCatalogEffect,
  describeCatalogEffectLine,
  formatCatalogCost,
  formatCatalogRange,
  getCatalogCostTokens,
  getCatalogRangeTokens,
} from "./catalogEntryInfo.ts";

const entry = spell("test-spell", {
  name: "Test Spell",
  cost: { ap: 3, wp: 1 },
  range: range(2, 5, { lineOfSight: true, modifiable: false }),
  effects: [damage({ element: "fire", base: 42 }), resourceDelta({ resource: "bq", amount: 80 }), unsupported("Special rule.")],
  constraints: [maxCastsPerTurn(2)],
  metadata: { status: "extracted", normalizedLevel: 200, sources: [{ kind: "manual", label: "test" }] },
}) as CatalogEntry;

test("formats catalog cost and range for Wakfuli-style spell summaries", () => {
  assert.equal(formatCatalogCost(entry), "3 PA, 1 PW");
  assert.equal(formatCatalogRange(entry), "2-5 PO, ligne de vue, non modifiable");
});

test("describes catalog effects and constraints for the spell tooltip", () => {
  assert.equal(describeCatalogEffect(entry.effects[0]), "Dégâts Feu : 42");
  assert.equal(describeCatalogEffect(entry.effects[1]), "BQ +80");
  assert.equal(describeCatalogEffect(entry.effects[2]), "Special rule.");
  assert.equal(describeCatalogConstraint(entry.constraints[0]), "2 lancer(s) par tour");
});

test("provides Wakfuli pictograms for tooltip cost, range, damage and runes", () => {
  const costTokens = getCatalogCostTokens(entry);
  assert.equal(costTokens[0].text, "3");
  assert.match(costTokens[0].icon?.src ?? "", /AP\.webp/);

  const rangeTokens = getCatalogRangeTokens(entry);
  assert.equal(rangeTokens[0].text, "2-5 PO");
  assert.match(rangeTokens[0].icon?.src ?? "", /RANGE\.webp/);

  const damageLine = describeCatalogEffectLine(damage({ element: "air", base: 30 }));
  assert.equal(damageLine.text, "Dégâts Air : 30");
  assert.deepEqual(damageLine.icons.map((icon) => icon.tone), ["target", "damage"]);
  assert.match(damageLine.icons[1].src, /DMG_AIR_PERCENT\.webp/);

  const runeLine = describeCatalogEffectLine(when({ type: "hasRune", rune: "aerial" }, [
    movement({ mode: "pull", target: "target", cells: 1 }),
  ]));
  assert.equal(runeLine.text, "Attire de 1 case");
  assert.equal(runeLine.icons[0].label, "Aérienne");
  assert.match(runeLine.icons[0].src, /rune4\.webp/);
});

test("uses the cone area pictogram for Resonance zone conversion", () => {
  const resonanceZoneLine = describeCatalogEffectLine(when({ type: "hasRune", rune: "incandescent" }, [
    zone({ shape: "unknown", note: "La zone devient l'icone affichee." }),
  ]));

  assert.equal(resonanceZoneLine.text, "La zone devient");
  assert.deepEqual(resonanceZoneLine.icons.map((icon) => icon.tone), ["rune", "area"]);
  assert.match(resonanceZoneLine.icons[1].src, /area-con\.png/);
});
