import { maxContextTokens, supportsQuestionType } from "./decisionModels";
import type { DecisionModelDescriptor } from "./decisionModels";
import { IMAGE_TOKEN_CALIBRATION } from "./imageCalibration";
import type { ImageTokenCalibration } from "./imageCalibration";

/** One line of what a model can do, for the option list. */
export function describeCapabilities(model: DecisionModelDescriptor): string {
  const parts: string[] = [];
  if (model.images !== null && supportsQuestionType(model, "box")) {
    parts.push("finds targets in screenshots");
  } else if (model.images !== null) {
    parts.push(`reads up to ${model.images.maxPerRequest} images, no box`);
  } else {
    parts.push("text only");
  }
  parts.push(`${formatTokens(maxContextTokens(model))} context`);
  parts.push(`$${model.inputUsdPerMillion}/M input`);
  return parts.join(" · ");
}

/** Whether runs on this model can send a screenshot, which the setting must say plainly. */
export function sendsScreenshots(
  model: DecisionModelDescriptor,
  calibration: Readonly<Record<string, ImageTokenCalibration>> = IMAGE_TOKEN_CALIBRATION,
): boolean {
  return model.images !== null && supportsQuestionType(model, "box") && model.id in calibration;
}

/**
 * Why a box-capable model is not using screenshots yet, or null. Without a
 * measured image cost the image guard cannot verify delivery, so the visual
 * path stays off rather than trusting the gateway.
 */
export function visualPathBlocker(
  model: DecisionModelDescriptor,
  calibration: Readonly<Record<string, ImageTokenCalibration>> = IMAGE_TOKEN_CALIBRATION,
): string | null {
  if (model.images === null || !supportsQuestionType(model, "box")) {
    return null;
  }
  return model.id in calibration
    ? null
    : "Screenshot targeting stays off until this model's image cost is measured.";
}

function formatTokens(tokens: number): string {
  return tokens >= 1_000_000
    ? `${Math.round(tokens / 100_000) / 10}M`
    : `${Math.round(tokens / 1_000)}k`;
}
