import assert from "node:assert/strict";
import test from "node:test";

import { elementToRune, runeToElementChoice } from "./huppermageElementControls.ts";

test("maps Huppermage elements to their rune names", () => {
  assert.equal(elementToRune("fire"), "incandescent");
  assert.equal(elementToRune("water"), "aquatic");
  assert.equal(elementToRune("earth"), "telluric");
  assert.equal(elementToRune("air"), "aerial");
});

test("maps rune names back to Huppermage elements", () => {
  assert.equal(runeToElementChoice("incandescent"), "fire");
  assert.equal(runeToElementChoice("aquatic"), "water");
  assert.equal(runeToElementChoice("telluric"), "earth");
  assert.equal(runeToElementChoice("aerial"), "air");
  assert.equal(runeToElementChoice(null), null);
});
