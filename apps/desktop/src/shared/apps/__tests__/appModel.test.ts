import { describe, expect, test } from "vite-plus/test";
import type { AdbPackage } from "@/types/adb.types";
import {
  appActionCommand,
  appActionOutcome,
  appActionRequest,
  uninstallLabel,
} from "../appActions";
import { appFolders, totalAppSize } from "../appFolders";
import { appDisplayName } from "../appIdentity";

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

describe("shared app model", () => {
  test("names fall back to the package", () => {
    expect(appDisplayName(app("a.b", false, "  "))).toBe("a.b");
    expect(appDisplayName(app("a.b", false, "Alpha"))).toBe("Alpha");
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
    const alpha = { name: "Alpha", packageName: "a.b", system: false };
    expect(appActionCommand("forceStop", alpha)).toBe("am force-stop a.b");
    expect(appActionCommand("clearData", alpha)).toBe("pm clear a.b");
    expect(appActionCommand("uninstall", alpha)).toBe("pm uninstall a.b");
    expect(appActionRequest("uninstall", alpha)).toMatchObject({
      danger: true,
      confirmLabel: "Uninstall",
    });
    expect(appActionRequest("forceStop", alpha).danger).toBe(false);
    expect(appActionOutcome("clearData", alpha, "Success\n").ok).toBe(true);
    expect(appActionOutcome("uninstall", alpha, "Failure [DELETE_FAILED_INTERNAL_ERROR]")).toEqual({
      ok: false,
      title: "Could not uninstall",
      description: "Failure [DELETE_FAILED_INTERNAL_ERROR]",
    });
    expect(appActionOutcome("forceStop", alpha, "").ok).toBe(true);
  });

  test("a system app is removed for the current user, and the copy says so", () => {
    const settings = { name: "Settings", packageName: "com.android.settings", system: true };
    expect(uninstallLabel(true)).toBe("Remove for this user");
    expect(uninstallLabel(false)).toBe("Uninstall");
    expect(appActionCommand("uninstall", settings)).toBe(
      "pm uninstall --user current com.android.settings",
    );
    const request = appActionRequest("uninstall", settings);
    expect(request.confirmLabel).toBe("Remove for this user");
    expect(request.text).toContain("factory reset");
    expect(appActionOutcome("uninstall", settings, "Success").title).toBe(
      "Settings removed for this user",
    );
  });
});
