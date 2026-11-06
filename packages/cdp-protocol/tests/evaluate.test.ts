import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vite-plus/test";
import type { CDPClient } from "../src/cdp/client.ts";
import {
  assertNoDeviceError,
  DeviceEvaluationError,
  evaluateChecked,
  jsLiteral,
  singleQuotedContent,
} from "../src/cdp/evaluate.ts";
import { LocalForageDomain } from "../src/cdp/domains/localforage.ts";

const hostile = [
  "plain",
  "it's",
  'say "hi"',
  "back\\slash and trailing \\",
  "line\nbreak\r\n",
  "  ",
  "</script><script>alert(1)</script>",
  "'); globalThis.pwned = true; ('",
  "${globalThis.pwned = true}",
];

function fakeClient(reply: (expression: string) => unknown) {
  const expressions: string[] = [];
  const client = {
    send: async (_method: string, params?: Record<string, unknown>) => {
      const expression = typeof params?.expression === "string" ? params.expression : "";
      expressions.push(expression);
      return reply(expression);
    },
  } as unknown as CDPClient;
  return { client, expressions };
}

describe("jsLiteral and singleQuotedContent", () => {
  test.each(hostile)("round-trip %j as data, never as code", (value) => {
    const fromLiteral = runInNewContext(`(${jsLiteral(value)})`) as string;
    const fromQuoted = runInNewContext(`'${singleQuotedContent(value)}'`) as string;
    expect(fromLiteral).toBe(value);
    expect(fromQuoted).toBe(value);
    expect((globalThis as { pwned?: boolean }).pwned).toBeUndefined();
  });
});

describe("evaluateChecked", () => {
  test("throws the device exception instead of returning undefined", async () => {
    const { client } = fakeClient(() => ({
      result: { type: "object", subtype: "error" },
      exceptionDetails: {
        text: "Uncaught",
        exception: { description: "ReferenceError: hello is not defined\n    at <anonymous>:1:1" },
      },
    }));
    await expect(evaluateChecked(client, { expression: "hello" })).rejects.toThrow(
      new DeviceEvaluationError("ReferenceError: hello is not defined"),
    );
  });

  test("returns the remote object when the script succeeds", async () => {
    const { client } = fakeClient(() => ({ result: { type: "number", value: 3 } }));
    await expect(evaluateChecked(client, { expression: "1 + 2" })).resolves.toEqual({
      result: { type: "number", value: 3 },
    });
  });
});

describe("assertNoDeviceError", () => {
  test("surfaces a serialised device failure", () => {
    expect(() => assertNoDeviceError({ error: "QuotaExceededError" })).toThrow(
      "QuotaExceededError",
    );
    expect(() => assertNoDeviceError({ ok: true })).not.toThrow();
  });
});

describe("LocalForageDomain writes", () => {
  test("ships key and value as JSON data, not as code", async () => {
    const { client, expressions } = fakeClient(() => ({ result: { value: '{"ok":true}' } }));
    const domain = new LocalForageDomain(client);
    const key = "'); globalThis.pwned = true; ('";
    const value = "alert(document.cookie)";
    await domain.setItem("https://app", key, value);
    const sent = expressions[0] ?? "";
    expect(sent).toContain(jsLiteral({ op: "set", key, raw: value }));
    expect(sent).not.toContain(`const value = ${value}`);
  });

  test("rejects when the device reports an error", async () => {
    const { client } = fakeClient(() => ({ result: { value: '{"error":"QuotaExceededError"}' } }));
    await expect(new LocalForageDomain(client).deleteItem("o", "k")).rejects.toThrow(
      "QuotaExceededError",
    );
  });
});
