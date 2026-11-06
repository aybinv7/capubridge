import { describe, expect, test } from "vite-plus/test";
import {
  appTargetId,
  buildAppTargets,
  createAppTarget,
  hasDevToolsEndpoint,
  isNativeAppTarget,
} from "@/lib/app-target";
import type { CDPTarget } from "@/types/cdp.types";

function webview(packageName: string, serial = "S1"): CDPTarget {
  return {
    id: `wv:${packageName}`,
    type: "page",
    title: packageName,
    url: "https://localhost/",
    source: "adb",
    deviceSerial: serial,
    packageName,
    webSocketDebuggerUrl: "ws://127.0.0.1:53000/devtools/page/1",
  };
}

describe("createAppTarget", () => {
  test("names the app by its label and never invents a web address", () => {
    const target = createAppTarget("S1", "com.example.notes", " Notes ");
    expect(target).toEqual({
      id: "app:S1:com.example.notes",
      type: "app",
      title: "Notes",
      url: "android-app://com.example.notes",
      source: "adb",
      deviceSerial: "S1",
      packageName: "com.example.notes",
    });
    expect(target.webSocketDebuggerUrl).toBeUndefined();
  });

  test("falls back to the package when no label is known", () => {
    expect(createAppTarget("S1", "com.example.notes").title).toBe("com.example.notes");
    expect(appTargetId("S1", "a.b")).toBe("app:S1:a.b");
  });
});

describe("DevTools reachability", () => {
  test("an app target has no DevTools endpoint", () => {
    const app = createAppTarget("S1", "com.example.notes");
    expect(isNativeAppTarget(app)).toBe(true);
    expect(hasDevToolsEndpoint(app)).toBe(false);
  });

  test("a WebView needs its socket URL", () => {
    expect(hasDevToolsEndpoint(webview("com.a.b"))).toBe(true);
    expect(hasDevToolsEndpoint({ ...webview("com.a.b"), webSocketDebuggerUrl: undefined })).toBe(
      false,
    );
    expect(isNativeAppTarget(webview("com.a.b"))).toBe(false);
    expect(hasDevToolsEndpoint(null)).toBe(false);
  });
});

describe("buildAppTargets", () => {
  const base = {
    serial: "S1",
    packages: ["com.native.app", "com.hybrid.app"],
    labels: { "com.native.app": "Native" },
    keepPackage: null,
  };

  test("skips apps whose WebView is live, including a secondary process", () => {
    const targets = buildAppTargets({
      ...base,
      webviewTargets: [webview("com.hybrid.app:sandboxed")],
    });
    expect(targets.map((target) => target.id)).toEqual(["app:S1:com.native.app"]);
    expect(targets[0].title).toBe("Native");
  });

  test("ignores WebViews of another device", () => {
    const targets = buildAppTargets({ ...base, webviewTargets: [webview("com.hybrid.app", "S2")] });
    expect(targets).toHaveLength(2);
  });

  test("keeps the selected app even once its WebView appears", () => {
    const targets = buildAppTargets({
      ...base,
      webviewTargets: [webview("com.hybrid.app")],
      keepPackage: "com.hybrid.app",
    });
    expect(targets.map((target) => target.packageName)).toEqual([
      "com.native.app",
      "com.hybrid.app",
    ]);
  });
});
