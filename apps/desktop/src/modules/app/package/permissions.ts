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

type Section = "requested" | "install" | "runtime";

const SECTIONS: Record<string, Section> = {
  "requested permissions:": "requested",
  "install permissions:": "install",
  "runtime permissions:": "runtime",
};

const GRANT = /^([\w.]+):\s+granted=(true|false)(?:,\s*flags=\[([^\]]*)\])?/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Reads the permission sections of `dumpsys package <package>` for one Android user: what the
 * app asks for, what Android granted at install, and the user's runtime permissions with their
 * state and flags. Other users' sections and a hidden factory copy of the package are skipped,
 * so a phone with a second user never shows a permission twice.
 */
export function parsePermissions(output: string, user = 0): AppPermissionsData {
  const requested: string[] = [];
  const installGranted: string[] = [];
  const runtime: AppPermission[] = [];
  let packages = 0;
  let section: { kind: Section; indent: number } | null = null;
  let userSection: { id: number; indent: number } | null = null;

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const indent = indentOf(line);
    if (trimmed.startsWith("Package [")) {
      packages += 1;
      section = null;
      userSection = null;
      continue;
    }
    if (packages > 1) break;
    if (section && indent <= section.indent) section = null;
    if (userSection && indent <= userSection.indent) userSection = null;

    const header = trimmed.match(/^User (\d+):/);
    if (header) {
      userSection = { id: parseInt(header[1] ?? "", 10), indent };
      section = null;
      continue;
    }
    const kind = SECTIONS[trimmed];
    if (kind) {
      section = { kind, indent };
      continue;
    }
    if (!section) continue;
    const mine = userSection === null || userSection.id === user;

    if (section.kind === "requested" && userSection === null) {
      const name = trimmed.split(/[\s:]/)[0];
      if (name) requested.push(name);
    } else if (section.kind === "install" && mine) {
      const match = trimmed.match(GRANT);
      if (match?.[1] && match[2] === "true") installGranted.push(match[1]);
    } else if (section.kind === "runtime" && userSection?.id === user) {
      const match = trimmed.match(GRANT);
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

  return { requested, installGranted, runtime };
}
