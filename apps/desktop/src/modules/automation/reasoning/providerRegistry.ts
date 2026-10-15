import type {
  ReasoningModelDescriptor,
  ReasoningProviderId,
  ReasoningProviderSelection,
} from "./providerTypes";

const DEFAULT_CAPABILITIES = {
  tools: true,
  vision: true,
  structuredOutput: true,
  streaming: true,
} as const;

const DEFAULT_COST = {
  inputPerMillionUsd: null,
  outputPerMillionUsd: null,
} as const;

const MODELS: readonly ReasoningModelDescriptor[] = [
  {
    id: "openrouter/auto",
    provider: "openrouter",
    label: "OpenRouter Auto",
    contextWindowTokens: null,
    capabilities: DEFAULT_CAPABILITIES,
    cost: DEFAULT_COST,
    autoRouted: true,
  },
  {
    id: "gpt-5.4",
    provider: "openai",
    label: "OpenAI GPT-5.4",
    contextWindowTokens: null,
    capabilities: DEFAULT_CAPABILITIES,
    cost: DEFAULT_COST,
    autoRouted: false,
  },
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    label: "Claude Sonnet 4.6",
    contextWindowTokens: null,
    capabilities: DEFAULT_CAPABILITIES,
    cost: DEFAULT_COST,
    autoRouted: false,
  },
  {
    id: "contract-test",
    provider: "test",
    label: "Contract test provider",
    contextWindowTokens: 4_096,
    capabilities: {
      tools: true,
      vision: false,
      structuredOutput: true,
      streaming: true,
    },
    cost: {
      inputPerMillionUsd: 0,
      outputPerMillionUsd: 0,
    },
    autoRouted: false,
  },
];

export function listReasoningModels(): readonly ReasoningModelDescriptor[] {
  return MODELS;
}

export function listReasoningModelsForProvider(
  provider: ReasoningProviderId,
): readonly ReasoningModelDescriptor[] {
  return MODELS.filter((model) => model.provider === provider);
}

export function resolveReasoningModel(
  selection: ReasoningProviderSelection,
): ReasoningModelDescriptor {
  const model = MODELS.find(
    (candidate) => candidate.provider === selection.provider && candidate.id === selection.modelId,
  );
  if (model === undefined) {
    throw new Error(`Unknown ${selection.provider} reasoning model '${selection.modelId}'`);
  }
  return model;
}

/**
 * The default reasoning selection: the first named, non-test model.
 *
 * Derived rather than hardcoded, and deliberately never an auto-router. A
 * default that routes to whichever provider the gateway picks means the
 * recipient of the screen structure is unknowable before the run, which is a
 * consent problem rather than a configuration detail. Auto-routing stays
 * selectable; it is simply never the default.
 */
export function defaultReasoningSelection(): ReasoningProviderSelection {
  const named = MODELS.find((model) => !model.autoRouted && model.provider !== "test");
  if (named === undefined) {
    throw new Error("no named reasoning model is registered");
  }
  return { provider: named.provider, modelId: named.id };
}
