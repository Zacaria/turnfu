import { performance } from "node:perf_hooks";

import { huppermageCatalog } from "../src/core/catalog/index.ts";
import { createResources } from "../src/core/simulation/index.ts";
import { serializeRustWasmOptimizerRequest } from "../src/core/optimizer/rustWasmBackendTypes.ts";

const iterations = parseIntegerArg("--iterations", 1000);
const started = performance.now();
let requestBytes = 0;

for (let index = 0; index < iterations; index += 1) {
  requestBytes += serializeRustWasmOptimizerRequest({
    catalog: huppermageCatalog,
    character: {
      id: "rust-wasm-benchmark-scaffold",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        level: 200,
        generalMastery: 1200,
        elementalMastery: {
          fire: 1200,
          water: 1200,
          earth: 1200,
          air: 1200,
          light: 0,
          neutral: 0,
        },
        damageInflictedPercent: 0,
      },
    },
    duration: 3,
    engines: ["hybrid"],
    budget: { iterations: 1 },
    seed: `rust-wasm-benchmark-scaffold:${index}`,
    maxActionsPerTurn: 8,
    maxPassiveCount: 3,
  }).length;
}

const elapsedMs = performance.now() - started;

console.log(JSON.stringify({
  backend: "rustWasm",
  phase: "request-serialization-scaffold",
  iterations,
  elapsedMs: round(elapsedMs),
  requestsPerSecond: round(iterations / Math.max(0.001, elapsedMs / 1000)),
  averageRequestBytes: Math.round(requestBytes / Math.max(1, iterations)),
}));

function parseIntegerArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return fallback;
  }
  const value = Number.parseInt(process.argv[index + 1] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
