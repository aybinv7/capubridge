import { describe, expect, it } from "vite-plus/test";
import {
  completionContext,
  fetchCompletionNames,
  rankCompletions,
  type CompletionClient,
} from "@/lib/console/replCompletion";
import { replResultText } from "@/lib/console/replResult";

describe("prompt completion", () => {
  it("reads member and global completions under the caret", () => {
    expect(completionContext("window.loc", 10)).toEqual({
      objectExpr: "window",
      prefix: "loc",
      from: 7,
    });
    expect(completionContext("a.b?.c.", 7)).toEqual({ objectExpr: "a.b?.c", prefix: "", from: 7 });
    expect(completionContext("const x = doc", 13)).toEqual({
      objectExpr: null,
      prefix: "doc",
      from: 10,
    });
    expect(completionContext("foo().", 6)).toBeNull();
  });

  it("ranks exact-case matches first and private names last", () => {
    expect(rankCompletions(["location", "_local", "Locale", "log", "lo"], "lo")).toEqual([
      "location",
      "log",
      "Locale",
    ]);
  });

  it("asks the target without side effects", async () => {
    const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const client: CompletionClient = {
      send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
        calls.push({ method, params });
        const result =
          method === "Runtime.globalLexicalScopeNames"
            ? { names: ["appState"] }
            : { result: { type: "object", value: ["document", "appState"] } };
        return Promise.resolve(result as T);
      },
    };
    expect(await fetchCompletionNames(client, null)).toEqual(["appState", "document"]);
    const evaluate = calls.find((call) => call.method === "Runtime.evaluate");
    expect(evaluate?.params?.throwOnSideEffect).toBe(true);
  });

  it("shows returned objects as JSON", () => {
    expect(replResultText({ type: "object", value: { a: 1 } })).toBe('{"a":1}');
    expect(replResultText({ type: "number", value: 2, description: "2" })).toBe("2");
  });
});
