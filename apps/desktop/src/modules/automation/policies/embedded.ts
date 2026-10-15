import { buildCandidates } from "../elementIndex";
import { completeReasoningProvider } from "../reasoning/providerCompletion";
import { defaultReasoningSelection, resolveReasoningModel } from "../reasoning/providerRegistry";
import type { ReasoningPromptMessage } from "../reasoning/providerCompletion";
import type { ReasoningProviderSelection } from "../reasoning/providerTypes";
import type { ReasoningStreamRecord } from "../reasoning/streamEvents";
import type { Decision, DecisionOperation, TargetRef } from "@/types/automation.types";
import { PolicyDecisionError, registerPolicy } from "./types";
import type { RemotePolicy, RemotePolicyInput } from "./types";

export const EMBEDDED_DATA_NOTICE =
  "Embedded reasoning sends the redacted screen structure to the selected API provider. Screenshots and API keys stay on this device.";

/**
 * Added to the notice when the selected model is an auto-router. The
 * recipient is then chosen per request and can differ between two runs of the
 * same flow, which is a materially weaker position than a named vendor and
 * must be stated rather than implied by "the selected API provider".
 */
export const EMBEDDED_AUTO_ROUTED_NOTICE =
  "This model routes to a provider chosen per request, so the recipient is not known in advance and may differ between runs.";

/**
 * Builds the notice for one selection. Derived from the model descriptor, so
 * a future auto-router inherits the warning without anyone remembering to add
 * it, and an unknown model degrades to the base notice rather than throwing —
 * a missing descriptor must not silence the consent text.
 */
export function embeddedDataNotice(selection: ReasoningProviderSelection): string {
  try {
    const model = resolveReasoningModel(selection);
    return model.autoRouted
      ? `${EMBEDDED_DATA_NOTICE} ${EMBEDDED_AUTO_ROUTED_NOTICE}`
      : `${EMBEDDED_DATA_NOTICE} Requests go to ${model.label}.`;
  } catch {
    return EMBEDDED_DATA_NOTICE;
  }
}

const OPERATIONS: readonly DecisionOperation[] = [
  "tap",
  "longPress",
  "type",
  "pressKey",
  "back",
  "wait",
  "done",
  "blocked",
];

export interface EmbeddedReasoningTransport {
  complete(
    selection: ReasoningProviderSelection,
    messages: ReasoningPromptMessage[],
  ): Promise<{ text: string }>;
}

export interface EmbeddedReasoningPolicyOptions {
  selection?: ReasoningProviderSelection;
  transport?: EmbeddedReasoningTransport;
  onActivity?: (record: ReasoningStreamRecord) => void;
}

export function createEmbeddedReasoningPolicy(
  options: EmbeddedReasoningPolicyOptions = {},
): RemotePolicy {
  const selection = options.selection ?? defaultReasoningSelection();
  const transport = options.transport ?? { complete: completeReasoningProvider };
  return {
    id: "embedded",
    label: "Embedded reasoning",
    isRemote: true,
    dataNotice: embeddedDataNotice(selection),
    decide: async (input) => {
      options.onActivity?.({
        provider: selection.provider,
        modelId: selection.modelId,
        phase: "started",
        detail: null,
      });
      const candidates = buildCandidates({
        native: input.observation.native,
        webview: input.observation.webview,
      });
      try {
        const response = await transport.complete(selection, [
          { role: "system", content: "Choose one bounded Android UI action. Return JSON only." },
          { role: "user", content: JSON.stringify(promptForDecision(input, candidates)) },
        ]);
        options.onActivity?.({
          provider: selection.provider,
          modelId: selection.modelId,
          phase: "text",
          detail: response.text,
        });
        return parseDecision(response.text, candidates);
      } catch (error) {
        if (error instanceof PolicyDecisionError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : "provider transport failed";
        options.onActivity?.({
          provider: selection.provider,
          modelId: selection.modelId,
          phase: "failed",
          detail: message,
        });
        throw new PolicyDecisionError(
          message.includes("timeout") ? "timeout" : "transport",
          message,
        );
      }
    },
  };
}

function promptForDecision(
  input: RemotePolicyInput,
  candidates: ReturnType<typeof buildCandidates>,
) {
  return {
    goal: input.goal,
    stepIndex: input.stepIndex,
    operations: OPERATIONS,
    candidates: candidates.map((candidate) => ({
      index: candidate.index,
      label: candidate.label,
      clickable: candidate.clickable,
      input: candidate.isInput,
    })),
    response: {
      operation: "one allowed operation",
      targetIndex: "required for tap, longPress and type",
      text: "required for type",
      reason: "short explanation",
      confidence: "0 to 1",
    },
  };
}

function parseDecision(text: string, candidates: ReturnType<typeof buildCandidates>): Decision {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new PolicyDecisionError("malformed", "embedded provider did not return JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PolicyDecisionError("malformed", "embedded provider returned an invalid decision");
  }
  const record = value as Record<string, unknown>;
  const operation = record["operation"];
  const confidence = record["confidence"];
  if (
    typeof operation !== "string" ||
    !OPERATIONS.includes(operation as DecisionOperation) ||
    typeof confidence !== "number" ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new PolicyDecisionError("malformed", "embedded provider returned an invalid operation");
  }
  const reason =
    typeof record["reason"] === "string" ? record["reason"] : "embedded reasoning decision";
  if (["tap", "longPress", "type"].includes(operation)) {
    const candidate = candidates.find((entry) => entry.index === record["targetIndex"]);
    if (candidate === undefined) {
      throw new PolicyDecisionError(
        "rejected-target",
        "embedded provider selected a target outside the current screen",
      );
    }
    const target = candidateTarget(candidate);
    if (operation === "type") {
      if (typeof record["text"] !== "string" || record["text"].trim() === "") {
        throw new PolicyDecisionError(
          "malformed",
          "embedded provider omitted text for a type action",
        );
      }
      return { operation, target, text: record["text"], confidence, reason };
    }
    return { operation: operation as DecisionOperation, target, confidence, reason };
  }
  return { operation: operation as DecisionOperation, confidence, reason };
}

function candidateTarget(candidate: ReturnType<typeof buildCandidates>[number]): TargetRef {
  if (candidate.cssSelector !== null)
    return { kind: "selector", cssSelector: candidate.cssSelector };
  if (candidate.source === "native" && candidate.nativeIndex !== null)
    return { kind: "nativeIndex", index: candidate.nativeIndex };
  if (candidate.text !== null) return { kind: "text", text: candidate.text, exact: true };
  return { kind: "point", x: candidate.center.x, y: candidate.center.y };
}

registerPolicy("embedded", (options?: unknown) =>
  createEmbeddedReasoningPolicy(options as EmbeddedReasoningPolicyOptions),
);
