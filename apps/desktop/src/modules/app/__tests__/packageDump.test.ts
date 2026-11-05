import { describe, expect, test } from "vite-plus/test";
import { appIdFromDump, detectCapacitor, packageFlags } from "../package/capacitor";
import { parsePermissions, shortPermissionName } from "../package/permissions";
import { isPackageName, packageOfTarget } from "../subject/packageName";
import { PACKAGE_DUMP_TWO_USERS } from "./android16.fixtures";
import { PACKAGE_DUMP } from "./fixtures";

describe("package dump", () => {
  test("permissions: what the app asks for and its runtime grants", () => {
    const data = parsePermissions(PACKAGE_DUMP);
    expect(data.requested).toEqual([
      "android.permission.INTERNET",
      "android.permission.CAMERA",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.POST_NOTIFICATIONS",
    ]);
    expect(data.installGranted).toEqual(["android.permission.INTERNET"]);
    expect(data.runtime.map((p) => [p.shortName, p.granted, p.isDangerous])).toEqual([
      ["POST_NOTIFICATIONS", true, true],
      ["CAMERA", false, true],
      ["ACCESS_FINE_LOCATION", true, true],
    ]);
    expect(data.runtime[2]?.flags).toBe("POLICY_FIXED");
  });

  test("a phone with a second user lists each permission once, for the user asked about", () => {
    const owner = parsePermissions(PACKAGE_DUMP_TWO_USERS, 0);
    expect(owner.runtime.map((p) => [p.shortName, p.granted])).toEqual([
      ["POST_NOTIFICATIONS", false],
      ["CAMERA", true],
      ["RECORD_AUDIO", true],
    ]);
    const second = parsePermissions(PACKAGE_DUMP_TWO_USERS, 10);
    expect(second.runtime.map((p) => [p.shortName, p.granted, p.flags])).toEqual([
      ["CAMERA", false, "USER_SENSITIVE_WHEN_GRANTED"],
      ["ACCESS_FINE_LOCATION", false, "APPLY_RESTRICTION"],
    ]);
    expect(owner.requested).toContain("android.permission.ACCESS_FINE_LOCATION");
    expect(owner.installGranted).toEqual([
      "android.permission.INTERNET",
      "com.example.retail.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION",
    ]);
  });

  test("short names drop the Android and vendor prefixes", () => {
    expect(shortPermissionName("android.permission.CAMERA")).toBe("CAMERA");
    expect(shortPermissionName("com.vendor.permission.RECEIVE")).toBe("RECEIVE");
    expect(shortPermissionName("com.google.android.c2dm.permission.RECEIVE")).toBe(
      "com.google.android.c2dm.permission.RECEIVE",
    );
    expect(shortPermissionName("vendor.permission.X")).toBe("X");
  });

  test("the app id: appId= on Android 16, userId= before", () => {
    expect(appIdFromDump(PACKAGE_DUMP_TWO_USERS)).toBe(10_406);
    expect(appIdFromDump(PACKAGE_DUMP)).toBe(10_234);
    expect(appIdFromDump("nothing here")).toBeNull();
  });

  test("system and enabled come from the flags and the user's own state", () => {
    expect(packageFlags(PACKAGE_DUMP_TWO_USERS, 0)).toEqual({ system: false, enabled: true });
    expect(packageFlags(PACKAGE_DUMP_TWO_USERS, 10)).toEqual({ system: false, enabled: false });
    expect(packageFlags("    pkgFlags=[ SYSTEM HAS_CODE ]\n", 0).system).toBe(true);
  });

  test("a bridge activity marks a Capacitor app", () => {
    const info = detectCapacitor(PACKAGE_DUMP);
    expect(info.isCapacitor).toBe(true);
    expect(info.bridgeActivity).toBe("com.getcapacitor.BridgeActivity");
    expect(detectCapacitor("Packages:\n  Package [org.example]").isCapacitor).toBe(false);
  });

  test("only real package names may reach the shell", () => {
    expect(isPackageName("com.sig.presalio")).toBe(true);
    expect(isPackageName("io.ionic_starter.app2")).toBe(true);
    expect(isPackageName("com.sig;reboot")).toBe(false);
    expect(isPackageName("com.sig presalio")).toBe(false);
    expect(isPackageName("$(id)")).toBe(false);
    expect(isPackageName("single")).toBe(false);
    expect(isPackageName(null)).toBe(false);
  });

  test("a target's package drops a process suffix and refuses placeholders", () => {
    expect(packageOfTarget("com.example.retail:remote")).toBe("com.example.retail");
    expect(packageOfTarget("com.example.retail")).toBe("com.example.retail");
    expect(packageOfTarget("unknown")).toBeNull();
    expect(packageOfTarget(undefined)).toBeNull();
  });
});
