import { huppermageCatalog } from "../src/core/catalog/index.ts";
import { createResources } from "../src/core/simulation/index.ts";
import { serializeRustWasmOptimizerRequest } from "../src/core/optimizer/rustWasmBackendTypes.ts";

const requestJson = serializeRustWasmOptimizerRequest({
  catalog: huppermageCatalog,
  character: {
    id: "rust-wasm-differential-smoke",
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
  seed: "rust-wasm-differential-smoke",
  maxActionsPerTurn: 8,
  maxPassiveCount: 3,
});

console.log(JSON.stringify({
  status: "scaffolded",
  requestBytes: requestJson.length,
  message: "Rust/WASM differential harness scaffold is ready; gameplay comparisons are implemented in later tasks.",
}));
