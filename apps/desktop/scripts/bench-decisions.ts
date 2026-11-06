#!/usr/bin/env -S node --import tsx

import { readFile } from "node:fs/promises";
import { submitDecision } from "../src/modules/automation/decisions/decisionClient.ts";
import {
  listDecisionModels,
  supportsQuestionType,
} from "../src/modules/automation/decisions/decisionModels.ts";
import type { DecisionModelDescriptor } from "../src/modules/automation/decisions/decisionModels.ts";
import { DecisionClientError } from "../src/modules/automation/decisions/decisionTypes.ts";
import { capabilityProblems } from "../src/modules/automation/decisions/decisionWire.ts";
import { IMAGE_TOKEN_CALIBRATION } from "../src/modules/automation/decisions/imageCalibration.ts";
import type { ImageTokenCalibration } from "../src/modules/automation/decisions/imageCalibration.ts";
import type { ScreenImage } from "../src/modules/automation/decisions/screenImage.ts";
import { buildJevRequestBody } from "../src/modules/automation/policies/jev.ts";
import type { RemotePolicyInput } from "../src/modules/automation/policies/types.ts";
import { redactObservation } from "../src/modules/automation/redact.ts";
import { buildCandidates } from "../src/modules/automation/elementIndex.ts";
import type { DecisionOperation, StepRecord } from "../src/types/automation.types.ts";
import { calibrateModel, writeCalibrationModule } from "./bench-decisions/calibrate.ts";
import { TEXT_CASES, VISUAL_CASES } from "./bench-decisions/cases.ts";
import type { DecisionCase } from "./bench-decisions/cases.ts";
import { createFetchTransport } from "./bench-decisions/fetchTransport.ts";
import { gradeAnswers, percentile } from "./bench-decisions/score.ts";

/** Never more than this many live calls in one run, whatever the flags say. */
const HARD_REQUEST_CEILING = 53;
const DEFAULT_MAX_REQUESTS = 48;
const CALIBRATION_CALLS_PER_MODEL = 3;

const ENV_FILE = new URL("../.env.local", import.meta.url);
const FIXTURES = new URL("./bench-decisions/fixtures/", import.meta.url);
const CALIBRATION_MODULE = new URL(
  "../src/modules/automation/decisions/imageCalibration.ts",
  import.meta.url,
);

interface Options {
  dryRun: boolean;
  calibrate: boolean;
  models: string[] | null;
  maxRequests: number;
}

interface ModelTally {
  model: DecisionModelDescriptor;
  correct: number;
  graded: number;
  latencies: number[];
  costs: number[];
  failures: string[];
}

function parseOptions(argv: readonly string[]): Options {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const requested = Number(value("--max-requests") ?? DEFAULT_MAX_REQUESTS);
  return {
    dryRun: argv.includes("--dry-run"),
    calibrate: argv.includes("--calibrate"),
    models:
      value("--models")
        ?.split(",")
        .map((entry) => entry.trim()) ?? null,
    maxRequests: Math.min(
      HARD_REQUEST_CEILING,
      Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_MAX_REQUESTS,
    ),
  };
}

