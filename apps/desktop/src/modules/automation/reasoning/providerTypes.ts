export type ReasoningProviderId = "openrouter" | "openai" | "anthropic" | "test";

export interface ReasoningModelCapabilities {
  tools: boolean;
  vision: boolean;
  structuredOutput: boolean;
  streaming: boolean;
}

export interface ReasoningModelCost {
  inputPerMillionUsd: number | null;
  outputPerMillionUsd: number | null;
}

export interface ReasoningModelDescriptor {
  id: string;
  provider: ReasoningProviderId;
  label: string;
  contextWindowTokens: number | null;
  capabilities: ReasoningModelCapabilities;
  cost: ReasoningModelCost;
  /**
   * True when the provider picks the downstream model per request, so the
   * recipient of the prompt is not knowable in advance. Carried on the
   * descriptor rather than matched by id, so a future auto-router cannot ship
   * without the warning that goes with it.
   */
  autoRouted: boolean;
}

export interface ReasoningProviderSelection {
  provider: ReasoningProviderId;
  modelId: string;
}

export type ReasoningFailureKind =
  | "not-configured"
  | "unauthorized"
  | "quota"
  | "timeout"
  | "cancelled"
  | "transport"
  | "malformed";

export class ReasoningProviderError extends Error {
  readonly kind: ReasoningFailureKind;
  readonly resumable: boolean;

  constructor(kind: ReasoningFailureKind, message: string, resumable: boolean) {
    super(message);
    this.name = "ReasoningProviderError";
    this.kind = kind;
    this.resumable = resumable;
  }
}
