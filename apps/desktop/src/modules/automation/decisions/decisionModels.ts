/** Question types the shared decisions envelope declares. */
export type DecisionQuestionType = "noul" | "choice" | "score" | "box";

/** Image formats a decisions request may carry. */
export type DecisionImageFormat = "png" | "jpeg";

/**
 * Where an image reference may sit in `state`. Jev reads a reference nested in
 * an object; every other provider reads only a whole string at the top level
 * of a `state` array and answers 400 to anything else.
 */
export type DecisionImagePlacement = "nested" | "top-level";

/** What one model accepts as image input. */
export interface DecisionImageSupport {
  maxPerRequest: number;
  minSide: number | null;
  maxSide: number | null;
  maxPixels: number | null;
  formats: readonly DecisionImageFormat[];
  placement: DecisionImagePlacement;
}

/**
 * One decision model and what it can serve. `id` is the OpenRouter slug and
 * the stable key a setting stores; `typesafeId` is the name TypeSafe's direct
 * API uses, or null when TypeSafe does not serve the model.
 */
export interface DecisionModelDescriptor {
  id: string;
  openrouterSlug: string;
  typesafeId: string | null;
  label: string;
  vendor: string;
  questionTypes: readonly DecisionQuestionType[];
  images: DecisionImageSupport | null;
  contextTokens: number;
  longContextTokens: number | null;
  dangerZone: boolean;
  inputUsdPerMillion: number;
  alias: boolean;
}

const TEXT_QUESTIONS: readonly DecisionQuestionType[] = ["noul", "choice", "score"];
const JEV_BOX_QUESTIONS: readonly DecisionQuestionType[] = ["noul", "choice", "score", "box"];

const JEV_IMAGES: DecisionImageSupport = {
  maxPerRequest: 16,
  minSide: 256,
  maxSide: 1568,
  maxPixels: 2_458_624,
  formats: ["png", "jpeg"],
  placement: "nested",
};

function topLevelImages(maxPerRequest: number): DecisionImageSupport {
  return {
    maxPerRequest,
    minSide: null,
    maxSide: null,
    maxPixels: null,
    formats: ["png", "jpeg"],
    placement: "top-level",
  };
}

/**
 * Every decision model the policy may run on, as of 2026-11-06. Sources: the
 * OpenRouter decisions API reference, its multimodal decisions guide and the
 * public endpoint catalog. Jev 1.14 states no per-request image cap, so 16 is
 * our own bound, not a vendor figure. Clef silently drops text past roughly
 * 2,000 tokens, so its usable context is that, not its advertised window.
 */
