import { invokeCommand } from "@/runtime/ipc/client";
import { classifyReasoningProviderFailure } from "./providerFailure";
import { resolveReasoningModel } from "./providerRegistry";
import type { ReasoningProviderSelection } from "./providerTypes";

export interface ReasoningPromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ReasoningProviderResult {
  provider: string;
  model: string;
  text: string;
}

export async function completeReasoningProvider(
  selection: ReasoningProviderSelection,
  messages: ReasoningPromptMessage[],
): Promise<ReasoningProviderResult> {
  const model = resolveReasoningModel(selection);
  if (model.provider === "test") {
    throw classifyReasoningProviderFailure(new Error("provider-not-configured"));
  }
  try {
    return await invokeCommand("reasoning_provider_complete", {
      payload: {
        provider: model.provider,
        model: model.id,
        messages,
      },
    });
  } catch (cause) {
    throw classifyReasoningProviderFailure(cause);
  }
}