/** Reads the endpoint and key from .env.local. Values stay in memory and are never printed. */
async function readCredentials(): Promise<{ endpoint: string; apiKey: string }> {
  const text = await readFile(ENV_FILE, "utf8");
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      values.set(match[1], match[2].replace(/^["']|["']$/g, ""));
    }
  }
  const endpoint = values.get("CAPUBRIDGE_JEV_ENDPOINT") ?? "";
  const apiKey = values.get("CAPUBRIDGE_JEV_API_KEY") ?? "";
  if (endpoint === "" || apiKey === "") {
    throw new Error(
      "apps/desktop/.env.local needs CAPUBRIDGE_JEV_ENDPOINT and CAPUBRIDGE_JEV_API_KEY",
    );
  }
  return { endpoint, apiKey };
}

function history(operations: readonly string[]): StepRecord[] {
  return operations.map((operation, index) => ({
    stepId: `bench-${index}`,
    startedAt: index,
    endedAt: index,
    decision: {
      operation: operation as DecisionOperation,
      confidence: 1,
      reason: "synthetic history",
    },
    resolvedTarget: null,
    outcome: "ok",
    error: null,
    screenshotRef: "",
  }));
}

async function screenFor(entry: DecisionCase): Promise<ScreenImage | null> {
  if (entry.screen === null) {
    return null;
  }
  const base64 = (await readFile(new URL(entry.screen.fixture, FIXTURES))).toString("base64");
  return {
    image: {
      slot: "screen",
      format: "png",
      base64,
      width: entry.screen.width,
      height: entry.screen.height,
    },
    deviceWidth: entry.screen.width,
    deviceHeight: entry.screen.height,
  };
}

function inputFor(entry: DecisionCase): RemotePolicyInput {
  return {
    goal: entry.goal,
    observation: redactObservation(entry.observation),
    candidates: buildCandidates(entry.observation),
    history: history(entry.historyOperations),
    stepIndex: entry.historyOperations.length,
  };
}

function casesFor(
  model: DecisionModelDescriptor,
  calibration: Readonly<Record<string, ImageTokenCalibration>>,
): DecisionCase[] {
  const visual = supportsQuestionType(model, "box") && model.id in calibration;
  return visual ? [...TEXT_CASES, ...VISUAL_CASES] : [...TEXT_CASES];
}

function format(value: number | null, digits = 0): string {
  return value === null ? "-" : value.toFixed(digits);
}

function isAuthFailure(error: unknown): boolean {
  return error instanceof DecisionClientError && /jev-http-40[123]/.test(error.message);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const models = listDecisionModels().filter(
    (model) => !model.alias && (options.models === null || options.models.includes(model.id)),
  );
  const calibrating = options.calibrate
    ? models.filter((model) => model.images !== null && supportsQuestionType(model, "box"))
    : [];
  const plannedCalibration = calibrating.length * CALIBRATION_CALLS_PER_MODEL;
  const optimistic: Record<string, ImageTokenCalibration> = { ...IMAGE_TOKEN_CALIBRATION };
  for (const model of calibrating) {
    optimistic[model.id] ??= {
      textTokensPerChar: 0,
      imageTokensBase: 0,
      imageTokensPerMegapixel: 0,
      measuredOn: "planned",
    };
  }
  const plannedCases = models.reduce((sum, model) => sum + casesFor(model, optimistic).length, 0);
  const planned = plannedCalibration + plannedCases;
  console.log(
    `Plan: ${models.length} models, ${plannedCases} case calls, ${plannedCalibration} calibration calls, ${planned} total (cap ${options.maxRequests}).`,
  );
  if (planned > options.maxRequests) {
    console.error(
      "Plan exceeds the request cap. Narrow it with --models or raise --max-requests (hard ceiling 53).",
    );
    process.exitCode = 1;
    return;
  }

  if (options.dryRun) {
    for (const model of models) {
      for (const entry of casesFor(model, optimistic)) {
        const build = buildJevRequestBody(inputFor(entry), model.id, await screenFor(entry));
        const problems = capabilityProblems(model, build.request);
        const status = problems.length === 0 ? "ok" : problems.join(" ");
        console.log(
          `  ${model.id.padEnd(34)} ${entry.id.padEnd(24)} ${build.sent.length} candidates, ${Object.keys(build.request.questions).length} questions: ${status}`,
        );
      }
    }
    console.log("Dry run: nothing was sent.");
    return;
  }

  const { endpoint, apiKey } = await readCredentials();
  let lastLatency = 0;
  let sent = 0;
  const transport = createFetchTransport(endpoint, apiKey, (timing) => {
    lastLatency = timing.ms;
    sent += 1;
  });
  let spendUsd = 0;
  const calibration: Record<string, ImageTokenCalibration> = { ...IMAGE_TOKEN_CALIBRATION };

  for (const model of calibrating) {
    try {
      const outcome = await calibrateModel(model, transport, FIXTURES);
      spendUsd += outcome.spendUsd;
      if (outcome.ok) {
        calibration[model.id] = outcome.calibration;
        console.log(
          `Calibrated ${model.id}: ${outcome.calibration.imageTokensBase} + ${outcome.calibration.imageTokensPerMegapixel}/MP tokens per image (deltas ${outcome.deltas.join(", ")}).`,
        );
      } else {
        console.log(`Not calibrated ${model.id}: ${outcome.reason}.`);
      }
    } catch (error) {
      console.error(
        `Calibration of ${model.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (isAuthFailure(error) || /jev-http-40[123]/.test(String(error))) {
        console.error("The API key was rejected; stopping before any further call.");
        process.exitCode = 1;
        return;
      }
    }
  }
  if (calibrating.length > 0) {
    await writeCalibrationModule(CALIBRATION_MODULE, calibration);
  }

  const tallies: ModelTally[] = [];
  for (const model of models) {
    const tally: ModelTally = {
      model,
      correct: 0,
      graded: 0,
      latencies: [],
      costs: [],
      failures: [],
    };
    tallies.push(tally);
    for (const entry of casesFor(model, calibration)) {
      if (sent + 1 >= options.maxRequests) {
        tally.failures.push(`${entry.id}: skipped, request cap reached`);
        continue;
      }
      const build = buildJevRequestBody(inputFor(entry), model.id, await screenFor(entry));
      try {
        const result = await submitDecision(model.id, build.request, { transport, calibration });
        tally.latencies.push(lastLatency);
        tally.costs.push(result.usage?.costUsd ?? 0);
        spendUsd += result.usage?.costUsd ?? 0;
        const grades = gradeAnswers(entry.expect, result.answers, build.sent);
        tally.graded += grades.length;
        tally.correct += grades.filter((grade) => grade.correct).length;
        const missed = grades.filter((grade) => !grade.correct).map((grade) => grade.question);
        if (missed.length > 0) {
          tally.failures.push(`${entry.id}: wrong ${missed.join(", ")}`);
        }
      } catch (error) {
        tally.graded += Object.keys(entry.expect).length;
        tally.failures.push(
          `${entry.id}: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`,
        );
        if (isAuthFailure(error)) {
          console.error(
            `The API key was rejected (${error instanceof Error ? error.message.slice(0, 120) : ""}); stopping.`,
          );
          process.exitCode = 1;
          report(tallies, sent, spendUsd);
          return;
        }
      }
    }
  }
  report(tallies, sent, spendUsd);
}

function report(tallies: readonly ModelTally[], sent: number, spendUsd: number): void {
  console.log("");
  console.log("| model | accuracy | p50 ms | p95 ms | cost per call (USD) |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const tally of tallies) {
    const accuracy = tally.graded === 0 ? "-" : `${tally.correct}/${tally.graded}`;
    const meanCost =
      tally.costs.length === 0
        ? null
        : tally.costs.reduce((sum, cost) => sum + cost, 0) / tally.costs.length;
    console.log(
      `| ${tally.model.id} | ${accuracy} | ${format(percentile(tally.latencies, 0.5))} | ${format(percentile(tally.latencies, 0.95))} | ${format(meanCost, 8)} |`,
    );
  }
  for (const tally of tallies) {
    for (const failure of tally.failures) {
      console.log(`  ${tally.model.id}: ${failure}`);
    }
  }
  console.log(`\nRequests sent: ${sent}. Spend: $${spendUsd.toFixed(8)}.`);
}

await main();
