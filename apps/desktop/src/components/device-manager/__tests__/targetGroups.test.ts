import { describe, expect, it } from "vite-plus/test";
import type { CDPTarget } from "@/types/cdp.types";
import {
  describeTargetLines,
  appPackageOf,
  groupTargetsByApp,
  isUnansweredSocket,
  socketDisplayName,
  targetDisplayTitle,
  targetKindHint,
  targetTypeLabel,
  unansweredSocketHint,
  unansweredSocketOf,
} from "../targetGroups";

function target(id: string, overrides: Partial<CDPTarget> = {}): CDPTarget {
  return {
    id,
    type: "page",
    title: id,
    url: `https://localhost/${id}`,
    source: "adb",
    deviceSerial: "R58",
    ...overrides,
  };
}

describe("groupTargetsByApp", () => {
  it("groups by package and keeps reported order", () => {
    const groups = groupTargetsByApp(
      [
        target("a", { packageName: "com.one" }),
        target("b", { packageName: "com.two" }),
        target("c", { packageName: "com.one" }),
      ],
      null,
    );
    expect(groups.map((group) => group.packageName)).toEqual(["com.one", "com.two"]);
    expect(groups[0].targets.map((entry) => entry.id)).toEqual(["a", "c"]);
  });

  it("collects targets without a package under null", () => {
    const groups = groupTargetsByApp([target("a"), target("b", { packageName: " " })], null);
    expect(groups).toHaveLength(1);
    expect(groups[0].packageName).toBeNull();
  });

  it("treats an unknown package like a missing one", () => {
    expect(appPackageOf({ packageName: "unknown" })).toBeNull();
    expect(appPackageOf({ packageName: " com.one " })).toBe("com.one");
    const groups = groupTargetsByApp([target("a", { packageName: "unknown" }), target("b")], null);
    expect(groups).toHaveLength(1);
    expect(groups[0].packageName).toBeNull();
  });

  it("lists targets no app was matched to after every app", () => {
    const groups = groupTargetsByApp(
      [
        target("a"),
        target("b", { packageName: "com.one" }),
        target("c", { packageName: "com.two" }),
      ],
      null,
    );
    expect(groups.map((group) => group.packageName)).toEqual(["com.one", "com.two", null]);
  });

  it("keeps the unmatched group first when it holds the selected target", () => {
    const groups = groupTargetsByApp([target("a", { packageName: "com.one" }), target("b")], "b");
    expect(groups.map((group) => group.packageName)).toEqual([null, "com.one"]);
  });

  it("puts the app holding the selected target first", () => {
    const groups = groupTargetsByApp(
      [target("a", { packageName: "com.one" }), target("b", { packageName: "com.two" })],
      "b",
    );
    expect(groups.map((group) => [group.packageName, group.hasActive])).toEqual([
      ["com.two", true],
      ["com.one", false],
    ]);
  });

  it("orders pages before frames and workers inside an app", () => {
    const groups = groupTargetsByApp(
      [
        target("w", { packageName: "com.one", type: "worker" }),
        target("f", { packageName: "com.one", type: "iframe" }),
        target("p", { packageName: "com.one", type: "page" }),
      ],
      null,
    );
    expect(groups[0].targets.map((entry) => entry.id)).toEqual(["p", "f", "w"]);
  });
});

describe("targetDisplayTitle", () => {
  it("prefers the title, then the URL without its scheme", () => {
    expect(targetDisplayTitle({ id: "1", title: " Shop ", url: "https://x" })).toBe("Shop");
    expect(targetDisplayTitle({ id: "2", title: "", url: "https://localhost/app" })).toBe(
      "localhost/app",
    );
    expect(targetDisplayTitle({ id: "3", title: "", url: "" })).toBe("Untitled");
  });

  it("names an unanswered DevTools socket in plain words", () => {
    const chrome = {
      id: "adb:10.0.0.2:5555:chrome_devtools_remote",
      title: "chrome_devtools_remote",
      url: "",
    };
    expect(isUnansweredSocket(chrome)).toBe(true);
    expect(targetDisplayTitle(chrome)).toBe("Chrome browser");
    expect(
      targetDisplayTitle({
        id: "adb:R58:webview_devtools_remote_812",
        title: "webview_devtools_remote_812",
        url: "",
      }),
    ).toBe("WebView in process 812");
    expect(isUnansweredSocket({ id: "page-1", title: "Shop", url: "" })).toBe(false);
  });

  it("knows a socket whose title also names the app's package", () => {
    const socket = {
      id: "adb:r4geda5p7d65u8uo:webview_devtools_remote_19350",
      title: "webview_devtools_remote_19350 (com.presalio.retail)",
      url: "",
    };
    expect(unansweredSocketOf(socket)).toBe("webview_devtools_remote_19350");
    expect(targetDisplayTitle(socket)).toBe("WebView in process 19350");
    expect(
      unansweredSocketOf({ id: "adb:x:webview_devtools_remote_1", title: "Shop", url: "" }),
    ).toBeNull();
  });
});

describe("socket wording", () => {
  it("explains what to do for Chrome and for any other socket", () => {
    expect(socketDisplayName("custom_socket")).toBe("custom_socket");
    expect(unansweredSocketHint("chrome_devtools_remote")).toMatch(/Open a page in Chrome/);
    expect(unansweredSocketHint("webview_devtools_remote_1")).toMatch(/Bring the app to the front/);
    expect(unansweredSocketHint("webview_devtools_remote_1", true)).toMatch(
      /open the app on the phone/,
    );
  });
});

describe("targetKindHint", () => {
  it("says nothing for a page and names every other kind", () => {
    expect(targetKindHint({ type: "page" })).toBeNull();
    expect(targetKindHint({ type: "worker" })).toBe("Worker");
    expect(targetKindHint({ type: "iframe" })).toBe("Frame");
  });
});

describe("targetTypeLabel", () => {
  it("names each DevTools type in sentence case", () => {
    expect(targetTypeLabel({ type: "page" })).toBe("Page");
    expect(targetTypeLabel({ type: "background_page" })).toBe("Background page");
  });
});

describe("describeTargetLines", () => {
  const page = (title: string, url: string) => ({ id: "t", title, url });

  it("shows the route of a page an app serves itself, not its shared origin", () => {
    expect(describeTargetLines(page("efficy", "https://localhost/u"), "Efficy [Dev]")).toEqual({
      title: "efficy",
      detail: "/u",
    });
    expect(describeTargetLines(page("Shop", "capacitor://localhost/#/cart"), "Store")).toEqual({
      title: "Shop",
      detail: "/#/cart",
    });
  });

  it("names the main screen when the title only repeats the app", () => {
    expect(
      describeTargetLines(page("Presalio Retail", "https://localhost/"), "Presalio Retail"),
    ).toEqual({ title: "Main screen", detail: null });
  });

  it("keeps the full URL for a page on the web", () => {
    expect(describeTargetLines(page("Docs", "https://example.com/a"), "Chrome")).toEqual({
      title: "Docs",
      detail: "https://example.com/a",
    });
  });
});
