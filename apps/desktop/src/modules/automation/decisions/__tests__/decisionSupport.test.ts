import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  DEFAULT_DECISION_MODEL_ID,
  listDecisionModels,
  requireDecisionModel,
} from "../decisionModels";
import { readDecisionModelId, writeDecisionModelId } from "../decisionModelSetting";
import { describeCapabilities, visualPathBlocker } from "../decisionModelSummary";
import { fitScreenSize } from "../screenImage";

const JEV_LIMITS = { minSide: 256, maxSide: 1568, maxPixels: 2_458_624 };

describe("screen fitting", () => {
  test("a 1080x2400 phone screen scales to fit Jev's 1568 px side limit", () => {
    expect(fitScreenSize(1080, 2400, JEV_LIMITS)).toEqual({ width: 705, height: 1568 });
  });

  test("a screen already inside the limits is never upscaled", () => {
    expect(fitScreenSize(720, 1280, JEV_LIMITS)).toEqual({ width: 720, height: 1280 });
  });

  test("a strip whose short side would fall under the minimum cannot fit", () => {
    expect(fitScreenSize(100, 3000, JEV_LIMITS)).toBeNull();
  });

  test("a model without limits keeps the device size", () => {
    expect(fitScreenSize(1080, 2400, { minSide: null, maxSide: null, maxPixels: null })).toEqual({
      width: 1080,
      height: 2400,
    });
  });
});

describe("decision model setting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubStorage(): Map<string, string> {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    return store;
  }

  test("defaults to the Jev pin", () => {
    stubStorage();
    expect(readDecisionModelId()).toBe(DEFAULT_DECISION_MODEL_ID);
  });

  test("a chosen table model survives a reread", () => {
    stubStorage();
    expect(writeDecisionModelId("liquid/d1")).toBe(true);
    expect(readDecisionModelId()).toBe("liquid/d1");
  });

  test("a model that left the table falls back to the pin", () => {
    const store = stubStorage();
    store.set("capubridge.automation.decision-model.v1", "acme/retired-model");
    expect(readDecisionModelId()).toBe(DEFAULT_DECISION_MODEL_ID);
    expect(writeDecisionModelId("acme/retired-model")).toBe(false);
  });

  test("storage that throws reads as the pin and reports the failed write", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    });
    expect(readDecisionModelId()).toBe(DEFAULT_DECISION_MODEL_ID);
    expect(writeDecisionModelId("liquid/d1")).toBe(false);
  });
});

describe("capability table", () => {
  test("only Jev 1.14 and the Jev alias answer box questions", () => {
    const withBox = listDecisionModels()
      .filter((model) => model.questionTypes.includes("box"))
      .map((model) => model.id);
    expect(withBox).toEqual(["typesafe/jev-1.14", "~typesafe/jev-latest"]);
  });

  test("the default is a dated release, never an alias", () => {
    expect(requireDecisionModel(DEFAULT_DECISION_MODEL_ID).alias).toBe(false);
  });

  test("the summary says what a model can do and an unmeasured model keeps screenshots off", () => {
    const jev = requireDecisionModel("typesafe/jev-1.14");
    expect(describeCapabilities(jev)).toBe(
      "finds targets in screenshots · 262k context · $0.042/M input",
    );
    expect(describeCapabilities(requireDecisionModel("microsoft/microsoft-decision-1"))).toContain(
      "text only",
    );
    expect(visualPathBlocker(jev, {})).toContain("image cost is measured");
    expect(visualPathBlocker(requireDecisionModel("liquid/d1"), {})).toBeNull();
  });
});
