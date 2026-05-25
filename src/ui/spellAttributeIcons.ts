import type { Rune } from "../core/catalog/types.ts";
import { formatRuneLabel } from "./i18n.ts";

export type SpellAttributeIconKey =
  | "caster"
  | "enemy"
  | "rune1"
  | "rune2"
  | "rune3"
  | "rune4";

const spellAttributeIconUrls: Record<SpellAttributeIconKey, string> = {
  caster: new URL("./assets/spellAttributes/wakfuli/caster.webp", import.meta.url).href,
  enemy: new URL("./assets/spellAttributes/wakfuli/enemy.webp", import.meta.url).href,
  rune1: new URL("./assets/spellAttributes/wakfuli/rune1.webp", import.meta.url).href,
  rune2: new URL("./assets/spellAttributes/wakfuli/rune2.webp", import.meta.url).href,
  rune3: new URL("./assets/spellAttributes/wakfuli/rune3.webp", import.meta.url).href,
  rune4: new URL("./assets/spellAttributes/wakfuli/rune4.webp", import.meta.url).href,
};

const runeIconKeys: Record<Rune, SpellAttributeIconKey> = {
  incandescent: "rune1",
  aquatic: "rune2",
  telluric: "rune3",
  aerial: "rune4",
};

export function getSpellAttributeIconSrc(iconKey: SpellAttributeIconKey): string {
  return spellAttributeIconUrls[iconKey];
}

export function getRuneIconSrc(rune: Rune): string {
  return getSpellAttributeIconSrc(runeIconKeys[rune]);
}

export function getRuneIconLabel(rune: Rune): string {
  return formatRuneLabel(rune);
}
