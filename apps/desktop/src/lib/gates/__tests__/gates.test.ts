import { describe, expect, test } from "vite-plus/test";
import { gateSubjectKey, resolveGate } from "../resolve";
import { buildChain } from "../chain";
import { gateCopy, noticeCopy } from "../copy";
import { deriveLinkHealth, presentLink } from "../link";
import { INITIAL_PRESENCE, nextPresence, portFromWebSocketUrl } from "../presence";
import type { GateInput, GateKind } from "../types";

const onlineDevice = { serial: "phone-a", model: "Pixel 8", status: "online" as const };
const adbTarget = { id: "t1", source: "adb" as const, title: "Shop", packageName: "com.shop" };

function input(overrides: Partial<GateInput> = {}): GateInput {
  return {
    adb: "running",
    onlineDevices: 0,
    device: null,
    target: null,
    link: "none",
    linkError: null,
    presence: "unknown",
    ...overrides,
  };
}

function live(overrides: Partial<GateInput> = {}): GateInput {
  return input({
    onlineDevices: 1,
    device: onlineDevice,
    target: adbTarget,
    link: "connected",
    presence: "foreground",
    ...overrides,
  });
}

describe("resolveGate", () => {
  test("screens without requirements are always open", () => {
    expect(resolveGate("none", input())).toEqual({ kind: "open", notice: null });
  });

  test.each<[Partial<GateInput>, GateKind]>([
    [{}, "no-device"],
    [{ adb: "error" }, "adb-unavailable"],
    [{ device: { ...onlineDevice, status: "unauthorized" } }, "device-unauthorized"],
    [{ device: { ...onlineDevice, status: "no-permissions" } }, "device-unauthorized"],
    [{ device: { ...onlineDevice, status: "offline" } }, "device-offline"],
    [{ device: { ...onlineDevice, isStale: true } }, "device-offline"],
    [{ target: { id: "l", source: "local", title: "Local" } }, "needs-device"],
    [{ device: onlineDevice }, "open"],
  ])("device requirement with %j resolves to %s", (overrides, kind) => {
    expect(resolveGate("device", input(overrides)).kind).toBe(kind);
  });

  test("the first broken link wins for target screens", () => {
    expect(resolveGate("target", input()).kind).toBe("no-target");
    expect(
      resolveGate("target", live({ device: { ...onlineDevice, status: "offline" } })).kind,
    ).toBe("device-offline");
    expect(resolveGate("target", live({ presence: "gone" })).kind).toBe("gone");
    expect(resolveGate("target", live({ link: "connecting" })).kind).toBe("connecting");
    expect(resolveGate("target", live({ link: "idle" })).kind).toBe("idle");
    expect(resolveGate("target", live({ link: "disconnected" })).kind).toBe("disconnected");
    expect(resolveGate("target", live({ link: "error" })).kind).toBe("error");
    expect(resolveGate("target", live()).kind).toBe("open");
  });

  test("local targets need no device", () => {
    const local = input({
      target: { id: "l", source: "local", title: "Local" },
      link: "connected",
    });
    expect(resolveGate("target", local)).toEqual({ kind: "open", notice: null });
  });

  test("a background app is a notice, not a block", () => {
    expect(resolveGate("target", live({ presence: "background" }))).toEqual({
      kind: "open",
      notice: "background",
    });
    expect(resolveGate("app-target", live({ presence: "view-hidden" })).notice).toBe("view-hidden");
  });

  test("app screens need an android app target but no DevTools link", () => {
    expect(resolveGate("app-target", input()).kind).toBe("no-device");
    expect(resolveGate("app-target", input({ device: onlineDevice })).kind).toBe("no-target");
    expect(
      resolveGate(
        "app-target",
        input({ target: { id: "c", source: "chrome", title: "Tab" }, link: "connected" }),
      ).kind,
    ).toBe("needs-app-target");
    expect(resolveGate("app-target", live({ link: "disconnected" })).kind).toBe("open");
  });

  test("data screens open for an android app without its DevTools link", () => {
    expect(resolveGate("data", live({ link: "disconnected" }))).toEqual({
      kind: "open",
      notice: null,
    });
    expect(resolveGate("data", live({ link: "idle", presence: "background" }))).toEqual({
      kind: "open",
      notice: "background",
    });
    expect(resolveGate("data", live({ device: { ...onlineDevice, status: "offline" } })).kind).toBe(
      "device-offline",
    );
    expect(resolveGate("data", input({ device: onlineDevice })).kind).toBe("no-target");
  });

  test("data screens need the DevTools link for any other target", () => {
    const local = { id: "l", source: "local" as const, title: "Local" };
    expect(resolveGate("data", input({ target: local, link: "connected" })).kind).toBe("open");
    expect(resolveGate("data", input({ target: local, link: "connecting" })).kind).toBe(
      "connecting",
    );
    const bare = { id: "b", source: "adb" as const, title: "Shell" };
    expect(resolveGate("data", live({ target: bare, link: "idle" })).kind).toBe("idle");
    expect(resolveGate("data", live({ target: bare })).kind).toBe("open");
  });

  test("the data chain skips DevTools only for an app target", () => {
    expect(buildChain("data", live({ link: "idle" })).map((link) => link.key)).toEqual([
      "adb",
      "host",
      "target",
    ]);
    const local = { id: "l", source: "local" as const, title: "Local" };
    expect(
      buildChain("data", input({ target: local, link: "connected" })).map((link) => link.key),
    ).toEqual(["host", "target", "link"]);
  });

  test("the subject key follows what the screen shows", () => {
    expect(gateSubjectKey("data", live())).toBe("target:t1");
    expect(gateSubjectKey("device", live())).toBe("device:phone-a");
    expect(gateSubjectKey("target", live())).toBe("target:t1");
    expect(gateSubjectKey("none", live())).toBe("none");
  });
});

