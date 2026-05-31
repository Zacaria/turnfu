import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runRustWasmDifferentialSuite } from "../src/core/optimizer/rustWasmDifferential.ts";

const wasmPackagePath = resolve("src/wasm/optimizer_wasm_pkg/optimizer_wasm.js");
const shouldBuild = !process.argv.includes("--no-build") || !existsSync(wasmPackagePath);

if (shouldBuild) {
  const build = spawnSync("wasm-pack", [
    "build",
    "rust/optimizer-wasm",
    "--target",
    "nodejs",
    "--out-dir",
    "../../src/wasm/optimizer_wasm_pkg",
  ], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const require = createRequire(import.meta.url);
const wasm = require(wasmPackagePath);
const result = runRustWasmDifferentialSuite(wasm);

console.log(JSON.stringify({
  status: result.passed ? "passed" : "failed",
  fixtureCount: result.fixtureCount,
  mismatchCount: result.mismatchCount,
  firstMismatch: result.firstMismatch,
  elapsedMs: result.elapsedMs,
}, null, 2));

if (!result.passed) {
  process.exit(1);
}
