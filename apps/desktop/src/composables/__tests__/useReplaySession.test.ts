import { describe, expect, test } from "vite-plus/test";
import { parseDatabaseTrack, parseReplayManifest, parseReplayNdjson } from "../useReplaySession";

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

  test("parses a databases track with both localStorage and tableChange kinds", () => {
    const track = [
      '{"t":0,"data":{"kind":"localStorage","origin":"https://app.example","entries":[{"key":"locale","value":"fr"}],"reason":"initial"}}',
      '{"t":5120,"data":{"kind":"tableChange","engine":"sqlite","table":"orders","type":"update","affectedRows":1,"affectedIds":["ord_8812"],"transactionId":"tx-41"}}',
      "",
    ].join("\n");
    const result = parseDatabaseTrack(track);
    expect(result.events.map((event) => event.data.kind)).toEqual(["localStorage", "tableChange"]);
    expect(result.skippedKinds).toEqual([]);
  });

  test("rejects a malformed tableChange line with a clear error", () => {
    expect(() =>
      parseDatabaseTrack(
        '{"t":1,"data":{"kind":"tableChange","engine":"sqlite","table":"","type":"insert","affectedRows":1,"affectedIds":[],"transactionId":null}}\n',
      ),
    ).toThrow("Corrupt databases track at event 1: tableChange.table must be a non-empty string");
  });

  test("rejects invalid event envelopes", () => {
    expect(() => parseReplayNdjson("perf", '{"data":{}}\n')).toThrow(
      "Corrupt perf track at line 1: invalid event envelope",
    );
  });
});
