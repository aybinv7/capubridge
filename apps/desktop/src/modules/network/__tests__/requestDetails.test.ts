import { describe, expect, test } from "vite-plus/test";
import {
  base64Lines,
  formFields,
  languageForMime,
  payloadContent,
  responseContent,
  responseText,
} from "../requests/details/bodyContent";
import { findHeader, parseRequestCookies, parseSetCookies } from "../requests/details/cookies";
import { shellQuote, toCurl, toFetch } from "../requests/details/copyAs";
import { asDetailTab, cycleTab } from "../requests/details/detailTabs";
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
