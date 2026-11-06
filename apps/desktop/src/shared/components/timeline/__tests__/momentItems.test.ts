import { describe, expect, test } from "vite-plus/test";
import type { TimelineLane, TimelineMarker, TimelineMarkerRef } from "@/types/timeline.types";
import { buildMoment, type MomentSources } from "../momentItems";

const T = 1_730_000_000_000;
let seq = 0;

function marker(
  lane: TimelineLane,
  ref: TimelineMarkerRef,
  offset: number,
  label = ref.id,
): TimelineMarker {
  seq += 1;
  return { seq, t: T + offset, lane, severity: "info", ref, label };
}

function sources(overrides: Partial<MomentSources> = {}): MomentSources {
  return {
    isMuted: () => false,
    hasReveal: () => true,
    isKept: () => true,
    retentionOf: (kind) => (kind === "console" ? "Console keeps the last 10,000 messages" : null),
    ...overrides,
  };
}

describe("moment items", () => {
  test("lists a console.error once, as an error, in time order", () => {
    const error = { kind: "console", id: "c2" } as const;
    const moment = buildMoment(
      [
        marker("network", { kind: "network", id: "r1" }, 400),
        marker("console", error, 120),
        marker("errors", error, 120),
        marker("console", { kind: "console", id: "c1" }, 10),
      ],
      sources(),
    );
    expect(moment.items.map((item) => [item.ref.id, item.lane])).toEqual([
      ["c1", "console"],
      ["c2", "errors"],
      ["r1", "network"],
    ]);
    expect(moment.total).toBe(3);
    expect(moment.counts).toEqual({ errors: 1, network: 1, console: 2, logcat: 0 });
  });

  test("a muted lane leaves the list and the counts, and its twin stays listed", () => {
    const error = { kind: "console", id: "c2" } as const;
    const moment = buildMoment(
      [marker("console", error, 5), marker("errors", error, 5)],
      sources({ isMuted: (lane) => lane === "errors" }),
    );
    expect(moment.items.map((item) => item.lane)).toEqual(["console"]);
    expect(moment.counts.errors).toBe(0);
  });

  test("labels aged-out items with what the section keeps, and keeps them listed", () => {
    const moment = buildMoment(
      [
        marker("console", { kind: "console", id: "old" }, 1),
        marker("network", { kind: "network", id: "gone" }, 2),
        marker("console", { kind: "console", id: "new" }, 3),
      ],
      sources({ isKept: (ref) => ref.id === "new" }),
    );
    expect(moment.items.map((item) => [item.state, item.note])).toEqual([
      ["aged-out", "No longer kept — Console keeps the last 10,000 messages"],
      ["aged-out", "No longer kept"],
      ["kept", null],
    ]);
  });

  test("says when no section can show an item yet", () => {
    const moment = buildMoment(
      [marker("logcat", { kind: "logcat", id: "l1" }, 0)],
      sources({ hasReveal: () => false }),
    );
    expect(moment.items[0]?.state).toBe("unreachable");
  });

  test("lists at most the limit but counts every item", () => {
    const markers = Array.from({ length: 30 }, (_, index) =>
      marker("logcat", { kind: "logcat", id: `l${index}` }, index),
    );
    const moment = buildMoment(markers, sources(), 20);
    expect(moment.items).toHaveLength(20);
    expect(moment.total).toBe(30);
    expect(moment.counts.logcat).toBe(30);
  });
});
