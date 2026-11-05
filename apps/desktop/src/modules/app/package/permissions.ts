import type { AppPermission, AppPermissionsData } from "@/types/app-inspector.types";

const SENSITIVE = new Set([
  "READ_CALENDAR",
  "WRITE_CALENDAR",
  "CAMERA",
  "READ_CONTACTS",
  "WRITE_CONTACTS",
  "GET_ACCOUNTS",
  "ACCESS_FINE_LOCATION",
  "ACCESS_COARSE_LOCATION",
  "ACCESS_BACKGROUND_LOCATION",
  "RECORD_AUDIO",
  "READ_PHONE_STATE",
  "READ_PHONE_NUMBERS",
  "CALL_PHONE",
  "ANSWER_PHONE_CALLS",
  "READ_CALL_LOG",
  "WRITE_CALL_LOG",
  "ADD_VOICEMAIL",
  "USE_SIP",
  "PROCESS_OUTGOING_CALLS",
  "BODY_SENSORS",
  "BODY_SENSORS_BACKGROUND",
  "SEND_SMS",
  "RECEIVE_SMS",
  "READ_SMS",
  "RECEIVE_WAP_PUSH",
  "RECEIVE_MMS",
  "READ_EXTERNAL_STORAGE",
  "WRITE_EXTERNAL_STORAGE",
  "READ_MEDIA_IMAGES",
  "READ_MEDIA_VIDEO",
  "READ_MEDIA_AUDIO",
  "BLUETOOTH_CONNECT",
  "BLUETOOTH_SCAN",
  "BLUETOOTH_ADVERTISE",
  "NEARBY_WIFI_DEVICES",
  "ACTIVITY_RECOGNITION",
  "POST_NOTIFICATIONS",
  "UWB_RANGING",
]);

/** `android.permission.CAMERA` → `CAMERA`; vendor prefixes are dropped the same way. */
export function shortPermissionName(name: string): string {
  return name
    .replace(/^android\.permission\./, "")
    .replace(/^com\.[^.]+\.permission\./, "")
    .replace(/^[^.]+\.permission\./, "");
}

/**
 * Reads the permission sections of `dumpsys package <package>`: what the app asks for, and its
 * runtime permissions with their grant state and flags.
 */
export function parsePermissions(output: string): AppPermissionsData {
  let inRequested = false;
  let inRuntime = false;
  const requested: string[] = [];
  const runtime: AppPermission[] = [];

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "requested permissions:") {
      inRequested = true;
      inRuntime = false;
      continue;
    }
    if (trimmed === "runtime permissions:") {
      inRuntime = true;
      inRequested = false;
      continue;
    }
    if (
      trimmed === "install permissions:" ||
      trimmed === "declared permissions:" ||
      trimmed === "User Restrictions" ||
      (trimmed.endsWith(":") && !trimmed.startsWith("android.") && !trimmed.includes("granted="))
    ) {
      inRequested = false;
      inRuntime = false;
      continue;
    }
    if (inRequested && trimmed.startsWith("android.")) {
      const clean = trimmed.split(/\s+/)[0];
      if (clean) requested.push(clean);
    }
    if (inRuntime) {
      const match = trimmed.match(/^([\w.]+):\s+granted=(true|false),\s*flags=\[([^\]]*)\]/);
      if (match?.[1]) {
        const shortName = shortPermissionName(match[1]);
        runtime.push({
          name: match[1],
          shortName,
          granted: match[2] === "true",
          flags: (match[3] ?? "").trim(),
          isDangerous: SENSITIVE.has(shortName),
        });
      }
    }
  }

  return { requested, runtime };
}
