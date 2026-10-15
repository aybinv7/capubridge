import { describe, expect, test } from "vite-plus/test";
import { classifyReasoningProviderFailure } from "../providerFailure";

describe("provider completion failures", () => {
  test("keeps a quota failure resumable without including a credential", () => {
    const failure = classifyReasoningProviderFailure(
      new Error("provider-quota: sk-12345678901234567890"),
    );

    expect(failure.kind).toBe("quota");
    expect(failure.resumable).toBe(true);
    expect(failure.message).not.toContain("sk-");
  });
});
