import type { JsonValue } from "@/runtime/ipc/contracts/common";
import { IMAGE_TOKEN_CALIBRATION } from "./imageCalibration";
import type { ImageTokenCalibration } from "./imageCalibration";
import type { DecisionModelDescriptor } from "./decisionModels";
import { DecisionClientError } from "./decisionTypes";
import type { DecisionImage, DecisionUsage } from "./decisionTypes";

/**
 * Share of the measured image cost the usage must show. Below this the image
 * was not read: on 2026-10-15 a gateway answered 200 while dropping Jev images,
 * and the only trace was input tokens that barely moved.
 */
export const IMAGE_GUARD_RATIO = 0.5;

/** The calibration a model's image delivery is checked against, or null. */
export function imageCalibrationFor(
  model: DecisionModelDescriptor,
  table: Readonly<Record<string, ImageTokenCalibration>> = IMAGE_TOKEN_CALIBRATION,
): ImageTokenCalibration | null {
  return table[model.id] ?? null;
}

/** Characters of everything in the body but the image bytes, the base of the text share. */
export function wireTextChars(body: Record<string, JsonValue>): number {
  const text = Object.fromEntries(Object.entries(body).filter(([key]) => key !== "assets"));
  return JSON.stringify(text).length;
}

/** Input tokens the images should cost, from the measured per-model rate. */
export function expectedImageTokens(
  calibration: ImageTokenCalibration,
  images: readonly DecisionImage[],
): number {
  return images.reduce(
    (sum, image) =>
      sum +
      calibration.imageTokensBase +
      (calibration.imageTokensPerMegapixel * image.width * image.height) / 1_000_000,
    0,
  );
}

/**
 * Fails closed unless the usage proves the images were read: input tokens
 * minus the measured text share must reach the guard ratio of the expected
 * image cost. A response without usage cannot prove anything and fails too.
 */
export function verifyImageDelivery(
  model: DecisionModelDescriptor,
  body: Record<string, JsonValue>,
  images: readonly DecisionImage[],
  usage: DecisionUsage | null,
  calibration: ImageTokenCalibration | null = imageCalibrationFor(model),
): void {
  if (images.length === 0) {
    return;
  }
  if (calibration === null) {
    throw new DecisionClientError(
      "unverified",
      `${model.label} has no measured image token cost, so image delivery cannot be checked.`,
    );
  }
  if (usage === null) {
    throw new DecisionClientError(
      "unverified",
      `${model.label} answered without usage, so the image may not have been read. Nothing was acted on.`,
    );
  }
  const textShare = wireTextChars(body) * calibration.textTokensPerChar;
  const imageShare = usage.inputTokens - textShare;
  const expected = expectedImageTokens(calibration, images);
  if (imageShare < expected * IMAGE_GUARD_RATIO) {
    throw new DecisionClientError(
      "unverified",
      `${model.label} billed ${usage.inputTokens} input tokens; the image alone should cost about ${Math.round(expected)}. ` +
        "The gateway likely dropped the image, so the answer was discarded and nothing was acted on.",
    );
  }
}