const DECISION_MODELS: readonly DecisionModelDescriptor[] = [
  {
    id: "typesafe/jev-1.14",
    openrouterSlug: "typesafe/jev-1.14",
    typesafeId: "jev-1.14.0",
    label: "Jev 1.14",
    vendor: "TypeSafe",
    questionTypes: JEV_BOX_QUESTIONS,
    images: JEV_IMAGES,
    contextTokens: 64_000,
    longContextTokens: 262_144,
    dangerZone: true,
    inputUsdPerMillion: 0.042,
    alias: false,
  },
  {
    id: "typesafe/jev-1.13",
    openrouterSlug: "typesafe/jev-1.13-20260917",
    typesafeId: "jev-1.13",
    label: "Jev 1.13",
    vendor: "TypeSafe",
    questionTypes: TEXT_QUESTIONS,
    images: null,
    contextTokens: 64_000,
    longContextTokens: null,
    dangerZone: false,
    inputUsdPerMillion: 0.042,
    alias: false,
  },
  {
    id: "~typesafe/jev-latest",
    openrouterSlug: "~typesafe/jev-latest",
    typesafeId: "jev-latest",
    label: "Jev latest (moves with releases)",
    vendor: "TypeSafe",
    questionTypes: JEV_BOX_QUESTIONS,
    images: JEV_IMAGES,
    contextTokens: 64_000,
    longContextTokens: 262_144,
    dangerZone: true,
    inputUsdPerMillion: 0.042,
    alias: true,
  },
  {
    id: "openai/gpt-6-luna-decisions",
    openrouterSlug: "openai/gpt-6-luna-decisions",
    typesafeId: null,
    label: "GPT-6 Luna Decisions",
    vendor: "OpenAI",
    questionTypes: TEXT_QUESTIONS,
    images: topLevelImages(128),
    contextTokens: 1_050_000,
    longContextTokens: null,
    dangerZone: false,
    inputUsdPerMillion: 0.1,
    alias: false,
  },
  {
    id: "inception/mercury-decide",
    openrouterSlug: "inception/mercury-decide",
    typesafeId: null,
    label: "Mercury Decide",
    vendor: "Inception",
    questionTypes: TEXT_QUESTIONS,
    images: topLevelImages(16),
    contextTokens: 65_536,
    longContextTokens: null,
    dangerZone: false,
    inputUsdPerMillion: 0.02,
    alias: false,
  },
  {
    id: "liquid/d1",
    openrouterSlug: "liquid/d1",
    typesafeId: null,
    label: "Liquid d1",
    vendor: "Liquid",
    questionTypes: TEXT_QUESTIONS,
    images: topLevelImages(8),
    contextTokens: 65_536,
    longContextTokens: null,
    dangerZone: false,
    inputUsdPerMillion: 0.02,
    alias: false,
  },
  {
    id: "cloudflare/clef",
    openrouterSlug: "cloudflare/clef",
    typesafeId: null,
    label: "Clef",
    vendor: "Cloudflare",
    questionTypes: TEXT_QUESTIONS,
    images: topLevelImages(4),
    contextTokens: 2_000,
    longContextTokens: null,
    dangerZone: false,
    inputUsdPerMillion: 0.24,
    alias: false,
  },
  {
    id: "perplexity/pplx-decider-v1.2",
    openrouterSlug: "perplexity/pplx-decider-v1.2",
    typesafeId: null,
    label: "Perplexity Decider 1.2",
    vendor: "Perplexity",
    questionTypes: TEXT_QUESTIONS,
    images: null,
    contextTokens: 262_144,
    longContextTokens: null,
    dangerZone: false,
    inputUsdPerMillion: 0.02,
    alias: false,
  },
  {
    id: "microsoft/microsoft-decision-1",
    openrouterSlug: "microsoft/microsoft-decision-1",
    typesafeId: null,
    label: "Microsoft Decision-1",
    vendor: "Microsoft",
    questionTypes: TEXT_QUESTIONS,
    images: null,
    contextTokens: 32_768,
    longContextTokens: null,
    dangerZone: false,
    inputUsdPerMillion: 0.042,
    alias: false,
  },
];

/** The pinned default: a dated release, never an alias. */
export const DEFAULT_DECISION_MODEL_ID = "typesafe/jev-1.14";

/** Served instead of the pin only when the pin itself has no endpoint. */
export const FALLBACK_DECISION_MODEL_ID = "typesafe/jev-1.13";

/** Lists every model in the capability table. */
export function listDecisionModels(): readonly DecisionModelDescriptor[] {
  return DECISION_MODELS;
}

/** Finds a model by its stable id, or null. */
export function findDecisionModel(id: string): DecisionModelDescriptor | null {
  return DECISION_MODELS.find((model) => model.id === id) ?? null;
}

/** Finds a model that must exist: the default and fallback are table entries by construction. */
export function requireDecisionModel(id: string): DecisionModelDescriptor {
  const model = findDecisionModel(id);
  if (model === null) {
    throw new Error(`decision model "${id}" is not in the capability table`);
  }
  return model;
}

/** Whether the model can answer this question type. */
export function supportsQuestionType(
  model: DecisionModelDescriptor,
  type: DecisionQuestionType,
): boolean {
  return model.questionTypes.includes(type);
}

/** The largest context the model can be asked to read, with any opt-in header applied. */
export function maxContextTokens(model: DecisionModelDescriptor): number {
  return model.longContextTokens ?? model.contextTokens;
}
