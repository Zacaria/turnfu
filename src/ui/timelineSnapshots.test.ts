import assert from "node:assert/strict";
import test from "node:test";

import { cost, damage, normalizeCatalog, resourceDelta, screenshot, spell } from "../core/catalog/index.ts";
import { createResources, simulateCombo, simulateTurn } from "../core/simulation/index.ts";
import type { CatalogEntry } from "../core/catalog/types.ts";
import type { SimulatedCharacter } from "../core/simulation/types.ts";
import { createComboTimelineSnapshots, createTimelineSnapshots } from "./timelineSnapshots.ts";

const source = screenshot("/tmp/timeline-snapshot-test.png", "timeline-snapshot-test");

const catalog = normalizeCatalog([
  spell("spark", {
    name: "Spark",
    level: 200,
    element: "fire",
    cost: cost({ ap: 2 }),
    effects: [damage({ element: "fire", base: 10 }), resourceDelta({ resource: "bq", amount: 20 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("expensive", {
    name: "Expensive",
    level: 200,
    element: "light",
    cost: cost({ ap: 9 }),
    effects: [damage({ element: "light", base: 50 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
]) as CatalogEntry[];

const character: SimulatedCharacter = {
  id: "snapshot-huppermage",
  className: "huppermage",
  resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 0 }),
  stats: {
    generalMastery: 0,
    elementalMastery: { fire: 100 },
    damageInflictedPercent: 0,
  },
};

test("creates one initial snapshot and one snapshot per completed action", () => {
  const result = simulateTurn({
    catalog,
    character,
    sequence: { actions: [{ spellId: "spark" }, { spellId: "spark" }] },
  });

  const snapshots = createTimelineSnapshots(result, character);

  assert.equal(snapshots.length, 3);
  assert.equal(snapshots[0].kind, "initial");
  assert.equal(snapshots[0].label, "État initial");
  assert.equal(snapshots[0].resources.ap, 6);
  assert.equal(snapshots[0].totalDamageSoFar, 0);
  assert.equal(snapshots[1].kind, "action");
  assert.equal(snapshots[1].resources.ap, 5);
  assert.equal(snapshots[1].resources.bq, 20);
  assert.equal(snapshots[1].totalDamageSoFar, 20);
  assert.equal(snapshots[2].resources.ap, 3);
  assert.equal(snapshots[2].totalDamageSoFar, 44);
});

test("keeps completed snapshots available when a later action is invalid", () => {
  const result = simulateTurn({
    catalog,
    character,
    sequence: { actions: [{ spellId: "spark" }, { spellId: "expensive" }] },
  });

  const snapshots = createTimelineSnapshots(result, character);

  assert.equal(result.valid, false);
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[1].spellId, "spark");
  assert.equal(snapshots[1].violations.length, 1);
  assert.equal(snapshots[1].violations[0].type, "insufficientResource");
});

test("flattens multi-turn combo snapshots into a global cursor sequence", () => {
  const result = simulateCombo({
    catalog,
    character,
    combo: {
      turns: [
        { actions: [{ spellId: "spark" }] },
        { actions: [{ spellId: "spark" }] },
      ],
    },
  });

  const snapshots = createComboTimelineSnapshots(result, character);

  assert.equal(result.valid, true);
  assert.equal(snapshots.length, 3);
  assert.equal(snapshots[0].kind, "initial");
  assert.equal(snapshots[1].turnIndex, 0);
  assert.equal(snapshots[1].actionIndex, 0);
  assert.equal(snapshots[1].totalDamageSoFar, 20);
  assert.equal(snapshots[2].turnIndex, 1);
  assert.equal(snapshots[2].actionIndex, 0);
  assert.equal(snapshots[2].totalDamageSoFar, 44);
});
