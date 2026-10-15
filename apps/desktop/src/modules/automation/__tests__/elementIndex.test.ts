import { describe, expect, test } from "vite-plus/test";
import type {
  Decision,
  IndexedControl,
  IndexedElement,
  Observation,
} from "@/types/automation.types";
import {
  DEFAULT_CANDIDATE_LIMIT,
  buildCandidates,
  capCandidates,
  resolveTarget,
  validateDecisionTarget,
} from "../elementIndex";

function webviewElement(index: number, overrides: Partial<IndexedElement> = {}): IndexedElement {
  return {
    index,
    cssSelector: `#el-${index}`,
    role: "button",
    text: `Item ${index}`,
    enabled: true,
    visible: true,
    bounds: [index * 10, index * 10, 50, 30],
    isInput: false,
    inputType: null,
    ...overrides,
  };
}

function nativeControl(index: number, overrides: Partial<IndexedControl> = {}): IndexedControl {
  return {
    index,
    bounds: [0, 1000 + index * 60, 300, 50],
    className: "android.widget.Button",
    text: `Native ${index}`,
    contentDesc: "",
    clickable: index % 2 === 0,
    enabled: true,
    ...overrides,
  };
}

function baseObservation(): Observation {
  const elements = Array.from({ length: 10 }, (_, index) => webviewElement(index));
  elements.push(
    webviewElement(100, { text: "Ghost Invisible", visible: false }),
    webviewElement(101, { text: "Ghost Disabled", enabled: false }),
    webviewElement(102, { text: "Ghost Flat", bounds: [0, 0, 0, 0] }),
  );
  const controls = Array.from({ length: 20 }, (_, index) => nativeControl(index));
  controls.push(
    nativeControl(100, { text: "", contentDesc: "", clickable: false }),
    nativeControl(101, { text: "", contentDesc: "", clickable: false }),
  );
  return {
    native: {
      controls,
      packageName: "com.example.app",
      activity: "MainActivity",
      systemUi: { keyboardVisible: false, dialogPresent: false },
    },
    webview: { elements },
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
  };
}

function decisionWithIndex(index: number): Decision {
  return {
    operation: "tap",
    target: { kind: "nativeIndex", index },
    confidence: 1,
    reason: "test",
  };
}

describe("buildCandidates", () => {
  test("merges layers and drops invisible, disabled and zero-sized entries", () => {
    const candidates = buildCandidates(baseObservation());
    expect(candidates).toHaveLength(30);
    const labels = candidates.map((candidate) => candidate.label);
    expect(labels).not.toContain("Ghost Invisible");
    expect(labels).not.toContain("Ghost Disabled");
    expect(labels).not.toContain("Ghost Flat");
    for (const candidate of candidates) {
      expect(candidate.bounds[2]).toBeGreaterThan(0);
      expect(candidate.bounds[3]).toBeGreaterThan(0);
    }
  });

  test("a non-clickable native control with text survives, one without text does not", () => {
    const candidates = buildCandidates(baseObservation());
    const labels = candidates.map((candidate) => candidate.label);
    expect(labels).toContain("Native 1");
    const nativeIndices = candidates
      .filter((candidate) => candidate.source === "native")
      .map((candidate) => candidate.nativeIndex);
    expect(nativeIndices).not.toContain(100);
    expect(nativeIndices).not.toContain(101);
  });

  test("a native control describing the same target as a WebView element is dropped", () => {
    const observation = baseObservation();
    observation.webview?.elements.push(
      webviewElement(200, { cssSelector: "#dup", text: "Sign in", bounds: [0, 0, 100, 40] }),
    );
    observation.native.controls.push(
      nativeControl(200, { text: "Sign in", bounds: [0, 0, 200, 60], clickable: true }),
    );
    const candidates = buildCandidates(observation);
    const dupes = candidates.filter((candidate) => candidate.label === "Sign in");
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.source).toBe("webview");
  });

  test("indices are stable across two builds of the same observation", () => {
    const observation = baseObservation();
    expect(buildCandidates(observation)).toEqual(buildCandidates(observation));
  });
});

