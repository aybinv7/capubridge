import { describe, expect, it } from "vite-plus/test";
import { networkActivityMarkers } from "@/lib/timeline/markerMappers";
import type { NetworkEntry } from "@/types/network.types";

function request(patch: Partial<NetworkEntry> = {}): NetworkEntry {
  return {
    requestId: "r1",
    url: "https://api.example.test/orders",
    method: "GET",
    httpStatus: null,
    state: "pending",
    startedAt: 1_000,
    startTimestamp: 1,
    finishedTimestamp: null,
    ...patch,
  } as NetworkEntry;
}

describe("network activity markers", () => {
  it("puts a healthy request on the Network lane only", () => {
    const markers = networkActivityMarkers("request", request(), 5);
    expect(markers.map((marker) => marker.lane)).toEqual(["network"]);
    expect(markers[0]?.severity).toBe("info");
  });

  it("adds a red Errors cap for a request that arrives already failed", () => {
    const markers = networkActivityMarkers("request", request({ httpStatus: 500 }), 5);
    expect(markers.map((marker) => marker.lane)).toEqual(["network", "errors"]);
    expect(markers.every((marker) => marker.ref.kind === "network")).toBe(true);
  });

  it("marks a later failure on Errors without counting the request twice", () => {
    const failed = networkActivityMarkers("failed", request({ state: "failed" }), 9);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ lane: "errors", severity: "error", t: 9 });
    expect(networkActivityMarkers("failed", request({ httpStatus: 404 }), 9)[0]?.label).toBe(
      "GET 404 https://api.example.test/orders",
    );
  });
});
