import type { PairingFailure, PairingPhase } from "@/types/wireless.types";

export interface FailureCopy {
  title: string;
  body: string;
  hints: string[];
}

const SAME_NETWORK = "Check that the phone and this computer are on the same Wi-Fi network.";
const ISOLATED_NETWORK =
  "Guest, hotel and office networks often keep devices apart. A phone hotspot or home Wi-Fi works.";
const FIREWALL =
  "On Windows, allow adb (Android Debug Bridge) through the firewall for private networks.";

const FAILURES: Record<PairingFailure, FailureCopy> = {
  phoneNotSeen: {
    title: "The phone did not answer the QR code",
    body: "Other phones are visible, so discovery works, but this QR code was never scanned.",
    hints: [
      "Scan with Wireless debugging › Pair device with QR code, not the camera app.",
      SAME_NETWORK,
    ],
  },
  nothingDiscovered: {
    title: "No phone could be found on this network",
    body: "Nothing answered the search, which usually means the network or a firewall blocks it.",
    hints: [SAME_NETWORK, ISOLATED_NETWORK, FIREWALL],
  },
  phoneUnreachable: {
    title: "The phone was found but could not be reached",
    body: "It announced itself, then did not accept the connection.",
    hints: [
      ISOLATED_NETWORK,
      FIREWALL,
      "A VPN on this computer or the phone can also get in the way.",
    ],
  },
  pairingRejected: {
    title: "The phone refused the pairing",
    body: "The code did not match, or the pairing screen closed on the phone.",
    hints: ["Keep the pairing screen open on the phone and try again."],
  },
  connectFailed: {
    title: "Paired, but the connection did not open",
    body: "The phone is paired with this computer; only the last step failed.",
    hints: ["Keep Wireless debugging turned on, then use Connect under Nearby phones.", FIREWALL],
  },
  discoveryUnavailable: {
    title: "Capubridge cannot search this network",
    body: "Neither ADB nor Capubridge could start network discovery on this computer.",
    hints: ["Use a pairing code instead: it works without discovery.", FIREWALL],
  },
  adbUnavailable: {
    title: "ADB is not running",
    body: "Pairing goes through the ADB server, and it did not answer.",
    hints: ["Look for devices again from the device list; Capubridge starts ADB when it can."],
  },
};

export function failureCopy(reason: PairingFailure): FailureCopy {
  return FAILURES[reason];
}

/** The live status line under the QR code or the code form. */
export function phaseLabel(state: PairingPhase | null): string {
  switch (state?.phase) {
    case undefined:
    case "waiting":
      return "Waiting for the phone";
    case "pairing":
      return "Pairing";
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "failed":
      return "Stopped";
  }
}