describe("capCandidates", () => {
  test("an oversized set returns regions with counts summing to the total", () => {
    const observation = baseObservation();
    observation.webview?.elements.push(
      ...Array.from({ length: 400 }, (_, index) =>
        webviewElement(1000 + index, {
          cssSelector: `#bulk-${index}`,
          text: `Bulk ${index}`,
          bounds: [(index % 40) * 30, Math.floor(index / 40) * 40, 20, 20],
        }),
      ),
    );
    const candidates = buildCandidates(observation);
    expect(candidates.length).toBeGreaterThan(DEFAULT_CANDIDATE_LIMIT);
    const capped = capCandidates(candidates);
    expect(capped.kind).toBe("regions");
    if (capped.kind !== "regions") {
      return;
    }
    expect(capped.total).toBe(candidates.length);
    expect(capped.regions.reduce((sum, region) => sum + region.count, 0)).toBe(candidates.length);
  });

  test("a set under the limit returns direct with every candidate", () => {
    const candidates = buildCandidates(baseObservation());
    const capped = capCandidates(candidates, DEFAULT_CANDIDATE_LIMIT);
    expect(capped.kind).toBe("direct");
    if (capped.kind !== "direct") {
      return;
    }
    expect(capped.candidates).toHaveLength(candidates.length);
  });
});

describe("resolveTarget", () => {
  test("a matching selector resolves through the selector strategy", () => {
    const resolution = resolveTarget({ kind: "selector", cssSelector: "#el-3" }, baseObservation());
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) {
      return;
    }
    expect(resolution.strategy).toBe("selector");
    expect(resolution.point).toEqual({ x: 55, y: 45 });
  });

  test("a missing selector with matching text falls back and reports it", () => {
    const observation = baseObservation();
    observation.webview?.elements.push(
      webviewElement(300, { cssSelector: "#other", text: "nope", bounds: [0, 0, 60, 20] }),
    );
    const resolution = resolveTarget({ kind: "selector", cssSelector: "#nope" }, observation);
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) {
      return;
    }
    expect(resolution.strategy).toBe("text");
  });

  test("a target matching nothing misses with a reason and never a point", () => {
    const resolution = resolveTarget(
      { kind: "selector", cssSelector: "#absent" },
      baseObservation(),
    );
    expect(resolution.ok).toBe(false);
    if (resolution.ok) {
      return;
    }
    expect(resolution.reason).toContain("#absent");
  });

  test("a point target resolves to exactly that point", () => {
    const resolution = resolveTarget({ kind: "point", x: 123, y: 456 }, baseObservation());
    expect(resolution).toEqual({
      ok: true,
      point: { x: 123, y: 456 },
      strategy: "point",
      candidateIndex: null,
    });
  });
});

describe("validateDecisionTarget", () => {
  test("rejects an index outside the observation range and accepts one inside", () => {
    const observation = baseObservation();
    expect(validateDecisionTarget(decisionWithIndex(9999), observation)).toBe(false);
    expect(validateDecisionTarget(decisionWithIndex(0), observation)).toBe(true);
  });
});

describe("icon-only native controls survive the WebView merge", () => {
  /**
   * Reproduces the Presalio failure: an icon-only toolbar control carries its
   * meaning in contentDesc and no text, and the WebView element covering the
   * same pixels is an unlabelled link. Before the fix the native candidate was
   * dropped as a duplicate, so the only label that identified it was lost.
   */
  function iconOnlyObservation(): Observation {
    return {
      native: {
        controls: [
          {
            index: 5,
            bounds: [780, 140, 120, 120],
            className: "android.view.View",
            text: "",
            contentDesc: "search",
            clickable: true,
            enabled: true,
          },
        ],
        packageName: "com.presalio.app",
        activity: "",
        systemUi: { keyboardVisible: false, dialogPresent: false },
      },
      webview: {
        elements: [
          {
            index: 0,
            cssSelector: ".navbar-action-surface",
            role: "link",
            text: "",
            enabled: true,
            visible: true,
            bounds: [784, 144, 112, 112],
            isInput: false,
            inputType: null,
          },
        ],
      },
      signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
      visual: { screenshotRef: "" },
    };
  }

  test("a contentDesc-only control is not swallowed by an unlabelled WebView element", () => {
    const candidates = buildCandidates(iconOnlyObservation());
    expect(candidates.some((candidate) => candidate.label === "search")).toBe(true);
  });

  test("the control is reachable by an exact text target", () => {
    const observation = iconOnlyObservation();
    const resolution = resolveTarget({ kind: "text", text: "search", exact: true }, observation);
    expect(resolution.ok).toBe(true);
  });

  test("a genuinely matching label still dedupes to the WebView entry", () => {
    const base = iconOnlyObservation();
    const webview = base.webview;
    if (webview === null) {
      throw new Error("fixture must carry a webview layer");
    }
    const observation: Observation = {
      ...base,
      native: {
        ...base.native,
        controls: [{ ...base.native.controls[0], text: "Stock", contentDesc: "inventory_2 Stock" }],
      },
      webview: { elements: [{ ...webview.elements[0], text: "Stock" }] },
    };
    const candidates = buildCandidates(observation);
    expect(candidates.filter((candidate) => candidate.label === "Stock")).toHaveLength(1);
    expect(candidates[0].source).toBe("webview");
  });
});