describe("native app targets", () => {
  const appTarget = { ...adbTarget, id: "app:phone-a:com.shop", native: true };

  function picked(overrides: Partial<GateInput> = {}): GateInput {
    return live({ target: appTarget, link: "none", presence: "unknown", ...overrides });
  }

  test("app and data screens open without a DevTools link", () => {
    expect(resolveGate("app-target", picked())).toEqual({ kind: "open", notice: null });
    expect(resolveGate("data", picked())).toEqual({ kind: "open", notice: null });
    expect(resolveGate("device", picked()).kind).toBe("open");
  });

  test("WebView screens say the app has none instead of waiting to attach", () => {
    expect(resolveGate("target", picked()).kind).toBe("needs-webview");
    expect(resolveGate("target", picked({ link: "error" })).kind).toBe("needs-webview");
  });

  test("a broken device still wins over the missing WebView", () => {
    const offline = picked({ device: { ...onlineDevice, status: "offline" } });
    expect(resolveGate("target", offline).kind).toBe("device-offline");
  });

  test("the chain shows the app and breaks at DevTools", () => {
    const chain = buildChain("target", picked());
    expect(chain.map((link) => [link.key, link.label, link.value, link.state])).toEqual([
      ["adb", "ADB", "running", "ok"],
      ["host", "Device", "Pixel 8", "ok"],
      ["target", "App", "com.shop", "ok"],
      ["link", "DevTools", "no WebView", "broken"],
    ]);
  });

  test("the gate names the app and offers SQLite and a rescan", () => {
    const content = gateCopy("needs-webview", picked(), "target");
    expect(content.title).toBe("Shop has no WebView");
    expect(content.detail).toContain("Data › SQLite");
    expect(content.actions).toEqual(["open-sqlite", "scan-targets"]);
  });

  test("the link reads native, never not attached", () => {
    expect(deriveLinkHealth("adb", "none", "unknown", true)).toBe("native");
    expect(presentLink("native")).toMatchObject({ label: "native", tone: "muted" });
  });
});

