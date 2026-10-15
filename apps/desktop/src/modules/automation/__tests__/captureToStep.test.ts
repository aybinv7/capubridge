import { describe, expect, test } from "vite-plus/test";
import type { Observation } from "@/types/automation.types";
import { captureToStep, coalesceKeystrokes } from "../captureToStep";

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    native: {
      controls: [
        {
          index: 0,
          bounds: [0, 0, 100, 100],
          className: "Button",
          text: "OK",
          contentDesc: "",
          clickable: true,
          enabled: true,
        },
        {
          index: 1,
          bounds: [10, 10, 50, 50],
          className: "TextView",
          text: "Hello",
          contentDesc: "",
          clickable: false,
          enabled: true,
        },
      ],
      packageName: "com.example.app",
      activity: "Main",
      systemUi: { keyboardVisible: false, dialogPresent: false },
    },
    webview: {
      elements: [
        {
          index: 0,
          cssSelector: "#a",
          role: "button",
          text: "Alpha",
          enabled: true,
          visible: true,
          bounds: [0, 0, 100, 40],
          isInput: false,
          inputType: null,
        },
        {
          index: 1,
          cssSelector: "#inner",
          role: "button",
          text: "Inner",
          enabled: true,
          visible: true,
          bounds: [10, 10, 30, 30],
          isInput: false,
          inputType: null,
        },
      ],
    },
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
    ...overrides,
  };
}

describe("captureToStep", () => {
  test("a point inside an element with a selector produces a selector-targeted tap", () => {
    const obs = observation();
    obs.native.controls = [];
    const result = captureToStep({ x: 5, y: 5, nonce: 1 }, obs);
    expect(result.step.op).toBe("tap");
    if (result.step.op === "tap") {
      expect(result.step.target.kind).toBe("selector");
    }
    expect(result.warning).toBeNull();
  });

  test("a point inside an element with text but no selector produces a text target", () => {
    const obs = observation();
    if (obs.webview !== null) {
      obs.webview.elements = [];
    }
    const result = captureToStep({ x: 5, y: 5, nonce: 1 }, obs);
    if (result.step.op === "tap") {
      expect(result.step.target.kind).toBe("text");
    }
  });

  test("a point matching only a native control produces a native index target", () => {
    const obs = observation();
    if (obs.webview !== null) {
      obs.webview.elements = [];
    }
    obs.native.controls = [
      {
        index: 7,
        bounds: [0, 0, 100, 100],
        className: "View",
        text: "",
        contentDesc: "",
        clickable: true,
        enabled: true,
      },
    ];
    const result = captureToStep({ x: 50, y: 50, nonce: 1 }, obs);
    if (result.step.op === "tap") {
      expect(result.step.target.kind).toBe("nativeIndex");
    }
  });

  test("a point matching nothing produces a point target and a warning", () => {
    const obs = observation();
    if (obs.webview !== null) {
      obs.webview.elements = [];
    }
    obs.native.controls = [];
    const result = captureToStep({ x: 999, y: 999, nonce: 1 }, obs);
    if (result.step.op === "tap") {
      expect(result.step.target.kind).toBe("point");
    }
    expect(result.warning).not.toBeNull();
  });

  test("overlapping candidates resolve to the innermost, not the largest", () => {
    const obs = observation();
    obs.native.controls = [];
    const result = captureToStep({ x: 15, y: 15, nonce: 1 }, obs);
    if (result.step.op === "tap" && result.step.target.kind === "selector") {
      expect(result.step.target.cssSelector).toBe("#inner");
    }
  });

  test("three keystrokes coalesce into one type step carrying the whole string", () => {
    const step = coalesceKeystrokes(["a", "b", "c"], { kind: "selector", cssSelector: "#input" });
    expect(step.op).toBe("type");
    if (step.op === "type") {
      expect(step.text).toBe("abc");
    }
  });

  test("a keystroke after a tap starts a new type step", () => {
    const tap = captureToStep({ x: 5, y: 5, nonce: 1 }, observation());
    const type = coalesceKeystrokes(["x"], { kind: "selector", cssSelector: "#input" });
    expect(tap.step.op).toBe("tap");
    expect(type.op).toBe("type");
    expect(tap.step.id).not.toBe(type.id);
  });

  test("a repeated tap at identical coordinates produces two steps", () => {
    const obs = observation();
    if (obs.webview !== null) {
      obs.webview.elements = [];
    }
    obs.native.controls = [];
    const r1 = captureToStep({ x: 5, y: 5, nonce: 1 }, obs);
    const r2 = captureToStep({ x: 5, y: 5, nonce: 2 }, obs);
    expect(r1.step.id).not.toBe(r2.step.id);
  });
});
