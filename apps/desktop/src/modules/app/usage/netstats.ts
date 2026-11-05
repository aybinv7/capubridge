import type { AppNetworkStats } from "@/types/app-inspector.types";

const MOBILE_PREFIXES = ["rmnet", "mobile", "lte", "ccmni"];

/**
 * Sums `/proc/net/xt_qtaguid/stats` rows of one uid by interface kind. Android 10 and later
 * removed that file, so an empty read means the phone does not share per-app counters.
 */
export function parseNetworkStats(statsOutput: string, uid: number | null): AppNetworkStats {
  let wifiRx = 0;
  let wifiTx = 0;
  let mobileRx = 0;
  let mobileTx = 0;

  if (uid !== null) {
    for (const line of statsOutput.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;
      const iface = parts[1];
      if (parseInt(parts[3] ?? "0", 10) !== uid) continue;
      const rx = parseInt(parts[5] ?? "0", 10);
      const tx = parseInt(parts[7] ?? "0", 10);
      if (!iface || Number.isNaN(rx) || Number.isNaN(tx)) continue;
      if (iface.startsWith("wlan") || iface.startsWith("wifi")) {
        wifiRx += rx;
        wifiTx += tx;
      } else if (MOBILE_PREFIXES.some((prefix) => iface.startsWith(prefix))) {
        mobileRx += rx;
        mobileTx += tx;
      }
    }
  }

  const total = wifiRx + wifiTx + mobileRx + mobileTx;
  return {
    uid,
    wifiRxBytes: wifiRx,
    wifiTxBytes: wifiTx,
    mobileRxBytes: mobileRx,
    mobileTxBytes: mobileTx,
    available: uid !== null && statsOutput.length > 0 && total > 0,
  };
}

/** Everything the app sent and received, both networks. */
export function networkTotal(stats: AppNetworkStats): number {
  return stats.wifiRxBytes + stats.wifiTxBytes + stats.mobileRxBytes + stats.mobileTxBytes;
}
