import { ReasoningProviderError } from "./providerTypes";
import type { ReasoningFailureKind } from "./providerTypes";

export function classifyReasoningProviderFailure(error: unknown): ReasoningProviderError {
  if (error instanceof ReasoningProviderError) {
    return error;
  }
  if (isAbort(error)) {
    return new ReasoningProviderError("cancelled", "Reasoning request cancelled", true);
  }
  const message = messageOf(error);
  const classification = classifyMessage(message);
  return new ReasoningProviderError(
    classification.kind,
    classification.message,
    classification.resumable,
  );
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function classifyMessage(message: string): {
  kind: ReasoningFailureKind;
  message: string;
  resumable: boolean;
} {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("401")
  ) {
    return {
      kind: "unauthorized",
      message: "Provider credentials were rejected",
      resumable: false,
    };
  }
  if (
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("429")
  ) {
    return { kind: "quota", message: "Provider quota or rate limit reached", resumable: true };
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return { kind: "timeout", message: "Provider request timed out", resumable: true };
  }
  if (
    normalized.includes("json") ||
    normalized.includes("schema") ||
    normalized.includes("malformed")
  ) {
    return { kind: "malformed", message: "Provider returned an invalid response", resumable: true };
  }
  return { kind: "transport", message: "Provider request failed", resumable: true };
}
