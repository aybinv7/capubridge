import { describe, expect, test } from "vite-plus/test";
import {
  batteryStatsCommand,
  batteryUidTag,
  durationMs,
  formatDuration,
  parseBatteryStats,
} from "../usage/batterystats";
import { appUid } from "../usage/appIdentity";
import { BATTERY_BLOCK, BATTERY_FULL } from "./android16.fixtures";
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

  test("the uid joins the user and the app id", () => {
    expect(appUid({ user: 0, appId: 10_406 })).toBe(10_406);
    expect(appUid({ user: 10, appId: 10_406 })).toBe(1_010_406);
  });

  test("no file (Android 10 and later) or no uid means the phone does not share them", () => {
    expect(parseNetworkStats("", 10234).available).toBe(false);
    expect(parseNetworkStats(QTAGUID, null).available).toBe(false);
  });
});

describe("battery counters", () => {
  test("reads only the app's uid block of Android 16's report", () => {
    const stats = parseBatteryStats(BATTERY_BLOCK, "u0a406");
    expect(stats).toMatchObject({
      cpuUserMs: 21 * 60_000 + 3000 + 834,
      cpuSystemMs: 10 * 60_000 + 10_000 + 711,
      onScreenMs: 31 * 60_000 + 13_000 + 552,
      wakeFullMs: 3 * 60_000 + 31_000 + 826,
      wakePartialMs: 0,
      hasData: true,
    });
    expect(stats.raw.startsWith("  u0a406:")).toBe(true);
    expect(stats.raw).not.toContain("Per process state");
  });

  test("another uid's block earlier in the report is never read as the app's", () => {
    const stats = parseBatteryStats(BATTERY_FULL, "u0a406");
    expect(stats.cpuUserMs).toBe(21 * 60_000 + 3000 + 834);
    expect(stats.wakePartialMs).toBe(0);
    expect(stats.raw).not.toContain("1000:");
  });

  test("no block for the app means no figures, whatever else the phone printed", () => {
    expect(parseBatteryStats(BATTERY_FULL, "u0a999").hasData).toBe(false);
    expect(parseBatteryStats("", "u0a406").hasData).toBe(false);
    expect(parseBatteryStats(BATTERY_BLOCK, null).hasData).toBe(false);
  });

  test("older phones print processor time per process", () => {
    const stats = parseBatteryStats(
      ["  u0a234:", "    Proc com.app:", "      CPU: 1m 2s 0ms usr + 850ms krn ; 0ms fg"].join(
        "\n",
      ),
      "u0a234",
    );
    expect(stats.cpuUserMs).toBe(62_000);
    expect(stats.cpuSystemMs).toBe(850);
  });

  test("durations keep days and hours, and milliseconds are not minutes", () => {
    expect(durationMs("1d 2h 3m 4s 5ms")).toBe(86_400_000 + 7_200_000 + 180_000 + 4000 + 5);
    expect(durationMs("10h 58m 24s 102ms")).toBe(36_000_000 + 3_480_000 + 24_000 + 102);
    expect(durationMs("+6m2s504ms")).toBe(362_504);
    expect(durationMs("850ms")).toBe(850);
  });

  test("the uid tag names the user and the app", () => {
    expect(batteryUidTag(0, 10_406)).toBe("u0a406");
    expect(batteryUidTag(10, 10_406)).toBe("u10a406");
    expect(batteryUidTag(0, 1000)).toBe("1000");
    expect(batteryStatsCommand("com.example.retail", "u0a406")).toBe(
      "dumpsys batterystats --charged com.example.retail | sed -n -E '/^  u0a406:$/,/^ ?[^ ]/p'",
    );
  });

  test("durations read in words", () => {
    expect(formatDuration(0)).toBe("0 ms");
    expect(formatDuration(850)).toBe("850 ms");
    expect(formatDuration(4200)).toBe("4.2 s");
    expect(formatDuration(192_500)).toBe("3 min 12 s");
    expect(formatDuration(120_000)).toBe("2 min");
    expect(formatDuration(2 * 3_600_000 + 5 * 60_000)).toBe("2 h 5 min");
    expect(formatDuration(86_400_000 + 3 * 3_600_000)).toBe("1 d 3 h");
  });
});
