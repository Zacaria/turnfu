import type { CSSProperties, ReactNode } from "react";
import type { Element } from "../core/catalog/types.ts";
import "./huppermageRuneAura.css";

type AuraRange = number | {
  min: number;
  max: number;
};

export type HuppermageRuneAuraTuning = {
  intensity?: AuraRange;
  speed?: AuraRange;
  size?: AuraRange;
};

type HuppermageRuneAuraProps = {
  active: boolean;
  activeHeart: Element | null | undefined;
  bqPercent: number;
  children: ReactNode;
  className?: string;
  element: Element;
  title?: string;
  tuning?: HuppermageRuneAuraTuning;
};

const defaultTuning: Required<HuppermageRuneAuraTuning> = {
  intensity: { min: 34, max: 92 },
  speed: { min: 34, max: 86 },
  size: { min: 14, max: 26 },
};

const elementAuraTones: Record<Element, { color: string; core: string; shadow: string }> = {
  fire: {
    color: "#ff7135",
    core: "#ffd470",
    shadow: "#8e1f0f",
  },
  water: {
    color: "#2eb7ff",
    core: "#bff8ff",
    shadow: "#0a4f80",
  },
  earth: {
    color: "#72c45d",
    core: "#d6ff8d",
    shadow: "#315821",
  },
  air: {
    color: "#b78cff",
    core: "#f3ddff",
    shadow: "#5b3d99",
  },
  light: {
    color: "#f3df8a",
    core: "#fff7ce",
    shadow: "#8f6b16",
  },
  neutral: {
    color: "#b9c2bd",
    core: "#f3f7f5",
    shadow: "#4f5a55",
  },
};

const energyRingIndexes = [1, 2, 3, 4];
const sparkIndexes = Array.from({ length: 14 }, (_, index) => index + 1);

export function HuppermageRuneAura({
  active,
  activeHeart,
  bqPercent,
  children,
  className,
  element,
  title,
  tuning,
}: HuppermageRuneAuraProps) {
  const heartActive = activeHeart === element;
  const tone = elementAuraTones[element];
  const normalizedBqPercent = clamp(bqPercent, 0, 1);
  const intensity = resolveAuraRange(tuning?.intensity ?? defaultTuning.intensity, normalizedBqPercent);
  const speed = resolveAuraRange(tuning?.speed ?? defaultTuning.speed, normalizedBqPercent);
  const size = resolveAuraRange(tuning?.size ?? defaultTuning.size, normalizedBqPercent);
  const style = {
    "--rune-aura-color": tone.color,
    "--rune-aura-core": tone.core,
    "--rune-aura-shadow": tone.shadow,
    "--rune-aura-strength": (intensity / 100).toFixed(2),
    "--rune-aura-speed": `${2.4 - speed / 65}s`,
    "--rune-aura-size": `${size}px`,
  } as CSSProperties;

  return (
    <span
      className={`huppermage-rune-aura ${active ? "active" : ""} ${heartActive ? "heart-active" : ""} ${className ?? ""}`}
      style={style}
      title={title}
    >
      <span className="huppermage-rune-aura-field" aria-hidden="true">
        {energyRingIndexes.map((index) => (
          <span className={`huppermage-rune-aura-ring huppermage-rune-aura-ring-${index}`} key={`ring-${index}`} />
        ))}
        {sparkIndexes.map((index) => (
          <span className={`huppermage-rune-aura-spark huppermage-rune-aura-spark-${index}`} key={`spark-${index}`} />
        ))}
      </span>
      <span className="huppermage-rune-aura-frame">
        <span className="huppermage-rune-aura-inner-ring" aria-hidden="true" />
        <span className="huppermage-rune-aura-content">{children}</span>
      </span>
    </span>
  );
}

function resolveAuraRange(range: AuraRange, bqPercent: number): number {
  if (typeof range === "number") {
    return range;
  }

  return range.min + (range.max - range.min) * bqPercent;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
