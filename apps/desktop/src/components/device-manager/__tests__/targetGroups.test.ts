import { describe, expect, it } from "vite-plus/test";
import type { CDPTarget } from "@/types/cdp.types";
import { groupTargetsByApp, targetDisplayTitle, targetTypeLabel } from "../targetGroups";

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
    expect(targetDisplayTitle({ title: " Shop ", url: "https://x" })).toBe("Shop");
    expect(targetDisplayTitle({ title: "", url: "https://localhost/app" })).toBe("localhost/app");
    expect(targetDisplayTitle({ title: "", url: "" })).toBe("Untitled");
  });
});

describe("targetTypeLabel", () => {
  it("names each DevTools type in sentence case", () => {
    expect(targetTypeLabel({ type: "page" })).toBe("Page");
    expect(targetTypeLabel({ type: "background_page" })).toBe("Background page");
  });
});
