import { describe, expect, test } from "vite-plus/test";
import type { Observation, SessionSignalState } from "@/types/automation.types";
import { deriveSystemUi, observationFingerprint, observe, toScreenBounds } from "../observation";
import type {
  NativeHierarchyNode,
  NativeSnapshot,
  ObservationReaders,
  WebviewSnapshot,
} from "../observation";

/** Controllable promise for asserting concurrent reads resolve out of order. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function nativeSnapshot(): NativeSnapshot {
  return {
    controls: [
      {
        index: 0,
        bounds: [0, 100, 200, 50],
        className: "android.widget.Button",
        text: "Sign in",
        contentDesc: "",
        clickable: true,
        enabled: true,
      },
    ],
    packageName: "com.example.app",
    activity: "MainActivity",
    hierarchy: [{ className: "android.widget.FrameLayout" }],
  };
}

function webviewSnapshot(): WebviewSnapshot {
  return {
    elements: [
      {
        index: 0,
        cssSelector: "#signin",
        role: "button",
        text: "Sign in",
        enabled: true,
        visible: true,
        bounds: [10, 20, 100, 40],
        isInput: false,
        inputType: null,
      },
    ],
  };
}

function signalState(): SessionSignalState {
  return { pendingRequests: 2, recentErrors: ["TypeError: x"], lastDbWrite: "cart@12" };
}

function readers(overrides: Partial<ObservationReaders> = {}): ObservationReaders {
  return {
    readNative: () => Promise.resolve(nativeSnapshot()),
    readWebview: () => Promise.resolve(webviewSnapshot()),
    readSignals: () => signalState(),
    captureScreenshot: () => Promise.resolve("runs/abc/shot-1.png"),
    ...overrides,
  };
}

function fingerprintObservation(screenshotRef: string, recentErrors: string[]): Observation {
  const native = nativeSnapshot();
  return {
    native: { ...native, systemUi: deriveSystemUi(native.hierarchy) },
    webview: webviewSnapshot(),
    signals: { ...signalState(), recentErrors },
    visual: { screenshotRef },
  };
}

describe("observe", () => {
  test("all three reads succeed and concurrent reads resolve out of order", async () => {
    const nativeGate = deferred<NativeSnapshot>();
    const webviewGate = deferred<WebviewSnapshot | null>();
    const shotGate = deferred<string>();
    const pending = observe(
      readers({
        readNative: () => nativeGate.promise,
        readWebview: () => webviewGate.promise,
        captureScreenshot: () => shotGate.promise,
      }),
    );
    webviewGate.resolve(webviewSnapshot());
    shotGate.resolve("runs/abc/shot-9.png");
    nativeGate.resolve(nativeSnapshot());
    const observation = await pending;
    expect(observation.native.controls).toHaveLength(1);
    expect(observation.webview?.elements).toHaveLength(1);
    expect(observation.signals.pendingRequests).toBe(2);
    expect(observation.visual.screenshotRef).toBe("runs/abc/shot-9.png");
  });

  test("a null WebView layer keeps native and signals intact", async () => {
    const observation = await observe(readers({ readWebview: () => Promise.resolve(null) }));
    expect(observation.webview).toBeNull();
    expect(observation.native.controls).toHaveLength(1);
    expect(observation.signals.pendingRequests).toBe(2);
  });

  test("a rejecting WebView read degrades to null instead of propagating", async () => {
    const observation = await observe(
      readers({
        readWebview: () => Promise.reject(new Error("target gone")),
      }),
    );
    expect(observation.webview).toBeNull();
    expect(observation.native.packageName).toBe("com.example.app");
  });

  test("a rejecting native read fails naming the native layer", async () => {
    await expect(
      observe(readers({ readNative: () => Promise.reject(new Error("adb lost")) })),
    ).rejects.toThrow(/native layer/);
  });

  test("a throwing signal read falls back to zeroed signals", async () => {
    const observation = await observe(
      readers({
        readSignals: () => {
          throw new Error("store unavailable");
        },
      }),
    );
    expect(observation.signals).toEqual({
      pendingRequests: 0,
      recentErrors: [],
      lastDbWrite: null,
    });
    expect(observation.native.controls).toHaveLength(1);
  });

  test("a rejecting screenshot capture yields an empty ref", async () => {
    const observation = await observe(
      readers({ captureScreenshot: () => Promise.reject(new Error("shot failed")) }),
    );
    expect(observation.visual.screenshotRef).toBe("");
    expect(observation.native.controls).toHaveLength(1);
  });
});

describe("deriveSystemUi", () => {
  test("detects a keyboard from an input-method window", () => {
    const hierarchy: NativeHierarchyNode[] = [
      { className: "android.widget.FrameLayout" },
      { className: "android.inputmethodservice.SoftInputWindow", packageName: "com.example.app" },
    ];
    expect(deriveSystemUi(hierarchy)).toEqual({ keyboardVisible: true, dialogPresent: false });
  });

  test("detects a dialog from a modal native window", () => {
    const hierarchy: NativeHierarchyNode[] = [
      {
        className: "android.widget.FrameLayout",
        children: [{ className: "android.app.AlertDialog" }],
      },
    ];
    expect(deriveSystemUi(hierarchy)).toEqual({ keyboardVisible: false, dialogPresent: true });
  });

  test("a plain screen yields both false", () => {
    const hierarchy: NativeHierarchyNode[] = [
      {
        className: "android.widget.FrameLayout",
        children: [{ className: "android.widget.Button" }],
      },
    ];
    expect(deriveSystemUi(hierarchy)).toEqual({ keyboardVisible: false, dialogPresent: false });
  });
});

describe("toScreenBounds", () => {
  test("maps a WebView rect at scale 1 with no offset", () => {
    expect(toScreenBounds([10, 20, 100, 40], { x: 0, y: 0 }, 1)).toEqual([10, 20, 100, 40]);
  });

  test("maps with a status bar offset and a non-integer pixel ratio", () => {
    expect(toScreenBounds([10, 20, 100, 40], { x: 0, y: 72 }, 2.625)).toEqual([
      26.25, 124.5, 262.5, 105,
    ]);
  });
});

describe("observationFingerprint", () => {
  test("ignores screenshot bytes and volatile error text", () => {
    const base = fingerprintObservation("first", signalState().recentErrors);
    const changedVisual = fingerprintObservation("second", ["different error"]);
    expect(observationFingerprint(base)).toBe(observationFingerprint(changedVisual));
  });

  test("changes when the actionable screen changes", () => {
    const base = fingerprintObservation("", []);
    const changed = {
      ...base,
      native: {
        ...base.native,
        controls: base.native.controls.map((control) => ({ ...control, text: "Continue" })),
      },
    };
    expect(observationFingerprint(base)).not.toBe(observationFingerprint(changed));
  });
});
