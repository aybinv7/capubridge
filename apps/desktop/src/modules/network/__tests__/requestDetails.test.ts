import { describe, expect, test } from "vite-plus/test";
import {
  base64Lines,
  formFields,
  languageForMime,
  payloadContent,
  responseContent,
  responseText,
} from "@/shared/http/bodyContent";
import { findHeader, parseRequestCookies, parseSetCookies } from "../requests/details/cookies";
import { shellQuote, toCurl, toFetch } from "../requests/details/copyAs";
import { asDetailTab, cycleTab } from "../requests/details/detailTabs";
import {
  REQUEST_FIRST,
  RESPONSE_FIRST,
  UNFOLDED_LIMIT,
  groupHeaders,
} from "@/shared/http/headerGroups";
import { generalFacts, headerFacts, sizeFact } from "../requests/details/requestFacts";
import { timingBreakdown } from "../requests/details/timing";
import { networkEntry } from "./fixtures";

const timing = {
  requestTime: 100.01,
  proxyStart: -1,
  proxyEnd: -1,
  dnsStart: 1,
  dnsEnd: 5,
  connectStart: 5,
  connectEnd: 25,
  sslStart: 10,
  sslEnd: 25,
  workerStart: -1,
  workerEnd: -1,
  sendStart: 25,
  sendEnd: 26,
  receiveHeadersStart: 60,
  receiveHeadersEnd: 66,
};

describe("timing", () => {
  test("phases are laid out from the moment the request was issued", () => {
    const entry = networkEntry({ startTimestamp: 100, finishedTimestamp: 100.1, timing });
    const breakdown = timingBreakdown(entry);
    expect(breakdown).not.toBeNull();
    const byId = Object.fromEntries((breakdown?.phases ?? []).map((phase) => [phase.id, phase]));
    expect(byId.queued?.duration).toBeCloseTo(10);
    expect(byId.stalled?.duration).toBeCloseTo(1);
    expect(byId.dns?.duration).toBeCloseTo(4);
    expect(byId.connect?.duration).toBeCloseTo(5);
    expect(byId.ssl?.duration).toBeCloseTo(15);
    expect(byId.send?.duration).toBeCloseTo(1);
    expect(byId.wait?.duration).toBeCloseTo(40);
    expect(byId.download?.duration).toBeCloseTo(24);
    expect(byId.wait?.start).toBeCloseTo(36);
    expect(breakdown?.total).toBeCloseTo(100);
  });

  test("no CDP timing gives no breakdown", () => {
    expect(timingBreakdown(networkEntry({ timing: null }))).toBeNull();
  });
});

describe("cookies and headers", () => {
  test("header lookup ignores case", () => {
    expect(findHeader({ "Content-Type": "text/html" }, "content-type")).toBe("text/html");
    expect(findHeader({}, "cookie")).toBe("");
  });

  test("request cookies split on semicolons", () => {
    expect(parseRequestCookies("a=1; b=two=2; flag")).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "two=2" },
      { name: "flag", value: "" },
    ]);
  });

  test("set-cookie lines keep their attributes", () => {
    const [session, theme] = parseSetCookies(
      "session=abc; Path=/; HttpOnly; Secure\ntheme=dark; Max-Age=60",
    );
    expect(session).toEqual({
      name: "session",
      value: "abc",
      attributes: [
        ["Path", "/"],
        ["HttpOnly", true],
        ["Secure", true],
      ],
    });
    expect(theme?.attributes).toEqual([["Max-Age", "60"]]);
  });
});

describe("copy as", () => {
  const post = networkEntry({
    url: "https://api.test/orders?x=1",
    method: "POST",
    requestHeaders: {
      ":authority": "api.test",
      "Content-Type": "application/json",
      "X-Note": "it's",
    },
    hasPostData: true,
  });

  test("shell quoting survives single quotes", () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });

  test("cURL carries headers and the body, never pseudo-headers", () => {
    const curl = toCurl(post, '{"a":1}');
    expect(curl).toContain("curl 'https://api.test/orders?x=1'");
    expect(curl).toContain(`-H 'Content-Type: application/json'`);
    expect(curl).toContain(`-H 'X-Note: it'\\''s'`);
    expect(curl).toContain(`--data-raw '{"a":1}'`);
    expect(curl).not.toContain(":authority");
    expect(curl).not.toContain("-X POST");
  });

  test("cURL names the method when the body does not imply it", () => {
    expect(toCurl(networkEntry({ method: "DELETE" }), null)).toContain("-X DELETE");
    expect(toCurl(networkEntry({ method: "GET" }), null)).not.toContain("-X");
  });

  test("fetch is valid JavaScript with the same parts", () => {
    const code = toFetch(post, '{"a":1}');
    const init = JSON.parse(code.slice(code.indexOf(", ") + 2, -2)) as Record<string, unknown>;
    expect(code.startsWith('fetch("https://api.test/orders?x=1"')).toBe(true);
    expect(init).toEqual({
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Note": "it's" },
      body: '{"a":1}',
    });
  });
});

