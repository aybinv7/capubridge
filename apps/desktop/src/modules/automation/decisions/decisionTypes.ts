import type { JsonValue } from "@/runtime/ipc/contracts/common";
import type { DecisionImageFormat } from "./decisionModels";

/** A yes/no question answered with a probability. */
export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
}

/** Pick one option from a map of option to description. */
export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

/** Locate one target in a named image. Always answers a box, never "not found". */
export interface BoxQuestion {
  type: "box";
  instructions: string;
}

export type DecisionQuestion = NoulQuestion | ChoiceQuestion | BoxQuestion;

/**
 * One image the request carries. `slot` is the name questions use to point at
 * it ("the image `screen`"); the wire key is derived, so a caller can never
 * collide with ordinary state text.
 */
export interface DecisionImage {
  slot: string;
  format: DecisionImageFormat;
  base64: string;
  width: number;
  height: number;
}

/** A provider-agnostic decisions request, before it is shaped for one model. */
export interface DecisionRequest {
  state: Record<string, JsonValue>;
  questions: Record<string, DecisionQuestion>;
  images: DecisionImage[];
}

/** Opt-in TypeSafe features, mapped to `TypeSafe-Danger-Zone-*` headers by the transport. */
export type DangerZoneFeature = "images" | "long-context";

/** The exact body and opt-in features one model receives. */
export interface DecisionWireRequest {
  body: Record<string, JsonValue>;
  typesafeModel: string | null;
  dangerZone: DangerZoneFeature[];
  estimatedTextTokens: number;
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number | null;
  probabilities: Record<string, number>;
}

/** Edges as fractions of the image, measured from its top-left corner. */
export interface BoxEdges {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface BoxAnswer {
  type: "box";
  box: BoxEdges;
  confidence: number | null;
}

export interface RefusalAnswer {
  type: "refusal";
}

export type DecisionAnswer = NoulAnswer | ChoiceAnswer | BoxAnswer | RefusalAnswer;

export interface DecisionUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

/** A parsed response: the answers plus who served it and what it cost. */
export interface DecisionResult {
  modelId: string;
  servedModel: string | null;
  answers: Record<string, DecisionAnswer>;
  usage: DecisionUsage | null;
  fallbackFrom: string | null;
  raw: JsonValue;
}

/**
 * Why a decisions call failed. `unsupported` is raised before anything is
 * sent; `unverified` means the call answered but its delivery could not be
 * proven (an image the model never read, or a different model serving).
 */
export type DecisionFailureKind =
  | "unsupported"
  | "unverified"
  | "unavailable"
  | "malformed"
  | "timeout"
  | "transport";

export class DecisionClientError extends Error {
  readonly kind: DecisionFailureKind;

  constructor(kind: DecisionFailureKind, message: string) {
    super(message);
    this.name = "DecisionClientError";
    this.kind = kind;
  }
}
