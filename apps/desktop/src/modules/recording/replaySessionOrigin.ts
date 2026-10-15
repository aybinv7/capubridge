import type { SessionManifest } from "@/types/replay.types";

export interface SessionOrigin {
  producer: string | null;
  device: string | null;
}

function joinPresent(parts: Array<string | null | undefined>, separator: string): string | null {
  const present = parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  return present.length > 0 ? present.join(separator) : null;
}

export function describeSessionOrigin(
  manifest: Pick<SessionManifest, "producer" | "device">,
): SessionOrigin {
  const producer = manifest.producer
    ? joinPresent([manifest.producer.name, manifest.producer.version], " ")
    : null;
  const device = manifest.device
    ? joinPresent(
        [
          manifest.device.model,
          manifest.device.osVersion ? `Android ${manifest.device.osVersion}` : null,
          manifest.device.webviewVersion ? `WebView ${manifest.device.webviewVersion}` : null,
        ],
        " · ",
      )
    : null;
  return { producer, device };
}
