import { describe, expect, test } from "vite-plus/test";
import type { AdbPackage } from "@/types/adb.types";
import { countApps, filterApps, scopeShowing, sortApps } from "../appsModel";

function app(packageName: string, system = false, label?: string): AdbPackage {
  return {
    packageName,
    system,
    enabled: true,
    apkPath: `/data/app/${packageName}/base.apk`,
    label,
  };
}

const packages = [
  app("com.sig.presalio", false, "Presalio Retail"),
  app("com.android.settings", true, "Settings"),
  app("org.example.nolabel"),
];

describe("appsModel", () => {
  test("filters by scope and by name or package", () => {
    expect(filterApps(packages, "third-party", "").map((p) => p.packageName)).toEqual([
      "com.sig.presalio",
      "org.example.nolabel",
    ]);
    expect(filterApps(packages, "system", "").map((p) => p.packageName)).toEqual([
      "com.android.settings",
    ]);
    expect(filterApps(packages, "all", "PRESALIO")).toHaveLength(1);
    expect(filterApps(packages, "all", "example")).toHaveLength(1);
  });

  test("counts user and system apps", () => {
    expect(countApps(packages)).toEqual({ total: 3, system: 1, thirdParty: 2 });
  });

  test("sorting is done once with a natural, case-blind order and a stable tie", () => {
    const list = [app("b.two", false, "item 10"), app("a.one", false, "Item 9"), app("c", false)];
    expect(sortApps(list, { key: "name", desc: false }).map((a) => a.packageName)).toEqual([
      "c",
      "a.one",
      "b.two",
    ]);
    expect(sortApps(list, { key: "package", desc: true }).map((a) => a.packageName)).toEqual([
      "c",
      "b.two",
      "a.one",
    ]);
  });

  test("a scope shows only its kind; an app the listing lacks needs All", () => {
    expect(scopeShowing("third-party", { system: false })).toBe(true);
    expect(scopeShowing("third-party", { system: true })).toBe(false);
    expect(scopeShowing("system", null)).toBe(false);
    expect(scopeShowing("all", null)).toBe(true);
  });
});
