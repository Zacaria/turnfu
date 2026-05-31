import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultLocale,
  formatAptitudeFamilyLabel,
  formatAptitudeLabel,
  formatResourceLabel,
  formatUiMessage,
  getUiLocale,
  setUiLocale,
  t,
} from "./i18n.ts";

test("uses French UI wording by default", () => {
  assert.equal(defaultLocale, "fr");
  setUiLocale("fr");
  assert.equal(getUiLocale(), "fr");
  assert.equal(t("app.title"), "Optimiseur de tour Wakfu");
  assert.equal(t("app.heading"), "Planificateur de tour");
  assert.equal(t("status.valid"), "Valide");
});

test("can switch UI wording to English", () => {
  setUiLocale("en");
  assert.equal(getUiLocale(), "en");
  assert.equal(t("app.title"), "Wakfu Turn Optimizer");
  assert.equal(t("app.heading"), "Turn Planner");
  assert.equal(t("status.valid"), "Valid");
  setUiLocale("fr");
});

test("translates gameplay option values for UI controls", () => {
  setUiLocale("fr");
  assert.equal(t("target.enemy"), "Ennemi");
  assert.equal(t("target.emptyCell"), "Case vide");
  assert.equal(t("position.rear"), "Dos");
  assert.equal(t("range.none"), "Aucune");
});

test("uses French resource abbreviations for UI labels", () => {
  setUiLocale("fr");
  assert.equal(formatResourceLabel("ap"), "PA");
  assert.equal(formatResourceLabel("mp"), "PM");
  assert.equal(formatResourceLabel("wp"), "PW");
  assert.equal(formatResourceLabel("bq"), "BQ");
});

test("translates aptitude labels for the selected locale", () => {
  setUiLocale("fr");
  assert.equal(formatAptitudeFamilyLabel("agility"), "Agilité");
  assert.equal(formatAptitudeLabel(16), "Résistance élémentaire");

  setUiLocale("en");
  assert.equal(formatAptitudeFamilyLabel("agility"), "Agility");
  assert.equal(formatAptitudeLabel(16), "Elemental resistance");
  setUiLocale("fr");
});

test("formats parameterized UI messages through the shared dictionary", () => {
  setUiLocale("fr");
  assert.equal(formatUiMessage("cursor.step", { value: 2, max: 5 }), "Étape 2/5");
  assert.equal(formatUiMessage("stat.decrementTitle", { label: "Maîtrise" }), "Retirer 1 Maîtrise. Maj : -10");
});

test("falls back to the key when a parameterized UI message is missing", () => {
  setUiLocale("fr");
  assert.equal(formatUiMessage("missing.runtime.key" as never, { value: 1 }), "missing.runtime.key");
});
