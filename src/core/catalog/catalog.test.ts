import assert from "node:assert/strict";
import test from "node:test";

import {
  damage,
  getHuppermageClassMechanics,
  getHuppermageEntry,
  getHuppermagePassives,
  getHuppermageSpells,
  huppermageCatalog,
  maxCastsPerTurn,
  normalizeCatalog,
  passive,
  resourceDelta,
  screenshot,
  spell,
  unsupported,
  validateCatalog,
  when,
} from "./index.ts";
import type { CatalogEntry } from "./types.ts";

const testSource = screenshot("/tmp/huppermage-test.png", "test-source");

test("loads valid DSL-authored Huppermage catalog entries", () => {
  assert.ok(huppermageCatalog.length > 0);
  assert.ok(getHuppermageSpells().length >= 20);
  assert.ok(getHuppermagePassives().length >= 10);
  assert.ok(getHuppermageClassMechanics().length >= 5);

  const runification = getHuppermageEntry("runification");
  assert.equal(runification?.kind, "spell");
  assert.equal(runification?.metadata.normalizedLevel, 200);
  assert.equal(runification?.metadata.status, "extracted");
});

test("keeps costs separated from effects for pre-cast validation", () => {
  const surcharge = getHuppermageEntry("surcharge-runique");
  assert.deepEqual(surcharge?.cost, { ap: 2, bq: 200, wp: 1 });
  assert.ok(surcharge?.effects.some((effect) => effect.type === "heal"));
});

test("contains conditional effects and passive/class-mechanic entries", () => {
  const halo = getHuppermageEntry("halo-chatoyant");
  assert.ok(halo?.effects.some((effect) => effect.type === "conditional"));

  const guerrier = getHuppermageEntry("guerrier-elementaire");
  assert.equal(guerrier?.kind, "classMechanic");

  const carnage = getHuppermageEntry("carnage");
  assert.equal(carnage?.kind, "passive");
});

test("contains the complete Huppermage passive list", () => {
  const expectedPassiveIds = [
    "evasion",
    "dynamo",
    "antithese",
    "interception",
    "distension-elementaire",
    "liaison-lumineuse",
    "inspiration",
    "plenitude",
    "universalite",
    "motivation",
    "extension-des-sens",
    "profusion-runique",
    "absorption-quadramentale",
    "refraction-elementaire",
    "medecine",
    "altruisme-de-lame",
    "nouveau-souffle",
    "rock",
    "essor-de-lame",
    "pulsation",
    "carnage",
    "sauvegarde-runique",
    "fluctuation",
    "initiative-de-lame",
    "combinaison-elementaire",
    "transcendance-runique",
  ].sort();

  const passiveIds = getHuppermagePassives().map((entry) => entry.id).sort();

  assert.deepEqual(passiveIds, expectedPassiveIds);
});

test("records unsupported mechanics explicitly", () => {
  const resonance = getHuppermageEntry("resonance");
  assert.ok(
    resonance?.effects.some(
      (effect) =>
        effect.type === "conditional" &&
        effect.effects.some((nestedEffect) => nestedEffect.type === "tag" || nestedEffect.type === "unsupportedMechanic"),
    ),
  );

  const feuFollet = getHuppermageEntry("feu-follet");
  assert.ok(feuFollet?.effects.some((effect) => effect.type === "conditional"));
});

test("rejects duplicate entry ids", () => {
  const entries = normalizeCatalog([
    spell("duplicate", {
      name: "Duplicate A",
      effects: [],
      constraints: [],
      metadata: { status: "extracted", sources: [testSource] },
    }),
    spell("duplicate", {
      name: "Duplicate B",
      effects: [],
      constraints: [],
      metadata: { status: "extracted", sources: [testSource] },
    }),
  ]);

  const errors = validateCatalog(entries);
  assert.ok(errors.some((error) => error.field === "id" && error.message.includes("Duplicate")));
});

test("rejects negative costs and invalid resource references", () => {
  const entry = normalizeCatalog([
    spell("bad-cost", {
      name: "Bad Cost",
      cost: { ap: -1, bogus: 2 } as never,
      effects: [],
      constraints: [],
      metadata: { status: "extracted", sources: [testSource] },
    }),
  ]);

  const errors = validateCatalog(entry);
  assert.ok(errors.some((error) => error.field === "cost.ap"));
  assert.ok(errors.some((error) => error.message.includes("Invalid resource")));
});

test("rejects arbitrary executable DSL logic", () => {
  assert.throws(
    () =>
      normalizeCatalog([
        spell("bad-effect", {
          name: "Bad Effect",
          effects: [(() => "not a registered primitive") as never],
          constraints: [],
          metadata: { status: "extracted", sources: [testSource] },
        }),
      ]),
    /Unknown DSL effect/,
  );
});

test("requires review metadata before screenshot-derived entries can be verified", () => {
  const entries = normalizeCatalog([
    spell("verified-without-review", {
      name: "Verified Without Review",
      effects: [damage({ element: "light", base: 1 })],
      constraints: [],
      metadata: { status: "verified", sources: [testSource] },
    }),
  ]);

  const errors = validateCatalog(entries);
  assert.ok(errors.some((error) => error.field === "metadata.status"));
});

test("validates level-200 baseline metadata", () => {
  const entries = normalizeCatalog([
    passive("wrong-level", {
      name: "Wrong Level",
      effects: [unsupported("Test")],
      constraints: [],
      metadata: {
        status: "extracted",
        normalizedLevel: 110,
        observedLevel: 110,
        sources: [testSource],
      },
    }),
  ]);

  const errors = validateCatalog(entries);
  assert.ok(errors.some((error) => error.field === "metadata.normalizedLevel"));
});

test("supports conditions, max-cast constraints, and screenshot provenance", () => {
  const entries = normalizeCatalog([
    spell("dsl-example", {
      name: "DSL Example",
      cost: { ap: 2 },
      effects: [
        when({ type: "hasRune", rune: "aquatic" }, [resourceDelta({ resource: "ap", amount: 1 })]),
      ],
      constraints: [maxCastsPerTurn(2)],
      metadata: {
        status: "extracted",
        sources: [testSource],
      },
    }),
  ]);

  const [entry] = entries as CatalogEntry[];
  assert.equal(entry.metadata.sources[0].kind, "screenshot");
  assert.equal(entry.constraints[0].type, "maxCastsPerTurn");
  assert.equal(validateCatalog(entries).length, 0);
});
