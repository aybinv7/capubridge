export type HttpMethodFilter =
  | "ANY"
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export type UrlMatchType = "contains" | "glob" | "regex" | "exact";

export type MockInterceptMode = "off" | "cdp" | "http";

export interface MockResponseHeader {
  id: string;
  name: string;
  value: string;
}

export interface MockRule {
  id: string;
  name: string;
  enabled: boolean;
  // Matching
  method: HttpMethodFilter;
  urlPattern: string;
  urlMatchType: UrlMatchType;
  // Response
  statusCode: number;
  contentType: string;
  responseHeaders: MockResponseHeader[];
  responseBody: string;
  // Behavior
  delayMs: number;
  passThrough: boolean;
  // Stats
  hitCount: number;
  createdAt: number;
}

export interface MockLogEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  responseStatus: number | null;
  mode: "cdp" | "http";
  delayApplied: number;
  passedThrough: boolean;
  noMatch: boolean;
}

export interface MockTargetConfig {
  rules: MockRule[];
  interceptMode: MockInterceptMode;
}

export interface MockRuleExport {
  format: "capubridge-mock-rule";
  version: 1;
  exportedAt: string;
  rule: Omit<MockRule, "id" | "hitCount" | "createdAt">;
}

export const DEFAULT_RULE_TEMPLATES: Array<{ label: string; rule: Partial<MockRule> }> = [
  {
    label: "200 JSON",
    rule: { statusCode: 200, contentType: "application/json", responseBody: '{\n  "data": []\n}' },
  },
  {
    label: "201 Created",
    rule: {
      statusCode: 201,
      contentType: "application/json",
      responseBody: '{\n  "id": 1,\n  "created": true\n}',
    },
  },
  {
    label: "204 No Content",
    rule: { statusCode: 204, contentType: "", responseBody: "" },
  },
  {
    label: "401 Unauthorized",
    rule: {
      statusCode: 401,
      contentType: "application/json",
      responseBody: '{\n  "error": "Unauthorized"\n}',
    },
  },
  {
    label: "403 Forbidden",
    rule: {
      statusCode: 403,
      contentType: "application/json",
      responseBody: '{\n  "error": "Forbidden"\n}',
    },
  },
  {
    label: "404 Not Found",
    rule: {
      statusCode: 404,
      contentType: "application/json",
      responseBody: '{\n  "error": "Not found"\n}',
    },
  },
  {
    label: "500 Server Error",
    rule: {
      statusCode: 500,
      contentType: "application/json",
      responseBody: '{\n  "error": "Internal server error"\n}',
    },
  },
  {
    label: "503 Unavailable",
    rule: {
      statusCode: 503,
      contentType: "application/json",
      responseBody: '{\n  "error": "Service unavailable"\n}',
    },
  },
  {
    label: "Slow 2s delay",
    rule: {
      statusCode: 200,
      contentType: "application/json",
      responseBody: '{\n  "data": []\n}',
      delayMs: 2000,
    },
  },
];
