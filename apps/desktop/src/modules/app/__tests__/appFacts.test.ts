import { describe, expect, test } from "vite-plus/test";
import { appFacts, pageOrigin, runtimeWords, versionWords } from "../overview/appFacts";
import { parseRuntimeProbe, webViewVersionOf } from "../runtime/runtimeProbe";
import { PACKAGE } from "./fixtures";

const NOW = new Date(2026, 10, 5, 17, 0).getTime();
const UA =
  "Mozilla/5.0 (Linux; Android 14; 24117RN76G Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.81 Mobile Safari/537.36";

describe("about this app", () => {
  test("only what the phone or the page reported is listed", () => {
    const facts = appFacts(
      {
        packageName: PACKAGE,
        details: undefined,
        pageUrl: null,
        pageTitle: null,
        runtime: undefined,
        capacitor: null,
        pid: null,
        running: null,
      },
      NOW,
    );
    expect(facts.map((fact) => fact.key)).toEqual(["package"]);
  });

  test("a full picture of a running Capacitor app", () => {
    const facts = appFacts(
      {
        packageName: PACKAGE,
        details: {
          packageName: PACKAGE,
          versionName: "2.3.1",
          versionCode: "45",
          targetSdkVersion: 34,
          minSdkVersion: 23,
          installerPackageName: "null",
          firstInstallTime: "2026-11-03 13:46:00",
          lastUpdateTime: "2026-11-04 09:10:00",
        },
        pageUrl: "https://localhost/orders?id=3",
        pageTitle: "Orders",
        runtime: parseRuntimeProbe({
          userAgent: UA,
          capacitor: { platform: "android", native: true, plugins: ["Camera", "App"] },
          cordova: false,
        }),
        capacitor: null,
        pid: 4321,
        running: true,
      },
      NOW,
    );
    const byKey = Object.fromEntries(facts.map((fact) => [fact.key, fact]));
    expect(Object.keys(byKey)).toEqual([
      "package",
      "version",
      "android",
      "installed",
      "updated",
      "page",
      "webview",
      "runtime",
      "process",
    ]);
    expect(byKey.version?.value).toBe("2.3.1 (45)");
    expect(byKey.android?.value).toBe("Targets API 34, runs from API 23");
    expect(byKey.page).toMatchObject({
      value: "https://localhost",
      detail: "Orders",
      copy: "https://localhost/orders?id=3",
    });
    expect(byKey.webview?.value).toBe("Chrome 131.0.6778.81");
    expect(byKey.runtime).toMatchObject({
      value: "Capacitor",
      detail: "2 plugins",
      hint: "App, Camera",
    });
    expect(byKey.process?.value).toBe("PID 4321");
  });

  test("a stopped app says so instead of a PID", () => {
    const facts = appFacts({
      packageName: PACKAGE,
      details: undefined,
      pageUrl: null,
      pageTitle: null,
      runtime: undefined,
      capacitor: null,
      pid: null,
      running: false,
    });
    expect(facts.at(-1)).toMatchObject({ key: "process", value: "Not running", quiet: true });
  });

  test("page origins fall back to the address for local pages", () => {
    expect(pageOrigin("https://localhost/a/b")).toBe("https://localhost");
    expect(pageOrigin("file:///android_asset/public/index.html")).toBe(
      "file:///android_asset/public/index.html",
    );
    expect(pageOrigin(null)).toBeNull();
    expect(versionWords({ packageName: PACKAGE, versionName: "null" })).toBeNull();
  });

  test("the bridge comes from the page first, the package second", () => {
    expect(runtimeWords(undefined, null)).toBeNull();
    expect(
      runtimeWords(undefined, {
        isCapacitor: true,
        bridgeActivity: "com.getcapacitor.BridgeActivity",
        plugins: [],
        version: null,
      }),
    ).toMatchObject({ value: "Capacitor", detail: "from the package" });
    const plain = parseRuntimeProbe({ userAgent: UA, capacitor: null, cordova: false });
    expect(runtimeWords(plain, null)).toMatchObject({ quiet: true });
    expect(runtimeWords(parseRuntimeProbe({ cordova: true }), null)?.value).toBe("Cordova");
  });

  test("a malformed probe answer reads as unknown", () => {
    expect(parseRuntimeProbe("nonsense")).toEqual({
      userAgent: null,
      webViewVersion: null,
      capacitor: null,
      cordova: false,
    });
    expect(webViewVersionOf("Mozilla/5.0 Firefox/120")).toBeNull();
  });
});
