import { describe, expect, test } from "vite-plus/test";
import { parseReplayManifest, parseReplayNdjson } from "../useReplaySession";

const validManifest = JSON.stringify({
  version: 1,
  sessionId: "session-1",
  label: "Session",
  startedAt: 100,
  duration: 200,
  deviceSerial: null,
  targetUrl: null,
  appPackage: null,
  tracks: {
    rrweb: false,
    network: true,
    console: false,
  },
});

describe("replay session parsing", () => {
  test("accepts a valid manifest and NDJSON track", () => {
    expect(parseReplayManifest(validManifest).sessionId).toBe("session-1");
    expect(parseReplayNdjson("network", '{"t":0,"data":{"id":"one"}}\n')).toEqual([
      { t: 0, data: { id: "one" } },
    ]);
  });

  test("rejects corrupt manifests with a terminal message", () => {
    expect(() => parseReplayManifest("{")).toThrow("Corrupt replay manifest JSON");
    expect(() => parseReplayManifest(JSON.stringify({ version: 1 }))).toThrow(
      "Corrupt replay manifest: required fields are invalid",
    );
  });

  test("reports the corrupt track and line", () => {
    expect(() => parseReplayNdjson("console", '{"t":0,"data":{}}\nnot-json\n')).toThrow(
      "Corrupt console track at line 2",
    );
  });

  test("rejects invalid event envelopes", () => {
    expect(() => parseReplayNdjson("perf", '{"data":{}}\n')).toThrow(
      "Corrupt perf track at line 1: invalid event envelope",
    );
  });
});
