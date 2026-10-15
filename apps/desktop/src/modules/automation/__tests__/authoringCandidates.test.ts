import { describe, expect, test } from "vite-plus/test";
import type { Observation } from "@/types/automation.types";
import { candidatesFromObservation } from "../authoringCandidates";

function observation(): Observation {
  return {
    native: {
      packageName: "com.example",
      activity: ".MainActivity",
      systemUi: { keyboardVisible: false, dialogPresent: false },
      controls: [
        {
          index: 0,
          bounds: [0, 0, 100, 40],
          className: "android.widget.Button",
          text: "Continue",
          contentDesc: "",
          clickable: true,
          enabled: true,
        },
        {
          index: 1,
          bounds: [0, 40, 100, 40],
          className: "android.widget.ImageButton",
          text: "",
          contentDesc: "",
          clickable: true,
          enabled: true,
        },
      ],
    },
    webview: {
      elements: [
        {
          index: 0,
          cssSelector: "#continue",
          role: "button",
          text: "Continue",
          enabled: true,
          visible: true,
          bounds: [0, 0, 100, 40],
          isInput: false,
          inputType: null,
        },
        {
          index: 1,
          cssSelector: "#hidden",
          role: "button",
          text: "Hidden",
          enabled: true,
          visible: false,
          bounds: [0, 0, 0, 0],
          isInput: false,
          inputType: null,
        },
      ],
    },
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
  };
}

describe("candidatesFromObservation", () => {
  test("prefers visible webview selectors and deduplicates native text", () => {
    const candidates = candidatesFromObservation(observation());

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      source: "webview",
      target: { kind: "selector", cssSelector: "#continue" },
    });
    expect(candidates[1]).toMatchObject({
      source: "native",
      target: { kind: "nativeIndex", index: 1 },
    });
  });
});
