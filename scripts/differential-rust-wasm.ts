import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runRustWasmDifferentialSuite } from "../src/core/optimizer/rustWasmDifferential.ts";
import {
  rustWasmDifferentialCiFixtureOptions,
  rustWasmDifferentialSoakFixtureOptions,
  type RustWasmDifferentialFixtureOptions,
} from "../src/core/optimizer/rustWasmDifferentialFixtures.ts";

type DifferentialProfileName = "ci" | "soak";

const differentialProfiles: Record<DifferentialProfileName, RustWasmDifferentialFixtureOptions> = {
  ci: rustWasmDifferentialCiFixtureOptions,
  soak: rustWasmDifferentialSoakFixtureOptions,
};

const args = process.argv.slice(2);

const wasmPackagePath = resolve("src/wasm/optimizer_wasm_pkg/optimizer_wasm.js");
const shouldBuild = !args.includes("--no-build") || !existsSync(wasmPackagePath);
const profileName = parseProfileName(args);
const differentialOptions = parseDifferentialOptions(args, differentialProfiles[profileName]);

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
const result = runRustWasmDifferentialSuite(wasm, differentialOptions);

console.log(JSON.stringify({
  profile: profileName,
  status: result.passed ? "passed" : "failed",
  fixtureCount: result.fixtureCount,
  generatedCandidateCount: result.generatedCandidateCount,
  mismatchCount: result.mismatchCount,
  firstMismatch: result.firstMismatch,
  fixtureSetupMs: result.fixtureSetupMs,
  rustWasmElapsedMs: result.rustWasmElapsedMs,
  candidateEvaluationsPerSecond: result.candidateEvaluationsPerSecond,
  elapsedMs: result.elapsedMs,
}, null, 2));

if (!result.passed) {
  process.exit(1);
}

function parseProfileName(args: string[]): DifferentialProfileName {
  const rawProfile = getOptionValue(args, "--profile") ?? "ci";
  if (rawProfile === "ci" || rawProfile === "soak") {
    return rawProfile;
  }

  throw new Error(`Unknown differential profile '${rawProfile}'. Expected 'ci' or 'soak'.`);
}

function parseDifferentialOptions(
  args: string[],
  profile: RustWasmDifferentialFixtureOptions,
): RustWasmDifferentialFixtureOptions {
  const candidateBatchCount = parsePositiveIntegerOption(args, "--candidate-batches");
  const candidatesPerBatch = parsePositiveIntegerOption(args, "--candidates-per-batch");
  const seedPrefix = getOptionValue(args, "--seed-prefix") ?? "rust-wasm-differential-custom";

  return {
    candidateBatchSeeds: candidateBatchCount === undefined
      ? profile.candidateBatchSeeds
      : Array.from({ length: candidateBatchCount }, (_, index) => `${seedPrefix}:${index}`),
    candidatesPerBatch: candidatesPerBatch ?? profile.candidatesPerBatch,
  };
}

function parsePositiveIntegerOption(args: string[], name: string): number | undefined {
  const value = getOptionValue(args, name);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected ${name} to be a positive integer, got '${value}'.`);
  }

  return parsed;
}

function getOptionValue(args: string[], name: string): string | undefined {
  const assignmentPrefix = `${name}=`;
  const assigned = args.find((arg) => arg.startsWith(assignmentPrefix));
  if (assigned) {
    return assigned.slice(assignmentPrefix.length);
  }

  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}
