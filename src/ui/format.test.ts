import assert from "node:assert/strict";
import test from "node:test";

import { describeEffect, describeViolation, formatResources } from "./format.ts";

test("formats resources with French Wakfu abbreviations", () => {
  assert.equal(formatResources({ ap: 12, mp: 6, wp: 3, bq: 500 }), "PA 12 | PM 6 | PW 3 | BQ 500");
});

test("uses French resource abbreviations in effect descriptions", () => {
  assert.equal(
    describeEffect({
      type: "resourceDelta",
      resource: "ap",
      amount: 1,
      before: 6,
      after: 7,
      source: "spellEffect",
    }),
    "PA +1 : 6 -> 7",
  );
});

test("uses French resource abbreviations in violation descriptions", () => {
  assert.equal(
    describeViolation({
      type: "insufficientResource",
      actionIndex: 0,
      spellId: "test",
      resource: "mp",
      required: 2,
      available: 1,
      message: "raw message",
    }),
    "Ressource insuffisante : 2 PM requis, 1 disponible.",
  );
});
