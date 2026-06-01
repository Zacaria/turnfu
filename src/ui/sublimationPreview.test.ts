import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createResources } from "../core/simulation/index.ts";
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

test("marks combat-start sublimation conditions waiting when initial resources do not match", () => {
  const items = createSublimationStateItems({
    build: {
      selections: [{ sublimationId: "inflexibilite" }],
      hpAssumption: "normal",
    },
    appliedEffects: [],
    initialConditionResources: createResources({ ap: 13, mp: 3, wp: 6, bq: 500 }),
    initialConditionStats: {
      generalMastery: 0,
      elementalMastery: {},
      damageInflictedPercent: 0,
    },
  });

  assert.deepEqual(items.map((item) => ({
    name: item.name,
    status: item.status,
    statusLabel: item.statusLabel,
    detail: item.detail,
  })), [
    {
      name: "Inflexibilité",
      status: "waiting",
      statusLabel: "En attente",
      detail: "Condition non remplie",
    },
  ]);
});

test("keeps sublimation preview labels colored by the card tone inside muted rows", () => {
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(
    styles,
    /\.sublimation-preview-card\s+\.sublimation-preview-name\s*\{[^}]*color:\s*inherit;/s,
  );
});

test("builder sublimation choices color labels by Wakfuli tone without a rank badge", () => {
  const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

  assert.match(appSource, /className=\{`sublimation-title-\$\{previewItem\.tone\}`\}/);
  assert.doesNotMatch(appSource, /library-sublimation-level/);
});

test("candidate spell and passive icons are large while icon rows stay compact", () => {
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.candidate-spell-icon\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/s);
  assert.match(styles, /\.candidate-spell-icon-rows\s*\{[^}]*gap:\s*2px;[^}]*margin-top:\s*2px;/s);
  assert.match(styles, /\.candidate-spell-icon-row\s*\{[^}]*gap:\s*6px;[^}]*min-height:\s*40px;/s);
});
