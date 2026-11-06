import type { TargetRef } from "@/types/automation.types";
import { supportsQuestionType } from "../decisions/decisionModels";
import type { DecisionModelDescriptor } from "../decisions/decisionModels";
import type { DecisionAnswer, DecisionQuestion } from "../decisions/decisionTypes";
import { imageCalibrationFor } from "../decisions/imageGuard";
import type { ImageTokenCalibration } from "../decisions/imageCalibration";
import type { ScreenEncoder, ScreenImage } from "../decisions/screenImage";
import type { RedactedObservation } from "../redact";
import type { RemotePolicyInput } from "./types";

/** Presence a visual target must reach before its box becomes a tap. */
export const VISUAL_PRESENCE_THRESHOLD = 0.8;

/** The state slot and question names of the visual path. */
export const SCREEN_SLOT = "screen";
export const VISUAL_PRESENT_QUESTION = "visual_target_present";
export const VISUAL_BOX_QUESTION = "visual_target_box";

/** Whether the visual path runs this step, and why not when it does not. */
export type VisualPlan =
  | { kind: "on"; screen: ScreenImage }
  | { kind: "off"; reason: string | null };

/** A screen with no DOM: a native view or a system dialog the web layer cannot see. */
export function hasNoDom(observation: RedactedObservation): boolean {
  return observation.webview === null || observation.webview.elements.length === 0;
}

/**
 * Decides whether this step sends the screen. Only screens with no DOM do,
 * only to a model that answers box questions about images, and only when the
 * model's image cost has been measured so delivery can be verified. A capture
 * or encode failure turns the path off for the step with its reason recorded;
 * the text path still runs.
 */
export async function planVisual(
  model: DecisionModelDescriptor,
  input: RemotePolicyInput,
  encode: ScreenEncoder,
  calibration: Readonly<Record<string, ImageTokenCalibration>> | undefined,
): Promise<VisualPlan> {
  if (!hasNoDom(input.observation) || input.readScreen === undefined) {
    return { kind: "off", reason: null };
  }
  if (model.images === null || !supportsQuestionType(model, "box")) {
    return { kind: "off", reason: `${model.label} cannot locate targets in images` };
  }
  if (imageCalibrationFor(model, calibration) === null) {
    return { kind: "off", reason: `${model.label} image cost not measured yet` };
  }
  try {
    const png = await input.readScreen();
    if (png === "") {
      return { kind: "off", reason: "no screenshot was captured" };
    }
    return { kind: "on", screen: await encode(png, model.images, SCREEN_SLOT) };
  } catch (error) {
    return {
      kind: "off",
      reason: `screenshot unusable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * The presence question gates the box: a box question always answers a box,
 * even when the target is absent, so the box alone is never evidence.
 */
export function visualQuestions(): Record<string, DecisionQuestion> {
  return {
    [VISUAL_PRESENT_QUESTION]: {
      type: "noul",
      instructions: `Is the element that must be pressed next to advance the goal visible in the image \`${SCREEN_SLOT}\`?`,
      criteria: {
        true: "The element to press next is fully visible in the image",
        false: "No visible element in the image advances the goal",
      },
    },
    [VISUAL_BOX_QUESTION]: {
      type: "box",
      instructions: `In the image \`${SCREEN_SLOT}\`, locate the single element that must be pressed next to advance the goal.`,
    },
  };
}

/** A visual target, or the plain reason it cannot be acted on. */
export type VisualTarget =
  | { ok: true; target: TargetRef; presence: number; boxConfidence: number | null }
  | { ok: false; reason: string };

/**
 * Turns the presence and box answers into a device point at the box centre.
 * Below the presence threshold, or without both answers, nothing is tapped.
 */
export function visualTarget(
  answers: Record<string, DecisionAnswer>,
  screen: ScreenImage,
): VisualTarget {
  const presence = answers[VISUAL_PRESENT_QUESTION];
  const box = answers[VISUAL_BOX_QUESTION];
  if (presence === undefined || presence.type !== "noul") {
    return { ok: false, reason: "no visual presence answer" };
  }
  if (presence.noul < VISUAL_PRESENCE_THRESHOLD) {
    return {
      ok: false,
      reason: `visual target presence ${round(presence.noul)} is below ${VISUAL_PRESENCE_THRESHOLD}`,
    };
  }
  if (box === undefined || box.type !== "box") {
    return { ok: false, reason: "no visual box answer" };
  }
  const x = Math.round(((box.box.left + box.box.right) / 2) * screen.deviceWidth);
  const y = Math.round(((box.box.top + box.box.bottom) / 2) * screen.deviceHeight);
  return {
    ok: true,
    target: { kind: "point", x, y },
    presence: round(presence.noul),
    boxConfidence: box.confidence,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
