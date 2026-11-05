import { describe, expect, test } from "vite-plus/test";
import type { AdbPackage } from "@/types/adb.types";
import {
  appActionCommand,
  appActionOutcome,
  appActionRequest,
  appDisplayName,
  appFolders,
  countApps,
  filterApps,
  totalAppSize,
} from "../appsModel";

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
  test("names fall back to the package", () => {
    expect(appDisplayName(app("a.b", false, "  "))).toBe("a.b");
    expect(appDisplayName(app("a.b", false, "Alpha"))).toBe("Alpha");
  });

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

  test("adds up only the sizes the phone reported", () => {
    expect(totalAppSize(undefined)).toBeNull();
    expect(totalAppSize({ packageName: "x" })).toBeNull();
    expect(totalAppSize({ packageName: "x", appSize: 10, dataSize: null, cacheSize: 5 })).toBe(15);
  });

  test("folders fall back to the usual places and never repeat", () => {
    const presalio = packages[0] as AdbPackage;
    expect(appFolders(presalio, undefined).map((f) => f.path)).toEqual([
      "/data/data/com.sig.presalio",
      "/sdcard/Android/data/com.sig.presalio",
      "/data/app/com.sig.presalio",
    ]);
    const folders = appFolders(presalio, {
      packageName: "com.sig.presalio",
      dataDir: "/data/user/0/com.sig.presalio",
      externalDataDir: "/data/user/0/com.sig.presalio",
      obbDir: "/sdcard/Android/obb/com.sig.presalio",
    });
    expect(folders.map((f) => f.key)).toEqual(["internal", "obb", "apk"]);
    const nullDir = appFolders(presalio, { packageName: "com.sig.presalio", dataDir: "null" });
    expect(nullDir[0]?.path).toBe("/data/data/com.sig.presalio");
  });

  test("actions map to their shell command, question and outcome", () => {
    expect(appActionCommand("forceStop", "a.b")).toBe("am force-stop a.b");
    expect(appActionCommand("clearData", "a.b")).toBe("pm clear a.b");
    expect(appActionCommand("uninstall", "a.b")).toBe("pm uninstall a.b");
    expect(appActionRequest("uninstall", "Alpha")).toMatchObject({
      danger: true,
      confirmLabel: "Uninstall",
    });
    expect(appActionRequest("forceStop", "Alpha").danger).toBe(false);
    expect(appActionOutcome("clearData", "Alpha", "Success\n").ok).toBe(true);
    expect(
      appActionOutcome("uninstall", "Alpha", "Failure [DELETE_FAILED_INTERNAL_ERROR]"),
    ).toEqual({
      ok: false,
      title: "Could not uninstall",
      description: "Failure [DELETE_FAILED_INTERNAL_ERROR]",
    });
    expect(appActionOutcome("forceStop", "Alpha", "").ok).toBe(true);
  });
});