describe("bodies", () => {
  test("JSON is parsed and pretty-printed, even when the type does not say JSON", () => {
    const json = responseContent({ body: '{"a":[1,2]}', base64Encoded: false }, "text/plain");
    expect(json.kind).toBe("json");
    if (json.kind === "json") expect(json.pretty).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
  });

  test("broken JSON with a JSON type stays readable as text", () => {
    const content = responseContent({ body: "{oops", base64Encoded: false }, "application/json");
    expect(content.kind).toBe("json");
    if (content.kind === "json") expect(content.parse.ok).toBe(false);
  });

  test("base64 images become pictures, base64 text is decoded", () => {
    expect(responseContent({ body: "iVBORw0KGgo=", base64Encoded: true }, "image/png").kind).toBe(
      "image",
    );
    const text = responseContent({ body: btoa("hello"), base64Encoded: true }, "text/plain");
    expect(text).toEqual({ kind: "text", text: "hello", language: "plain" });
    expect(responseText({ body: btoa("hello"), base64Encoded: true }, "text/plain")).toBe("hello");
    expect(
      responseText({ body: "AAAA", base64Encoded: true }, "application/octet-stream"),
    ).toBeNull();
  });

  test("other bytes are reported, not shown", () => {
    const content = responseContent({ body: "AAAAAAAA", base64Encoded: true }, "application/pdf");
    expect(content).toEqual({
      kind: "binary",
      bytes: 6,
      mime: "application/pdf",
      base64: "AAAAAAAA",
    });
  });

  test("Base64 is shown in short lines, never as one huge line", () => {
    const lengths = base64Lines("A".repeat(200))
      .split("\n")
      .map((line) => line.length);
    expect(lengths).toEqual([76, 76, 48]);
  });

  test("an SVG is a picture with its text kept", () => {
    const content = responseContent({ body: "<svg/>", base64Encoded: false }, "image/svg+xml");
    expect(content.kind).toBe("svg");
  });

  test("empty bodies say so", () => {
    expect(responseContent({ body: "", base64Encoded: false }, "text/html").kind).toBe("empty");
    expect(payloadContent("", "application/json").kind).toBe("empty");
  });

  test("form payloads read as fields", () => {
    expect(formFields("a=1&b=two%20words")).toBe("a: 1\nb: two words");
    expect(formFields("not a form")).toBeNull();
    expect(payloadContent("a=1&b=2", "application/x-www-form-urlencoded")).toEqual({
      kind: "text",
      text: "a: 1\nb: 2",
      language: "plain",
    });
  });

  test("languages follow the media type", () => {
    expect(languageForMime("application/javascript; charset=utf-8")).toBe("javascript");
    expect(languageForMime("text/html")).toBe("html");
    expect(languageForMime("image/svg+xml")).toBe("xml");
    expect(languageForMime("application/vnd.api+json")).toBe("json");
  });
});

describe("detail tabs", () => {
  test("cycling wraps at both ends", () => {
    expect(cycleTab("headers", -1)).toBe("cookies");
    expect(cycleTab("cookies", 1)).toBe("headers");
    expect(cycleTab("payload", 1)).toBe("response");
  });

  test("an unknown stored tab falls back to headers", () => {
    expect(asDetailTab("timing")).toBe("timing");
    expect(asDetailTab("nonsense")).toBe("headers");
  });
});

