import type { AppPermission, AppPermissionsData } from "@/types/app-inspector.types";
import { compareText } from "@/shared/format/collator";
import { shortPermissionName } from "../../package/permissions";

export type PermissionFilter = "all" | "sensitive" | "granted" | "denied";
export type PermissionSortKey = "attention" | "name" | "group" | "state";

export interface PermissionSort {
  key: PermissionSortKey;
  desc: boolean;
}

export const PERMISSION_FILTERS: ReadonlyArray<{ value: PermissionFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "sensitive", label: "Sensitive" },
  { value: "granted", label: "Allowed" },
  { value: "denied", label: "Denied" },
];

const GROUPS: Record<string, string> = {
  CAMERA: "Camera",
  RECORD_AUDIO: "Microphone",
  ACCESS_FINE_LOCATION: "Location",
  ACCESS_COARSE_LOCATION: "Location",
  ACCESS_BACKGROUND_LOCATION: "Location",
  READ_CONTACTS: "Contacts",
  WRITE_CONTACTS: "Contacts",
  GET_ACCOUNTS: "Contacts",
  READ_EXTERNAL_STORAGE: "Storage",
  WRITE_EXTERNAL_STORAGE: "Storage",
  READ_MEDIA_IMAGES: "Media",
  READ_MEDIA_VIDEO: "Media",
  READ_MEDIA_AUDIO: "Media",
  READ_PHONE_STATE: "Phone",
  CALL_PHONE: "Phone",
  READ_CALL_LOG: "Phone",
  SEND_SMS: "SMS",
  READ_SMS: "SMS",
  RECEIVE_SMS: "SMS",
  BLUETOOTH_CONNECT: "Bluetooth",
  BLUETOOTH_SCAN: "Bluetooth",
  POST_NOTIFICATIONS: "Notifications",
  ACTIVITY_RECOGNITION: "Activity",
  BODY_SENSORS: "Sensors",
};

/** The group a permission belongs to in Android's settings, or "Other". */
export function permissionGroup(permission: Pick<AppPermission, "shortName">): string {
  return GROUPS[permission.shortName] ?? "Other";
}

/** `ACCESS_FINE_LOCATION` → "Access fine location". */
export function permissionLabel(shortName: string): string {
  const words = shortName.toLowerCase().replaceAll("_", " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : shortName;
}

/**
 * Flags that mean the permission cannot be changed here: Android or a device policy holds it, or
 * it is a restricted permission the installer did not allow.
 */
export function isFixedPermission(permission: Pick<AppPermission, "flags">): boolean {
  return /SYSTEM_FIXED|POLICY_FIXED|APPLY_RESTRICTION/.test(permission.flags);
}

/** Why a permission cannot be changed here, for its tooltip. */
export function fixedReason(permission: Pick<AppPermission, "flags">): string {
  return /APPLY_RESTRICTION/.test(permission.flags)
    ? "Android restricts this permission for apps installed this way"
    : "Android or a device policy holds this permission";
}

export function matchesPermissionFilter(
  permission: AppPermission,
  filter: PermissionFilter,
): boolean {
  if (filter === "sensitive") return permission.isDangerous;
  if (filter === "granted") return permission.granted;
  if (filter === "denied") return !permission.granted;
  return true;
}

function attention(a: AppPermission, b: AppPermission): number {
  if (a.granted !== b.granted) return a.granted ? 1 : -1;
  if (a.isDangerous !== b.isDangerous) return a.isDangerous ? -1 : 1;
  return compareText(permissionGroup(a), permissionGroup(b));
}

const COMPARE: Record<PermissionSortKey, (a: AppPermission, b: AppPermission) => number> = {
  attention,
  name: (a, b) => compareText(permissionLabel(a.shortName), permissionLabel(b.shortName)),
  group: (a, b) => compareText(permissionGroup(a), permissionGroup(b)),
  state: (a, b) => Number(a.granted) - Number(b.granted),
};

/**
 * Permissions in the chosen order. "attention" puts denied first, then sensitive ones, then by
 * group; ties fall back to the full name so rows never jump.
 */
export function sortPermissions(
  permissions: readonly AppPermission[],
  sort: PermissionSort,
): AppPermission[] {
  const compare = COMPARE[sort.key];
  const ordered = [...permissions].sort((a, b) => compare(a, b) || compareText(a.name, b.name));
  return sort.desc ? ordered.reverse() : ordered;
}

export interface PermissionCounts {
  total: number;
  granted: number;
  denied: number;
  sensitive: number;
}

export function permissionCounts(permissions: readonly AppPermission[]): PermissionCounts {
  let granted = 0;
  let sensitive = 0;
  for (const permission of permissions) {
    if (permission.granted) granted += 1;
    if (permission.isDangerous) sensitive += 1;
  }
  return { total: permissions.length, granted, denied: permissions.length - granted, sensitive };
}

/** Permissions Android granted at install, by plain name with the full name kept for hover. */
export function installTimePermissions(
  data: AppPermissionsData | null,
): Array<{ name: string; label: string }> {
  if (!data) return [];
  const runtime = new Set(data.runtime.map((permission) => permission.name));
  return data.installGranted
    .filter((name) => !runtime.has(name))
    .map((name) => ({ name, label: permissionLabel(shortPermissionName(name)) }))
    .sort((a, b) => compareText(a.label, b.label));
}

const PERMISSION_NAME = /^[A-Za-z][\w.]*$/;

/**
 * `pm grant` or `pm revoke` for the Android user the app runs as; `null` when either name could
 * reach the shell unsafely.
 */
export function permissionChangeCommand(
  packageName: string,
  permission: string,
  grant: boolean,
  user: number,
): string | null {
  if (!PERMISSION_NAME.test(permission) || !PERMISSION_NAME.test(packageName)) return null;
  if (!Number.isInteger(user) || user < 0) return null;
  return `pm ${grant ? "grant" : "revoke"} --user ${user} ${packageName} ${permission}`;
}

/** `pm grant` and `pm revoke` print nothing when they work, and the reason when they do not. */
export function permissionChangeFailed(output: string): string | null {
  const text = output.trim();
  return /exception|error|failure|unknown|not a changeable|not requested/i.test(text) ? text : null;
}
