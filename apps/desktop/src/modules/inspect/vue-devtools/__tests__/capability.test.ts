import { describe, test, expect } from "vite-plus/test";
import {
  VUE_APP_REGISTRATION_EXPRESSION,
  VUE_CAPABILITY_PROBE_EXPRESSION,
  interpretVueCapability,
  isAppRegisteredOnHook,
  isVueIntrospectable,
  parseAppRegistration,
  parseVueCapabilityProbe,
} from "../capability";
import type { VueCapabilityProbe } from "../capability";

const baseProbe: VueCapabilityProbe = {
  hasVueApp: true,
  vueVersion: "3.6.0-beta.10",
  hasDevtoolsHook: false,
  hookAppRecords: 0,
  hasAppInstance: false,
  hasElementBackrefs: false,
};

describe("VUE_CAPABILITY_PROBE_EXPRESSION", () => {
  test("is a single JSON-returning expression", () => {
    expect(VUE_CAPABILITY_PROBE_EXPRESSION.startsWith("JSON.stringify(")).toBe(true);
    expect(VUE_CAPABILITY_PROBE_EXPRESSION).toContain("__vue_app__");
    expect(VUE_CAPABILITY_PROBE_EXPRESSION).toContain("__vueParentComponent");
    expect(VUE_CAPABILITY_PROBE_EXPRESSION).toContain("__VUE_DEVTOOLS_GLOBAL_HOOK__");
  });

  test("bounds the element scan", () => {
    expect(VUE_CAPABILITY_PROBE_EXPRESSION).toContain("Math.min(elements.length, 3000)");
  });
});

describe("isAppRegisteredOnHook", () => {
  test("is false without a hook", () => {
    expect(isAppRegisteredOnHook(undefined)).toBe(false);
    expect(isAppRegisteredOnHook(null)).toBe(false);
  });

  test("is false while the hook exists but Vue never adopted it", () => {
    // The exact live Presalio state: injected too late, replay window expired.
    expect(isAppRegisteredOnHook({ enabled: false, apps: [], appRecords: [] })).toBe(false);
    expect(isAppRegisteredOnHook({ enabled: false, apps: [{}], appRecords: [] })).toBe(false);
  });

  test("is false when adopted but no app registered yet", () => {
    expect(isAppRegisteredOnHook({ enabled: true, apps: [], appRecords: [] })).toBe(false);
  });

  test("is true once an app registered on an adopted hook", () => {
    expect(isAppRegisteredOnHook({ enabled: true, apps: [{}], appRecords: [] })).toBe(true);
    expect(isAppRegisteredOnHook({ enabled: true, apps: [], appRecords: [{}] })).toBe(true);
  });
});

describe("VUE_APP_REGISTRATION_EXPRESSION", () => {
  test("serializes the shared predicate against the global hook", () => {
    expect(VUE_APP_REGISTRATION_EXPRESSION).toContain("__VUE_DEVTOOLS_GLOBAL_HOOK__");
    expect(VUE_APP_REGISTRATION_EXPRESSION).toContain("appRecords");
    expect(VUE_APP_REGISTRATION_EXPRESSION.startsWith("(function")).toBe(true);
  });
});

describe("parseAppRegistration", () => {
  test("only accepts a strict true", () => {
    expect(parseAppRegistration(true)).toBe(true);
    expect(parseAppRegistration("true")).toBe(false);
    expect(parseAppRegistration(1)).toBe(false);
    expect(parseAppRegistration(undefined)).toBe(false);
  });
});

describe("parseVueCapabilityProbe", () => {
  test("parses the JSON string returned by the probe", () => {
    const parsed = parseVueCapabilityProbe(JSON.stringify(baseProbe));
    expect(parsed).toEqual(baseProbe);
  });

  test("accepts an already-deserialized object", () => {
    expect(parseVueCapabilityProbe({ ...baseProbe })).toEqual(baseProbe);
  });

  test("returns null for unusable values", () => {
    expect(parseVueCapabilityProbe(null)).toBeNull();
    expect(parseVueCapabilityProbe("not json")).toBeNull();
    expect(parseVueCapabilityProbe({})).toBeNull();
  });

  test("coerces missing fields to safe defaults", () => {
    const parsed = parseVueCapabilityProbe({ hasVueApp: true });
    expect(parsed).toEqual({
      hasVueApp: true,
      vueVersion: null,
      hasDevtoolsHook: false,
      hookAppRecords: 0,
      hasAppInstance: false,
      hasElementBackrefs: false,
    });
  });
});

describe("isVueIntrospectable", () => {
  test("is false when Vue stripped every devtools back-reference", () => {
    expect(isVueIntrospectable(baseProbe)).toBe(false);
  });

  test("is true as soon as one back-reference survives", () => {
    expect(isVueIntrospectable({ ...baseProbe, hasAppInstance: true })).toBe(true);
    expect(isVueIntrospectable({ ...baseProbe, hasElementBackrefs: true })).toBe(true);
    expect(isVueIntrospectable({ ...baseProbe, hookAppRecords: 1 })).toBe(true);
  });
});

describe("interpretVueCapability", () => {
  test("reports a production build with devtools disabled", () => {
    // Exactly what the live Presalio staging target returns.
    const report = interpretVueCapability({ ...baseProbe, hasDevtoolsHook: true });
    expect(report.kind).toBe("prod-devtools-disabled");
    expect(report.detail).toContain("__VUE_PROD_DEVTOOLS__");
    expect(report.hint).toContain("__VUE_PROD_DEVTOOLS__");
  });

  test("reports a dev build as ready", () => {
    const report = interpretVueCapability({
      ...baseProbe,
      hasDevtoolsHook: true,
      hasAppInstance: true,
      hasElementBackrefs: true,
      hookAppRecords: 1,
    });
    expect(report.kind).toBe("ready");
    expect(report.hint).toBeNull();
  });

  test("reports a target without Vue", () => {
    const report = interpretVueCapability({ ...baseProbe, hasVueApp: false, vueVersion: null });
    expect(report.kind).toBe("no-vue");
  });

  test("reports an unreadable probe", () => {
    expect(interpretVueCapability(null).kind).toBe("unknown");
  });
});
