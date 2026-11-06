import { readFile, writeFile } from "node:fs/promises";
import type { DecisionTransport } from "../../src/modules/automation/decisions/decisionClient.ts";
import type { DecisionModelDescriptor } from "../../src/modules/automation/decisions/decisionModels.ts";
import type { DecisionRequest } from "../../src/modules/automation/decisions/decisionTypes.ts";
import { parseUsage, toWireRequest } from "../../src/modules/automation/decisions/decisionWire.ts";
import type { ImageTokenCalibration } from "../../src/modules/automation/decisions/imageCalibration.ts";
import { wireTextChars } from "../../src/modules/automation/decisions/imageGuard.ts";
import { CALIBRATION_IMAGES } from "./cases.ts";

/** Below this many tokens per image the gateway did not read it, and nothing is written. */
const MIN_IMAGE_DELTA = 50;

/** The outcome of calibrating one model: a measured cost, or why none could be measured. */
export type CalibrationOutcome =
  | { ok: true; calibration: ImageTokenCalibration; deltas: number[]; spendUsd: number }
  | { ok: false; reason: string; spendUsd: number };

function baseRequest(): DecisionRequest {
  return {
    state: { goal: "allow notifications", note: "calibration probe with synthetic content" },
    questions: {
      allow_visible: {
        type: "noul",
        instructions: "Is a button labelled Allow visible in the image `screen`?",
      },
    },
    images: [],
  };
}

/**
 * Measures one model's image token cost from three calls: a text twin, then
 * the same request with one synthetic screen at two sizes. The text twin gives
 * tokens per character; the two sizes separate the per-image base from the
 * per-megapixel rate. A delta near zero means the image was dropped, and the
 * model is left uncalibrated rather than trusted.
 */
export async function calibrateModel(
  model: DecisionModelDescriptor,
  transport: DecisionTransport,
  fixtureDir: URL,
): Promise<CalibrationOutcome> {
  let spendUsd = 0;
  const twin = toWireRequest(model, baseRequest());
  const twinUsage = parseUsage(await transport.send(twin));
  spendUsd += twinUsage?.costUsd ?? 0;
  if (twinUsage === null || twinUsage.inputTokens <= 0) {
    return { ok: false, reason: "the text twin returned no usage", spendUsd };
  }
  const textTokensPerChar = twinUsage.inputTokens / wireTextChars(twin.body);
  const points: { megapixels: number; delta: number }[] = [];
  for (const shot of CALIBRATION_IMAGES) {
    const base64 = (await readFile(new URL(shot.fixture, fixtureDir))).toString("base64");
    const request: DecisionRequest = {
      ...baseRequest(),
      images: [{ slot: "screen", format: "png", base64, width: shot.width, height: shot.height }],
    };
    const wire = toWireRequest(model, request);
    const usage = parseUsage(await transport.send(wire));
    spendUsd += usage?.costUsd ?? 0;
    if (usage === null) {
      return { ok: false, reason: "an image call returned no usage", spendUsd };
    }
    points.push({
      megapixels: (shot.width * shot.height) / 1_000_000,
      delta: usage.inputTokens - wireTextChars(wire.body) * textTokensPerChar,
    });
  }
  const deltas = points.map((point) => Math.round(point.delta));
  if (points.some((point) => point.delta < MIN_IMAGE_DELTA)) {
    return {
      ok: false,
      reason: `input tokens barely moved with an image (deltas ${deltas.join(", ")}): images look dropped`,
      spendUsd,
    };
  }
  const [large, small] = points;
  if (large === undefined || small === undefined) {
    return { ok: false, reason: "calibration needs two image sizes", spendUsd };
  }
  const perMegapixel = Math.max(
    0,
    (large.delta - small.delta) / (large.megapixels - small.megapixels),
  );
  const base = Math.max(0, small.delta - perMegapixel * small.megapixels);
  return {
    ok: true,
    deltas,
    spendUsd,
    calibration: {
      textTokensPerChar: round(textTokensPerChar, 4),
      imageTokensBase: Math.round(base),
      imageTokensPerMegapixel: Math.round(perMegapixel),
      measuredOn: new Date().toISOString().slice(0, 10),
    },
  };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/** Rewrites the calibration module with the merged entries, keeping its JSDoc contract. */
export async function writeCalibrationModule(
  target: URL,
  entries: Readonly<Record<string, ImageTokenCalibration>>,
): Promise<void> {
  const body = Object.entries(entries)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(
      ([id, entry]) =>
        `  ${JSON.stringify(id)}: {\n` +
        `    textTokensPerChar: ${entry.textTokensPerChar},\n` +
        `    imageTokensBase: ${entry.imageTokensBase},\n` +
        `    imageTokensPerMegapixel: ${entry.imageTokensPerMegapixel},\n` +
        `    measuredOn: ${JSON.stringify(entry.measuredOn)},\n` +
        "  },\n",
    )
    .join("");
  const source = `/**
 * Measured input-token costs, per model, written by
 * \`vp run desktop#bench:decisions -- --calibrate\`. Only our own measurements
 * belong here: a model without an entry never receives an image, because its
 * delivery could not be verified.
 */
export interface ImageTokenCalibration {
  textTokensPerChar: number;
  imageTokensBase: number;
  imageTokensPerMegapixel: number;
  measuredOn: string;
}

export const IMAGE_TOKEN_CALIBRATION: Readonly<Record<string, ImageTokenCalibration>> = {${body === "" ? "" : `\n${body}`}};
`;
  await writeFile(target, source, "utf8");
}
