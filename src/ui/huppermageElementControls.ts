import type { Element, Rune } from "../core/catalog/types.ts";
import type { HuppermageHeart } from "../core/simulation/types.ts";

export type HuppermageElementChoice = HuppermageHeart;

export const huppermageElementChoices: HuppermageElementChoice[] = ["fire", "water", "earth", "air"];

const runeByElement: Record<HuppermageElementChoice, Rune> = {
  fire: "incandescent",
  water: "aquatic",
  earth: "telluric",
  air: "aerial",
};

const elementByRune: Record<Rune, HuppermageElementChoice> = {
  incandescent: "fire",
  aquatic: "water",
  telluric: "earth",
  aerial: "air",
};

export function elementToRune(element: HuppermageElementChoice): Rune {
  return runeByElement[element];
}

export function runeToElementChoice(rune: Rune | null | undefined): HuppermageElementChoice | null {
  return rune ? elementByRune[rune] : null;
}

export function isHuppermageElementChoice(element: Element): element is HuppermageElementChoice {
  return huppermageElementChoices.includes(element as HuppermageElementChoice);
}
