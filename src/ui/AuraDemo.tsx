import { useMemo, useState, type CSSProperties } from "react";
import type { Rune } from "../core/catalog/types.ts";
import { formatRuneLabel } from "./i18n.ts";
import { getRuneIconSrc } from "./spellAttributeIcons.ts";
import "./auraDemo.css?v=energy-no-spikes-v1";

type RuneTone = {
  rune: Rune;
  color: string;
  core: string;
  shadow: string;
};

const runeTones: RuneTone[] = [
  {
    rune: "incandescent",
    color: "#ff7135",
    core: "#ffd470",
    shadow: "#8e1f0f",
  },
  {
    rune: "aquatic",
    color: "#2eb7ff",
    core: "#bff8ff",
    shadow: "#0a4f80",
  },
  {
    rune: "telluric",
    color: "#72c45d",
    core: "#d6ff8d",
    shadow: "#315821",
  },
  {
    rune: "aerial",
    color: "#b78cff",
    core: "#f3ddff",
    shadow: "#5b3d99",
  },
];

const runeOptions = runeTones.map((tone) => tone.rune);
const energyRingIndexes = Array.from({ length: 4 }, (_, index) => index + 1);
const energyBoltIndexes = Array.from({ length: 10 }, (_, index) => index + 1);
const flameIndexes = Array.from({ length: 11 }, (_, index) => index + 1);
const sparkIndexes = Array.from({ length: 14 }, (_, index) => index + 1);

export function AuraDemo() {
  const [selectedRune, setSelectedRune] = useState<Rune>("incandescent");
  const [intensity, setIntensity] = useState(74);
  const [speed, setSpeed] = useState(54);
  const [auraSize, setAuraSize] = useState(68);
  const [isPressed, setIsPressed] = useState(false);
  const tone = useMemo(
    () => runeTones.find((runeTone) => runeTone.rune === selectedRune) ?? runeTones[0],
    [selectedRune],
  );
  const auraStyle = {
    "--rune-color": tone.color,
    "--rune-core": tone.core,
    "--rune-shadow": tone.shadow,
    "--aura-strength": (intensity / 100).toFixed(2),
    "--aura-speed": `${2.4 - speed / 65}s`,
    "--aura-size": `${auraSize}px`,
  } as CSSProperties;

  return (
    <main className="aura-demo" style={auraStyle}>
      <section className="aura-stage" aria-labelledby="aura-title">
        <div className="aura-workbench">
          <div className="aura-copy">
            <a className="aura-back-link" href="/">Optimizer</a>
            <h1 id="aura-title">Rune aura lab</h1>
            <p>{formatRuneLabel(selectedRune)}</p>
          </div>

          <div className="rune-orbit" aria-live="polite">
            <div className={`rune-aura-shell ${isPressed ? "is-pressed" : ""}`}>
              <div className="aura-energy-field" aria-hidden="true">
                {energyRingIndexes.map((index) => (
                  <span className={`aura-energy-ring aura-energy-ring-${index}`} key={`ring-${index}`} />
                ))}
                {energyBoltIndexes.map((index) => (
                  <span className={`aura-energy-bolt aura-energy-bolt-${index}`} key={`bolt-${index}`} />
                ))}
              </div>
              <div className="aura-flames" aria-hidden="true">
                {flameIndexes.map((index) => (
                  <span className={`aura-flame aura-flame-${index}`} key={index} />
                ))}
              </div>
              <div className="aura-sparks" aria-hidden="true">
                {sparkIndexes.map((index) => (
                  <span className={`aura-spark aura-spark-${index}`} key={index} />
                ))}
              </div>
              <button
                aria-label={`${formatRuneLabel(selectedRune)} rune aura preview`}
                className="aura-rune-button"
                type="button"
                onMouseDown={() => setIsPressed(true)}
                onMouseLeave={() => setIsPressed(false)}
                onMouseUp={() => setIsPressed(false)}
                onTouchEnd={() => setIsPressed(false)}
                onTouchStart={() => setIsPressed(true)}
              >
                <span className="aura-ring" aria-hidden="true" />
                <img alt="" src={getRuneIconSrc(selectedRune)} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="aura-controls" aria-label="Aura controls">
        <div className="rune-choice-row" role="group" aria-label="Rune color">
          {runeOptions.map((rune) => (
            <button
              className={`rune-choice ${selectedRune === rune ? "selected" : ""}`}
              key={rune}
              type="button"
              onClick={() => setSelectedRune(rune)}
            >
              <img alt="" src={getRuneIconSrc(rune)} />
              <span>{formatRuneLabel(rune)}</span>
            </button>
          ))}
        </div>

        <div className="aura-slider-grid">
          <SliderControl label="Intensity" max={100} min={20} value={intensity} onChange={setIntensity} />
          <SliderControl label="Speed" max={100} min={20} value={speed} onChange={setSpeed} />
          <SliderControl label="Aura size" max={94} min={36} value={auraSize} onChange={setAuraSize} />
        </div>
      </section>
    </main>
  );
}

function SliderControl({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="aura-slider">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{value}</output>
    </label>
  );
}