describe("buildChain", () => {
  test("marks the first break and quiets what follows", () => {
    const chain = buildChain("target", input({ device: onlineDevice }));
    expect(chain.map((link) => [link.key, link.state])).toEqual([
      ["adb", "ok"],
      ["host", "ok"],
      ["target", "broken"],
      ["link", "idle"],
    ]);
  });

  test("local targets skip ADB", () => {
    const chain = buildChain(
      "target",
      input({ target: { id: "l", source: "local", title: "Local" }, link: "connecting" }),
    );
    expect(chain.map((link) => link.key)).toEqual(["host", "target", "link"]);
    expect(chain[2]?.state).toBe("pending");
  });

  test("device screens show ADB and the device only", () => {
    const chain = buildChain(
      "device",
      input({ target: { id: "l", source: "local", title: "Local" } }),
    );
    expect(chain.map((link) => [link.key, link.state])).toEqual([
      ["adb", "ok"],
      ["host", "broken"],
    ]);
  });
});

describe("gate copy", () => {
  test("every blocking state names a next step except waiting", () => {
    const kinds: Exclude<GateKind, "open">[] = [
      "adb-unavailable",
      "no-device",
      "device-unauthorized",
      "device-offline",
      "needs-device",
      "no-target",
      "needs-app-target",
      "needs-webview",
      "idle",
      "gone",
      "disconnected",
      "error",
    ];
    for (const kind of kinds) {
      const content = gateCopy(kind, live(), "target");
      expect(content.title.length, kind).toBeGreaterThan(0);
      expect(content.actions.length, kind).toBeGreaterThan(0);
    }
    expect(gateCopy("connecting", live(), "target").tone).toBe("waiting");
  });

  test("first run lists steps, and switches to a picker once devices exist", () => {
    expect(gateCopy("no-device", input(), "device").steps?.length).toBe(3);
    const picker = gateCopy("no-device", input({ onlineDevices: 2 }), "device");
    expect(picker.title).toBe("Choose a device");
    expect(picker.steps).toBeUndefined();
  });

  test("background notice offers to bring the app back", () => {
    expect(noticeCopy("background", live()).actions).toEqual(["bring-to-front"]);
    expect(noticeCopy("background", live(), "Shop Retail").title).toBe(
      "Shop Retail is in the background",
    );
    expect(noticeCopy("background", live()).title).not.toContain("com.shop");
  });
});

describe("link health", () => {
  test("one derivation for every surface", () => {
    expect(deriveLinkHealth(null, "none", "unknown")).toBe("none");
    expect(deriveLinkHealth("adb", "connected", "foreground")).toBe("live");
    expect(deriveLinkHealth("adb", "connected", "background")).toBe("paused");
    expect(deriveLinkHealth("adb", "connected", "gone")).toBe("gone");
    expect(deriveLinkHealth("local", "connected", "background")).toBe("live");
    expect(deriveLinkHealth("adb", "error", "unknown")).toBe("failed");
    expect(presentLink("paused").tone).toBe("warning");
    expect(presentLink("paused").label).toBe("in the background");
  });
});

describe("presence", () => {
  test("one slow reply does not flip to background", () => {
    const once = nextPresence(
      { presence: "foreground", misses: 0 },
      {
        presence: "unresponsive",
        siblingVisible: false,
      },
    );
    expect(once.presence).toBe("foreground");
    const twice = nextPresence(once, { presence: "unresponsive", siblingVisible: false });
    expect(twice.presence).toBe("background");
  });

  test("a hidden view with a visible sibling is not background", () => {
    expect(
      nextPresence(INITIAL_PRESENCE, { presence: "hidden", siblingVisible: true }).presence,
    ).toBe("view-hidden");
    expect(
      nextPresence(INITIAL_PRESENCE, { presence: "hidden", siblingVisible: false }).presence,
    ).toBe("background");
  });

  test("reads the forwarded port from the debugger url", () => {
    expect(portFromWebSocketUrl("ws://127.0.0.1:9223/devtools/page/abc")).toBe(9223);
    expect(portFromWebSocketUrl("not a url")).toBeNull();
    expect(portFromWebSocketUrl(undefined)).toBeNull();
  });
});