describe("facts said once", () => {
  test("the header owns method, name, status and address", () => {
    const entry = networkEntry({
      url: "https://api.test/v1/orders?page=2",
      httpStatus: 404,
      statusText: "Not Found",
    });
    expect(headerFacts(entry)).toEqual({
      method: "GET",
      name: "orders?page=2",
      status: { text: "404 Not Found", tone: "warning" },
      address: "https://api.test/v1/orders?page=2",
    });
    expect(headerFacts(networkEntry({ httpStatus: 200, statusText: "" })).status.text).toBe("200");
    expect(headerFacts(networkEntry({ isWebSocket: true })).method).toBeNull();
  });

  test("General never repeats the header, and says size and source in one row", () => {
    const keys = generalFacts(networkEntry({ remoteAddress: "203.0.113.5:443" })).map(
      (fact) => fact.key,
    );
    expect(keys).toEqual(["Type", "Started by", "Size", "Remote address", "Protocol"]);
    expect(keys).not.toContain("Address");
    expect(keys).not.toContain("Method");
    expect(keys).not.toContain("Status");
    expect(keys).not.toContain("Served from");
  });

  test("the media type joins Type only when no content-type header says it", () => {
    expect(generalFacts(networkEntry())[0]?.value).toBe("Fetch · application/json");
    expect(
      generalFacts(networkEntry({ responseHeaders: { "Content-Type": "application/json" } }))[0]
        ?.value,
    ).toBe("Fetch");
  });

  test("Started by names the script once, with its line", () => {
    const facts = generalFacts(
      networkEntry({ initiatorUrl: "https://app.test/assets/main.js", initiatorLine: 41 }),
    );
    expect(facts.find((fact) => fact.key === "Started by")?.value).toBe(
      "https://app.test/assets/main.js:42",
    );
  });

  test("size says where the bytes came from in the same value", () => {
    expect(sizeFact(networkEntry({ transferSize: 1024, resourceSize: 4096 }))).toBe(
      "1.0 KB transferred · 4.0 KB decoded",
    );
    expect(sizeFact(networkEntry({ transferSize: 2048, resourceSize: 2048 }))).toBe("2.0 KB");
    expect(sizeFact(networkEntry({ fromDiskCache: true, resourceSize: 4096 }))).toBe(
      "4.0 KB from the disk cache",
    );
    expect(
      sizeFact(
        networkEntry({ url: "https://localhost/app.js", transferSize: 0, resourceSize: 12288 }),
      ),
    ).toBe("12 KB from the app's files");
    expect(sizeFact(networkEntry({ state: "pending" }))).toBeNull();
    expect(sizeFact(networkEntry({ state: "failed" }))).toBeNull();
    expect(sizeFact(networkEntry({ isWebSocket: true }))).toBeNull();
  });

  test("a failure's error lives in General, toned as an error", () => {
    const facts = generalFacts(networkEntry({ state: "failed", errorText: "net::ERR_FAILED" }));
    expect(facts.find((fact) => fact.key === "Error")).toEqual({
      key: "Error",
      value: "net::ERR_FAILED",
      tone: "error",
    });
    expect(facts.some((fact) => fact.key === "Size")).toBe(false);
  });
});

describe("header groups", () => {
  test("a short list shows every header, the important ones first", () => {
    const groups = groupHeaders(
      { date: "today", "Content-Type": "text/html", etag: '"1"' },
      RESPONSE_FIRST,
      "set-cookie",
    );
    expect(groups.surfaced.map(([name]) => name)).toEqual(["Content-Type", "etag", "date"]);
    expect(groups.folded).toEqual([]);
    expect(groups.total).toBe(3);
  });

  test("a long list surfaces the important headers and folds the rest by name", () => {
    const headers: Record<string, string> = { "cache-control": "no-store", "content-type": "a/b" };
    for (let index = 0; index < UNFOLDED_LIMIT; index += 1) headers[`x-extra-${index}`] = "1";
    const groups = groupHeaders(headers, RESPONSE_FIRST, "set-cookie");
    expect(groups.surfaced.map(([name]) => name)).toEqual(["content-type", "cache-control"]);
    expect(groups.folded).toHaveLength(UNFOLDED_LIMIT);
    expect(groups.folded[0]?.[0]).toBe("x-extra-0");
    expect(groups.total).toBe(UNFOLDED_LIMIT + 2);
  });

  test("the cookie header is left to the Cookies tab but still counted", () => {
    const groups = groupHeaders({ Cookie: "a=1; b=2", accept: "*/*" }, REQUEST_FIRST, "cookie");
    expect(groups.cookie).toBe("a=1; b=2");
    expect(groups.surfaced).toEqual([["accept", "*/*"]]);
    expect(groups.total).toBe(2);
  });
});
