import { describe, expect, test } from "vite-plus/test";
import { parsePermissions } from "../package/permissions";
import {
  installTimePermissions,
  isFixedPermission,
  matchesPermissionFilter,
  permissionChangeCommand,
  permissionChangeFailed,
  permissionCounts,
  permissionGroup,
  permissionLabel,
  sortPermissions,
} from "../overview/permissions/permissionsView";
import { PACKAGE, PACKAGE_DUMP } from "./fixtures";

const data = parsePermissions(PACKAGE_DUMP);
const runtime = data.runtime;

describe("permissions view", () => {
  test("denied first, then sensitive, then by group, as before", () => {
    const ordered = sortPermissions(runtime, { key: "attention", desc: false });
    expect(ordered.map((p) => p.shortName)).toEqual([
      "CAMERA",
      "ACCESS_FINE_LOCATION",
      "POST_NOTIFICATIONS",
    ]);
  });

  test("names, groups and states sort both ways", () => {
    const byName = sortPermissions(runtime, { key: "name", desc: false });
    expect(byName.map((p) => p.shortName)).toEqual([
      "ACCESS_FINE_LOCATION",
      "CAMERA",
      "POST_NOTIFICATIONS",
    ]);
    const byState = sortPermissions(runtime, { key: "state", desc: true });
    expect(byState.at(-1)?.granted).toBe(false);
  });

  test("filters, counts and plain names", () => {
    expect(runtime.filter((p) => matchesPermissionFilter(p, "denied"))).toHaveLength(1);
    expect(runtime.filter((p) => matchesPermissionFilter(p, "granted"))).toHaveLength(2);
    expect(permissionCounts(runtime)).toEqual({ total: 3, granted: 2, denied: 1, sensitive: 3 });
    expect(permissionLabel("ACCESS_FINE_LOCATION")).toBe("Access fine location");
    expect(permissionGroup({ shortName: "RECORD_AUDIO" })).toBe("Microphone");
    expect(permissionGroup({ shortName: "INTERNET" })).toBe("Other");
  });

  test("install-time permissions are the requested ones that are not runtime", () => {
    expect(installTimePermissions(data)).toEqual(["INTERNET"]);
    expect(installTimePermissions(null)).toEqual([]);
  });

  test("a permission held by Android or a policy cannot be changed", () => {
    expect(isFixedPermission({ flags: "POLICY_FIXED" })).toBe(true);
    expect(isFixedPermission({ flags: "USER_SET|SYSTEM_FIXED" })).toBe(true);
    expect(isFixedPermission({ flags: "USER_SET" })).toBe(false);
  });

  test("grant and revoke commands refuse names that could reach the shell", () => {
    expect(permissionChangeCommand(PACKAGE, "android.permission.CAMERA", true)).toBe(
      `pm grant ${PACKAGE} android.permission.CAMERA`,
    );
    expect(permissionChangeCommand(PACKAGE, "android.permission.CAMERA", false)).toBe(
      `pm revoke ${PACKAGE} android.permission.CAMERA`,
    );
    expect(permissionChangeCommand(PACKAGE, "x; reboot", true)).toBeNull();
    expect(permissionChangeCommand("a b", "android.permission.CAMERA", true)).toBeNull();
  });

  test("pm prints nothing when it worked, and the reason when it did not", () => {
    expect(permissionChangeFailed("")).toBeNull();
    expect(
      permissionChangeFailed(
        "Exception occurred while executing 'grant':\njava.lang.SecurityException: ...",
      ),
    ).toContain("SecurityException");
  });
});
