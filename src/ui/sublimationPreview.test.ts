import assert from "node:assert/strict";
import test from "node:test";

import { createSublimationPreviewItems, createSublimationStateItems } from "./sublimationPreview.ts";

test("creates Wakfuli-style sublimation preview items with capped levels", () => {
  const items = createSublimationPreviewItems({
    selections: [
      { sublimationId: "influence-6" },
      { sublimationId: "influence-6" },
      { sublimationId: "sauvegarde-6" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(items[0].name, "Influence");
  assert.equal(items[0].tone, "level-3");
  assert.match(items[0].iconSrc ?? "", /\/assets\/sublimations\/wakfuli\/.+\.webp/);
  assert.equal(items[0].rawLevel, 12);
  assert.equal(items[0].effectiveLevel, 6);
  assert.deepEqual(items[0].effectLines, ["+18 % Coup critique"]);
  assert.equal(items[1].name, "Sauvegarde");
  assert.deepEqual(items[1].effectLines, ["Reporte 3 PA"]);
});

test("formats partially supported sublimation effects", () => {
  const items = createSublimationPreviewItems({
    selections: [
      { sublimationId: "expert-des-armes-legeres-6" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(items[0].name, "Expert des armes légères");
  assert.deepEqual(items[0].effectLines, ["+900 Maîtrise"]);
  assert.match(items[0].supportReason ?? "", /cible avec de l.armure/);
});

test("formats damage-focused supported sublimations", () => {
  const items = createSublimationPreviewItems({
    selections: [
      { sublimationId: "armure-lourde-2" },
      { sublimationId: "carnage-6" },
      { sublimationId: "brulure-4" },
      { sublimationId: "brulure-secondaire-4" },
    ],
    hpAssumption: "healthy90",
  });

  assert.deepEqual(items.find((item) => item.name === "Armure lourde")?.effectLines, ["-1 PM", "+10 % Dommages infligés"]);
  assert.deepEqual(items.find((item) => item.name === "Carnage")?.effectLines, ["+540 Maîtrise"]);
  assert.deepEqual(items.find((item) => item.name === "Brûlure")?.effectLines, ["+16 % dégâts si sort feu (hors Lumière)"]);
  assert.deepEqual(
    items.find((item) => item.name === "Brûlure secondaire")?.effectLines,
    ["+8 % dégâts au prochain sort feu après sort eau, terre ou air (max 30 %, hors Lumière)"],
  );
});

test("formats supported epic and relic sublimations with display levels", () => {
  const items = createSublimationPreviewItems({
    selections: [
      { sublimationId: "alternance-ii" },
      { sublimationId: "concentration-elementaire" },
      { sublimationId: "exces-ii" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(items.find((item) => item.id === "alternance")?.name, "Alternance II");
  assert.equal(items.find((item) => item.id === "alternance")?.tone, "relic");
  assert.deepEqual(items.find((item) => item.id === "alternance")?.effectLines, ["+15 % dégâts au prochain sort d’un autre élément"]);
  assert.equal(items.find((item) => item.id === "concentration-elementaire")?.tone, "epic");
  assert.deepEqual(items.find((item) => item.id === "concentration-elementaire")?.effectLines, [
    "+20 % Dommages infligés",
    "+20 % Soins réalisés",
    "-30 % Maîtrise sur les 3 éléments les plus faibles",
  ]);
  assert.deepEqual(items.find((item) => item.id === "exces")?.effectLines, [
    "-10 % Dommages infligés",
    "+50 % dégâts au prochain sort tous les 5 sorts à PA",
  ]);
});

test("formats puissance brute stackable effects", () => {
  const items = createSublimationPreviewItems({
    selections: [
      { sublimationId: "puissance-brute-ii" },
      { sublimationId: "puissance-brute-ii" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(items[0].name, "Puissance Brute II");
  assert.deepEqual(items[0].effectLines, [
    "-4 PW",
    "+8 % dégâts par PW ou BQ dépensé ce tour (max 16 %)",
  ]);
});

test("creates state tracker items for active sublimations and current action effects", () => {
  const items = createSublimationStateItems({
    build: {
      selections: [
        { sublimationId: "carnage-6" },
        { sublimationId: "brulure-4" },
      ],
      hpAssumption: "normal",
    },
    appliedEffects: [
      {
        type: "sublimationEffect",
        sublimationId: "brulure-4",
        sublimationName: "Brûlure",
        status: "skipped",
        reason: "notFireSpell",
        source: "sublimation",
      },
    ],
  });

  assert.deepEqual(
    items.map((item) => ({
      name: item.name,
      status: item.status,
      statusLabel: item.statusLabel,
      detail: item.detail,
    })),
    [
      {
        name: "Carnage",
        status: "active",
        statusLabel: "Actif",
        detail: "Bonus permanent",
      },
      {
        name: "Brûlure",
        status: "waiting",
        statusLabel: "En attente",
        detail: "Condition non remplie",
      },
    ],
  );
});
