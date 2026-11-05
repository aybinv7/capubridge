import { describe, expect, test } from "vite-plus/test";
import { formatDuration, parseBatteryStats } from "../usage/batterystats";
import { networkTotal, parseNetworkStats } from "../usage/netstats";

const QTAGUID = [
  "idx iface acct_tag_hex uid_tag_int cnt_set rx_bytes rx_packets tx_bytes tx_packets",
  "2 wlan0 0x0 10234 0 1000 10 400 4 0 0",
  "3 wlan0 0x0 10234 1 500 5 100 1 0 0",
  "4 rmnet_data0 0x0 10234 0 2000 20 600 6 0 0",
  "5 wlan0 0x0 10999 0 9999 99 9999 99 0 0",
].join("\n");

describe("traffic counters", () => {
  test("sums the app's rows by network and ignores other apps", () => {
    const stats = parseNetworkStats(QTAGUID, 10234);
    expect(stats).toEqual({
      uid: 10234,
      wifiRxBytes: 1500,
      wifiTxBytes: 500,
      mobileRxBytes: 2000,
      mobileTxBytes: 600,
      available: true,
    });
    expect(networkTotal(stats)).toBe(4600);
  });

  test("no file (Android 10 and later) or no uid means the phone does not share them", () => {
    expect(parseNetworkStats("", 10234).available).toBe(false);
    expect(parseNetworkStats(QTAGUID, null).available).toBe(false);
  });
});

describe("battery counters", () => {
  test("reads processor time and wake locks", () => {
    const stats = parseBatteryStats(
      [
        "  Uid u0a234:",
        "    Wake lock *alarm* realtime: 1m 2s 300ms",
        "    Cpu total: 3m 12s 500ms usr + 1s sys",
        "    Background Cpu total: 4s 20ms usr + 0ms sys",
      ].join("\n"),
    );
    expect(stats.fgCpuTimeMs).toBe(192_500);
    expect(stats.bgCpuTimeMs).toBe(4020);
    expect(stats.wakelocksMs).toBe(62_300);
    expect(stats.hasData).toBe(true);
  });

  test("milliseconds alone are not read as minutes", () => {
    expect(parseBatteryStats("Cpu total: 850ms usr + 0ms sys").fgCpuTimeMs).toBe(850);
  });

  test("an empty answer has no data", () => {
    expect(parseBatteryStats("").hasData).toBe(false);
  });

  test("durations read in words", () => {
    expect(formatDuration(0)).toBe("0 ms");
    expect(formatDuration(850)).toBe("850 ms");
    expect(formatDuration(4200)).toBe("4.2 s");
    expect(formatDuration(192_500)).toBe("3 min 12 s");
    expect(formatDuration(120_000)).toBe("2 min");
  });
});
