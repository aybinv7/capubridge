import { describe, expect, test } from "vite-plus/test";
import { classifyReasoningProviderFailure } from "../providerFailure";
import { listReasoningModelsForProvider, resolveReasoningModel } from "../providerRegistry";
import { ReasoningProviderError } from "../providerTypes";

describe("reasoning provider registry", () => {
  test("resolves provider models without coupling task state to a provider", () => {
    const openRouter = resolveReasoningModel({
      provider: "openrouter",
      modelId: "openrouter/auto",
    });
    const openAi = resolveReasoningModel({ provider: "openai", modelId: "gpt-5.4" });

    expect(openRouter.capabilities.tools).toBe(true);
    expect(openAi.capabilities.structuredOutput).toBe(true);
    expect(listReasoningModelsForProvider("anthropic")).toHaveLength(1);
  });

  test("rejects model selections that do not belong to the provider", () => {
    expect(() => resolveReasoningModel({ provider: "openai", modelId: "openrouter/auto" })).toThrow(
      /Unknown openai reasoning model/,
    );
  });

  test("normalizes provider failures without retaining source messages", () => {
    const quota = classifyReasoningProviderFailure(new Error("429 fixture-secret exceeded quota"));
    const rejected = classifyReasoningProviderFailure(
      new ReasoningProviderError("unauthorized", "Provider credentials were rejected", false),
    );

    expect(quota).toMatchObject({ kind: "quota", resumable: true });
    expect(quota.message).not.toContain("fixture-secret");
    expect(rejected).toMatchObject({ kind: "unauthorized", resumable: false });
  });
});