describe("accessible names label icon-only WebView controls", () => {
  /**
   * The Presalio Stock screen, measured on device: the search icon is an
   * `<a href="/stock/search/">` with an SVG and no text, and Android's native
   * layer exposes the same control as contentDesc "search".
   */
  function stockToolbar(withNative: boolean): Observation {
    return {
      native: {
        controls: withNative
          ? [
              {
                index: 5,
                bounds: [780, 140, 120, 120],
                className: "android.view.View",
                text: "",
                contentDesc: "search",
                clickable: true,
                enabled: true,
              },
            ]
          : [],
        packageName: "com.presalio.app",
        activity: "",
        systemUi: { keyboardVisible: false, dialogPresent: false },
      },
      webview: {
        elements: [
          webviewElement(0, {
            cssSelector: "a.navbar-action-surface:nth-of-type(1)",
            role: "a",
            text: "",
            name: "search",
            bounds: [784, 144, 112, 112],
          }),
          webviewElement(1, {
            cssSelector: "a.navbar-action-surface:nth-of-type(2)",
            role: "a",
            text: "",
            name: "",
            bounds: [920, 144, 112, 112],
          }),
        ],
      },
      signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
      visual: { screenshotRef: "" },
    };
  }

  test("an icon-only link is labelled by its accessible name, not its role", () => {
    const labels = buildCandidates(stockToolbar(false)).map((candidate) => candidate.label);
    expect(labels).toContain("search");
  });

  test("a text target resolves to the WebView element, which carries the stable selector", () => {
    const observation = stockToolbar(false);
    const resolution = resolveTarget({ kind: "text", text: "search", exact: true }, observation);
    expect(resolution.ok).toBe(true);
    const candidates = buildCandidates(observation);
    const chosen = candidates.find((candidate) => candidate.label === "search");
    expect(chosen?.source).toBe("webview");
    expect(chosen?.cssSelector).toBe("a.navbar-action-surface:nth-of-type(1)");
  });

  test("the native search control now dedupes into the named WebView link", () => {
    const candidates = buildCandidates(stockToolbar(true));
    const search = candidates.filter((candidate) => candidate.label === "search");
    expect(search).toHaveLength(1);
    expect(search[0]?.source).toBe("webview");
  });

  test("an element with visible text keeps it as the label even when named differently", () => {
    const observation = stockToolbar(false);
    const webview = observation.webview;
    if (webview === null) {
      throw new Error("fixture must carry a webview layer");
    }
    webview.elements = [
      webviewElement(0, { text: "Barquette Alu 420 cl SKU CC17", name: "Barquette Alu 420 cl" }),
    ];
    expect(buildCandidates(observation)[0]?.label).toBe("Barquette Alu 420 cl SKU CC17");
  });

  test("an input is labelled by its name, never by its value", () => {
    const observation = stockToolbar(false);
    const webview = observation.webview;
    if (webview === null) {
      throw new Error("fixture must carry a webview layer");
    }
    webview.elements = [
      webviewElement(0, { role: "input", text: "", name: "Search products", isInput: true }),
    ];
    expect(buildCandidates(observation)[0]?.label).toBe("Search products");
  });
});
