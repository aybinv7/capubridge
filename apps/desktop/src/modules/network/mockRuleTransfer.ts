import { open, save } from "@tauri-apps/plugin-dialog";
import { base64ToUtf8, utf8ToBase64 } from "@/lib/base64";
import { invokeCommand } from "@/runtime/ipc/client";
import type { MockRule, MockRuleExport, MockResponseHeader } from "@/types/mock.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Mock rule ${field} must be a string`);
  return value;
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Mock rule ${field} must be a number`);
  }
  return value;
}

function parseHeaders(value: unknown): MockResponseHeader[] {
  if (!Array.isArray(value)) return [];
  return value.map((header) => {
    if (!isRecord(header)) throw new Error("Mock rule response headers must be objects");
    return {
      id: crypto.randomUUID(),
      name: readString(header.name, "response header name"),
      value: readString(header.value, "response header value"),
    };
  });
}

/** Reads an exported rule file's content; older files without `bodyEncoding` hold text bodies. */
export function parseMockRuleExport(value: unknown): Partial<MockRule> {
  if (!isRecord(value) || value.format !== "capubridge-mock-rule" || value.version !== 1) {
    throw new Error("Not a Capubridge mock rule export");
  }
  if (!isRecord(value.rule)) throw new Error("Mock rule export has no rule configuration");
  const rule = value.rule;
  return {
    name: readString(rule.name, "name"),
    enabled: typeof rule.enabled === "boolean" ? rule.enabled : true,
    method: readString(rule.method, "method") as MockRule["method"],
    urlPattern: readString(rule.urlPattern, "urlPattern"),
    urlMatchType: readString(rule.urlMatchType, "urlMatchType") as MockRule["urlMatchType"],
    statusCode: readNumber(rule.statusCode, "statusCode"),
    contentType: readString(rule.contentType, "contentType"),
    responseHeaders: parseHeaders(rule.responseHeaders),
    responseBody: readString(rule.responseBody, "responseBody"),
    ...(rule.bodyEncoding === "base64" ? { bodyEncoding: "base64" as const } : {}),
    delayMs: readNumber(rule.delayMs, "delayMs"),
    passThrough: typeof rule.passThrough === "boolean" ? rule.passThrough : false,
  };
}

/** The file content an export writes for a rule. */
export function mockRuleExport(rule: MockRule, exportedAt = new Date()): MockRuleExport {
  return {
    format: "capubridge-mock-rule",
    version: 1,
    exportedAt: exportedAt.toISOString(),
    rule: {
      name: rule.name,
      enabled: rule.enabled,
      method: rule.method,
      urlPattern: rule.urlPattern,
      urlMatchType: rule.urlMatchType,
      statusCode: rule.statusCode,
      contentType: rule.contentType,
      responseHeaders: rule.responseHeaders.map(({ name, value }) => ({
        id: crypto.randomUUID(),
        name,
        value,
      })),
      responseBody: rule.responseBody,
      ...(rule.bodyEncoding === "base64" ? { bodyEncoding: "base64" as const } : {}),
      delayMs: rule.delayMs,
      passThrough: rule.passThrough,
    },
  };
}

export async function exportMockRule(rule: MockRule): Promise<string | null> {
  const config = mockRuleExport(rule);
  const destination = await save({
    defaultPath: `${rule.name.replace(/[^a-z0-9-_]/gi, "-").toLowerCase() || "mock-rule"}.capubridge-rule.json`,
    filters: [{ name: "Capubridge mock rule", extensions: ["json"] }],
  });
  if (!destination) return null;
  await invokeCommand("save_base64_file", {
    path: destination,
    data: utf8ToBase64(JSON.stringify(config, null, 2)),
  });
  return destination;
}

export async function importMockRule(): Promise<Partial<MockRule> | null> {
  const source = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Capubridge mock rule", extensions: ["json"] }],
  });
  if (!source || Array.isArray(source)) return null;
  const encoded = await invokeCommand("read_local_file_base64", { path: source });
  return parseMockRuleExport(JSON.parse(base64ToUtf8(encoded)));
}
