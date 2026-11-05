import { describe, expect, test } from "vite-plus/test";
import { detectCapacitor, uidFromDump } from "../package/capacitor";
import { parsePermissions, shortPermissionName } from "../package/permissions";
import { isPackageName } from "../subject/packageName";
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
    expect(data.runtime.map((p) => [p.shortName, p.granted, p.isDangerous])).toEqual([
      ["POST_NOTIFICATIONS", true, true],
      ["CAMERA", false, true],
      ["ACCESS_FINE_LOCATION", true, true],
    ]);
    expect(data.runtime[2]?.flags).toBe("POLICY_FIXED");
  });

  test("short names drop the Android and vendor prefixes", () => {
    expect(shortPermissionName("android.permission.CAMERA")).toBe("CAMERA");
    expect(shortPermissionName("com.vendor.permission.RECEIVE")).toBe("RECEIVE");
    expect(shortPermissionName("com.google.android.c2dm.permission.RECEIVE")).toBe(
      "com.google.android.c2dm.permission.RECEIVE",
    );
    expect(shortPermissionName("vendor.permission.X")).toBe("X");
  });

  test("the uid keys the traffic counters", () => {
    expect(uidFromDump(PACKAGE_DUMP)).toBe(10234);
    expect(uidFromDump("nothing here")).toBeNull();
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
});
