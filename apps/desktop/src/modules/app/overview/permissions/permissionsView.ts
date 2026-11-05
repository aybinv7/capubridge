import type { AppPermission, AppPermissionsData } from "@/types/app-inspector.types";
import { compareText } from "@/shared/format/collator";

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

/** Flags that mean Android or a device policy holds the permission, so it cannot be changed here. */
export function isFixedPermission(permission: Pick<AppPermission, "flags">): boolean {
  return /SYSTEM_FIXED|POLICY_FIXED/.test(permission.flags);
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

/** Requested permissions Android grants at install time, without their `android.permission.` prefix. */
export function installTimePermissions(data: AppPermissionsData | null): string[] {
  if (!data) return [];
  const runtime = new Set(data.runtime.map((permission) => permission.name));
  return data.requested
    .filter((name) => !runtime.has(name))
    .map((name) => name.replace("android.permission.", ""));
}

const PERMISSION_NAME = /^[A-Za-z][\w.]*$/;

/** `pm grant` or `pm revoke`; `null` when either name could reach the shell unsafely. */
export function permissionChangeCommand(
  packageName: string,
  permission: string,
  grant: boolean,
): string | null {
  if (!PERMISSION_NAME.test(permission) || !PERMISSION_NAME.test(packageName)) return null;
  return `pm ${grant ? "grant" : "revoke"} ${packageName} ${permission}`;
}

/** `pm grant` and `pm revoke` print nothing when they work, and the reason when they do not. */
export function permissionChangeFailed(output: string): string | null {
  const text = output.trim();
  return /exception|error|failure|unknown|not a changeable|not requested/i.test(text) ? text : null;
}
