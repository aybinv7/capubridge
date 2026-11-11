import { describe, test, expect } from "vite-plus/test";
import {
  REACT_CAPABILITY_PROBE_EXPRESSION,
  REACT_FIBER_KEY_PATTERN,
  REACT_RENDERER_REGISTRATION_EXPRESSION,
  describeReactBuild,
  interpretReactCapability,
  isReactRendererRegistered,
  parseReactCapabilityProbe,
} from "../capability";
import type { ReactCapabilityProbe } from "../capability";

const baseProbe: ReactCapabilityProbe = {
  hasFibers: true,
  hasHook: true,
  rendererCount: 0,
  reactVersion: null,
  isDevelopmentBuild: false,
  backendAlreadyAttached: false,
};

describe("REACT_FIBER_KEY_PATTERN", () => {
  test("matches the fiber keys react-dom attaches to DOM nodes", () => {
    expect(REACT_FIBER_KEY_PATTERN.test("__reactFiber$abc123")).toBe(true);
    expect(REACT_FIBER_KEY_PATTERN.test("__reactContainer$abc123")).toBe(true);
    expect(REACT_FIBER_KEY_PATTERN.test("__reactInternalInstance$x")).toBe(true);
    expect(REACT_FIBER_KEY_PATTERN.test("_reactRootContainer")).toBe(true);
  });

  test("does not match unrelated keys", () => {
    expect(REACT_FIBER_KEY_PATTERN.test("__vueParentComponent")).toBe(false);
    expect(REACT_FIBER_KEY_PATTERN.test("reactFiber")).toBe(false);
    expect(REACT_FIBER_KEY_PATTERN.test("className")).toBe(false);
  });
});

describe("REACT_CAPABILITY_PROBE_EXPRESSION", () => {
  test("is a single JSON-returning expression", () => {
    expect(REACT_CAPABILITY_PROBE_EXPRESSION.startsWith("JSON.stringify(")).toBe(true);
    expect(REACT_CAPABILITY_PROBE_EXPRESSION).toContain("__REACT_DEVTOOLS_GLOBAL_HOOK__");
    expect(REACT_CAPABILITY_PROBE_EXPRESSION).toContain("bundleType");
  });

  test("bounds the element scan like the Vue probe", () => {
    expect(REACT_CAPABILITY_PROBE_EXPRESSION).toContain("Math.min(elements.length, 3000)");
  });
});

describe("isReactRendererRegistered", () => {
  test("is false without a hook or renderers", () => {
    expect(isReactRendererRegistered(undefined)).toBe(false);
    expect(isReactRendererRegistered(null)).toBe(false);
    expect(isReactRendererRegistered({})).toBe(false);
  });

  test("is false while the hook exists but react-dom booted first", () => {
    expect(isReactRendererRegistered({ renderers: new Map() })).toBe(false);
  });

  test("is true once a renderer registered", () => {
    expect(isReactRendererRegistered({ renderers: new Map([[1, {}]]) })).toBe(true);
  });
});

describe("REACT_RENDERER_REGISTRATION_EXPRESSION", () => {
  test("serializes the shared predicate against the global hook", () => {
    expect(REACT_RENDERER_REGISTRATION_EXPRESSION).toContain("__REACT_DEVTOOLS_GLOBAL_HOOK__");
    expect(REACT_RENDERER_REGISTRATION_EXPRESSION.startsWith("(function")).toBe(true);
  });
});

describe("parseReactCapabilityProbe", () => {
  test("round-trips the probe payload", () => {
    expect(parseReactCapabilityProbe(JSON.stringify(baseProbe))).toEqual(baseProbe);
    expect(parseReactCapabilityProbe({ ...baseProbe })).toEqual(baseProbe);
  });

  test("returns null for unusable values", () => {
    expect(parseReactCapabilityProbe(null)).toBeNull();
    expect(parseReactCapabilityProbe("not json")).toBeNull();
    expect(parseReactCapabilityProbe({})).toBeNull();
  });

  test("coerces missing fields to safe defaults", () => {
    expect(parseReactCapabilityProbe({ hasFibers: true })).toEqual({
      hasFibers: true,
      hasHook: false,
      rendererCount: 0,
      reactVersion: null,
      isDevelopmentBuild: false,
      backendAlreadyAttached: false,
    });
  });
});

describe("describeReactBuild", () => {
  test("is unknown until a renderer registers, since bundleType lives there", () => {
    // Regression: the panel claimed "production" from a default false.
    expect(describeReactBuild(baseProbe)).toBe("unknown");
    expect(describeReactBuild({ ...baseProbe, isDevelopmentBuild: false })).toBe("unknown");
  });

  test("reports the observed build once a renderer registered", () => {
    expect(describeReactBuild({ ...baseProbe, rendererCount: 1 })).toBe("production");
    expect(describeReactBuild({ ...baseProbe, rendererCount: 1, isDevelopmentBuild: true })).toBe(
      "development",
    );
  });
});

describe("interpretReactCapability", () => {
  test("flags a hook that missed react-dom's boot as needing a reload", () => {
    const report = interpretReactCapability({ ...baseProbe, hasHook: true });
    expect(report.kind).toBe("hook-missed-boot");
    expect(report.title).toContain("booted before");
    expect(report.detail).toContain("reload");
  });

  test("distinguishes an absent hook from one that lost the race", () => {
    // The live conference-app reading: fibers present, hook absent, 0 renderers.
    const report = interpretReactCapability({ ...baseProbe, hasHook: false });
    expect(report.kind).toBe("hook-missed-boot");
    expect(report.title).toBe("No DevTools hook installed yet");
    expect(report.detail).toContain("nothing has installed");
  });

  test("never claims a build type without a registered renderer", () => {
    expect(interpretReactCapability({ ...baseProbe, hasHook: false }).hint).toBeNull();
    expect(interpretReactCapability({ ...baseProbe, hasHook: true }).hint).toBeNull();
  });

  test("treats a registered renderer as ready", () => {
    const report = interpretReactCapability({
      ...baseProbe,
      rendererCount: 1,
      reactVersion: "19.0.0",
      isDevelopmentBuild: true,
    });
    expect(report.kind).toBe("ready");
    expect(report.title).toContain("19.0.0");
    expect(report.hint).toBeNull();
  });

  test("warns about minified names on a production build but still attaches", () => {
    // Unlike Vue, a production React build is inspectable — only names suffer.
    const report = interpretReactCapability({
      ...baseProbe,
      rendererCount: 1,
      isDevelopmentBuild: false,
    });
    expect(report.kind).toBe("ready");
    expect(report.hint).toContain("minified");
  });

  test("reports a target without React", () => {
    const report = interpretReactCapability({ ...baseProbe, hasFibers: false, hasHook: false });
    expect(report.kind).toBe("no-react");
  });

  test("reports an unreadable probe", () => {
    expect(interpretReactCapability(null).kind).toBe("unknown");
  });
});
