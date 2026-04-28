import { ref, watch, onUnmounted, computed } from "vue";
import type { Ref } from "vue";
import { useAdb } from "./useAdb";
import type {
  AppMemInfo,
  AppCpuInfo,
  AppPermission,
  AppPermissionsData,
  AppNetworkStats,
  AppBatteryStats,
  AppCapacitorInfo,
} from "@/types/app-inspector.types";

const DANGEROUS = new Set([
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

function shortPermName(name: string): string {
  return name
    .replace(/^android\.permission\./, "")
    .replace(/^com\.[^.]+\.permission\./, "")
    .replace(/^[^.]+\.permission\./, "");
}

function extractKb(text: string, label: string): number {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s+${escaped}\\s+(\\d+)`, "m");
  const m = text.match(re);
  return m ? parseInt(m[1], 10) : 0;
}

function parseMemInfo(output: string): AppMemInfo {
  const isRunning = output.includes("MEMINFO in pid");
  const pidMatch = output.match(/MEMINFO in pid (\d+)/);
  const pid = pidMatch ? parseInt(pidMatch[1], 10) : null;

  const nativeHeap = extractKb(output, "Native Heap");
  const dalvikHeap = extractKb(output, "Dalvik Heap");
  const stack = extractKb(output, "Stack");
  const graphics =
    extractKb(output, "GL mtrack") ||
    extractKb(output, "EGL mtrack") ||
    extractKb(output, "Gfx dev");

  let code = 0;
  const mmapRe = /^\s+\.(so|jar|apk|dex|oat|art) mmap\s+(\d+)/gm;
  let mm;
  while ((mm = mmapRe.exec(output)) !== null) {
    code += parseInt(mm[2], 10);
  }

  const totalMatch = output.match(/^\s+TOTAL\s+(\d+)/m);
  const totalPssKb = totalMatch ? parseInt(totalMatch[1], 10) : 0;

  const known = nativeHeap + dalvikHeap + code + stack + graphics;
  const other = Math.max(0, totalPssKb - known);

  let threadCount: number | null = null;
  const threadsMatch = output.match(/Threads:\s*(\d+)/);
  if (threadsMatch) threadCount = parseInt(threadsMatch[1], 10);

  return {
    pid,
    totalPssKb,
    nativeHeapKb: nativeHeap,
    dalvikHeapKb: dalvikHeap,
    codeKb: code,
    stackKb: stack,
    graphicsKb: graphics,
    otherKb: other,
    threadCount,
    isRunning: isRunning && pid !== null,
  };
}

function parseCpuInfo(output: string, packageName: string): AppCpuInfo {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(\\d+\\.?\\d*)%\\s+\\d+/${escaped}[^:]*:\\s+(\\d+\\.?\\d*)%\\s+user\\s+\\+\\s+(\\d+\\.?\\d*)%\\s+kernel`,
  );
  const m = output.match(re);
  if (!m) return { totalPct: 0, userPct: 0, kernelPct: 0 };
  return {
    totalPct: parseFloat(m[1]),
    userPct: parseFloat(m[2]),
    kernelPct: parseFloat(m[3]),
  };
}

function parsePermissions(output: string): AppPermissionsData {
  const lines = output.split("\n");
  let inRequested = false;
  let inRuntime = false;
  const requested: string[] = [];
  const runtime: AppPermission[] = [];

  for (const line of lines) {
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
      if (inRequested || inRuntime) {
        inRequested = false;
        inRuntime = false;
      }
      continue;
    }

    if (inRequested && trimmed.startsWith("android.")) {
      const clean = trimmed.split(/\s+/)[0];
      if (clean) requested.push(clean);
    }

    if (inRuntime) {
      const m = trimmed.match(/^([\w.]+):\s+granted=(true|false),\s*flags=\[([^\]]*)\]/);
      if (m) {
        const name = m[1]!;
        const granted = m[2] === "true";
        const flags = m[3]!.trim();
        const sn = shortPermName(name);
        runtime.push({
          name,
          shortName: sn,
          granted,
          flags,
          isDangerous: DANGEROUS.has(sn),
        });
      }
    }
  }

  return { requested, runtime };
}

function parseNetworkStats(
  statsOutput: string,
  uid: number,
): Omit<AppNetworkStats, "uid" | "available"> {
  let wifiRx = 0,
    wifiTx = 0,
    mobileRx = 0,
    mobileTx = 0;

  for (const line of statsOutput.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const iface = parts[1];
    const lineUid = parseInt(parts[3] ?? "0", 10);
    if (lineUid !== uid) continue;
    const rx = parseInt(parts[5] ?? "0", 10);
    const tx = parseInt(parts[7] ?? "0", 10);
    if (!iface || isNaN(rx) || isNaN(tx)) continue;

    if (iface.startsWith("wlan") || iface.startsWith("wifi")) {
      wifiRx += rx;
      wifiTx += tx;
    } else if (
      iface.startsWith("rmnet") ||
      iface.startsWith("mobile") ||
      iface.startsWith("lte") ||
      iface.startsWith("ccmni")
    ) {
      mobileRx += rx;
      mobileTx += tx;
    }
  }

  return {
    wifiRxBytes: wifiRx,
    wifiTxBytes: wifiTx,
    mobileRxBytes: mobileRx,
    mobileTxBytes: mobileTx,
  };
}

function parseBatteryStats(output: string): AppBatteryStats {
  let fgMs = 0;
  let bgMs = 0;
  let wakeMs = 0;

  function parseTimeMs(str: string): number {
    let ms = 0;
    const mMatch = str.match(/(\d+)m/);
    const sMatch = str.match(/(\d+)s/);
    const msMatch = str.match(/(\d+)ms/);
    if (mMatch) ms += parseInt(mMatch[1], 10) * 60000;
    if (sMatch) ms += parseInt(sMatch[1], 10) * 1000;
    if (msMatch) ms += parseInt(msMatch[1], 10);
    return ms;
  }

  const fgMatch = output.match(/Cpu total:\s+([^+]+)\s+usr/i);
  if (fgMatch) fgMs = parseTimeMs(fgMatch[1]!);

  const bgMatch = output.match(/Background Cpu total:\s+([^+]+)\s+usr/i);
  if (bgMatch) bgMs = parseTimeMs(bgMatch[1]!);

  const wakeMatch = output.match(/Wake lock.*?realtime:\s+([^\n]+)/i);
  if (wakeMatch) wakeMs = parseTimeMs(wakeMatch[1]!);

  const hasData = fgMs > 0 || bgMs > 0 || output.trim().length > 0;

  return { fgCpuTimeMs: fgMs, bgCpuTimeMs: bgMs, wakelocksMs: wakeMs, hasData, raw: output };
}

function detectCapacitor(pkgDump: string): AppCapacitorInfo {
  const bridgeMatch = pkgDump.match(/([\w.]*BridgeActivity)/);
  const isCapacitor =
    bridgeMatch !== null ||
    pkgDump.includes("com.getcapacitor") ||
    pkgDump.toLowerCase().includes("capacitor");

  const bridgeActivity = bridgeMatch?.[1] ?? null;

  const versionMatch = pkgDump.match(/capacitor[^0-9]*(\d+\.\d+\.\d+)/i);
  const version = versionMatch?.[1] ?? null;

  const plugins: string[] = [];
  const pluginRe = /[\w.]+\.(capacitor|plugin)\.[\w]+/gi;
  const seen = new Set<string>();
  let pm;
  while ((pm = pluginRe.exec(pkgDump)) !== null) {
    const match = pm[0];
    if (match && !seen.has(match)) {
      seen.add(match);
      plugins.push(match);
    }
  }

  return { isCapacitor, bridgeActivity, plugins, version };
}

export function useAppInspector(serial: Ref<string>, packageName: Ref<string>) {
  const { shellCommand } = useAdb();

  const memInfo = ref<AppMemInfo | null>(null);
  const cpuInfo = ref<AppCpuInfo | null>(null);
  const isLive = ref(false);
  const liveError = ref<string | null>(null);
  let liveTimer: ReturnType<typeof setInterval> | null = null;

  const permissions = ref<AppPermissionsData | null>(null);
  const isLoadingPerms = ref(false);
  const permsError = ref<string | null>(null);

  const networkStats = ref<AppNetworkStats | null>(null);
  const isLoadingNetwork = ref(false);
  const networkError = ref<string | null>(null);

  const batteryStats = ref<AppBatteryStats | null>(null);
  const isLoadingBattery = ref(false);
  const batteryError = ref<string | null>(null);

  const capacitorInfo = ref<AppCapacitorInfo | null>(null);
  const isLoadingCap = ref(false);

  const pkgDump = ref<string | null>(null);
  let pkgDumpPromise: Promise<string> | null = null;

  const isReady = computed(() => !!serial.value && !!packageName.value);

  async function getPackageDump(options?: { force?: boolean }): Promise<string> {
    if (options?.force) {
      pkgDump.value = null;
      pkgDumpPromise = null;
    }
    if (pkgDump.value) return pkgDump.value;
    if (pkgDumpPromise) return pkgDumpPromise;
    pkgDumpPromise = shellCommand(serial.value, `dumpsys package ${packageName.value}`).then(
      (out) => {
        pkgDump.value = out;
        pkgDumpPromise = null;
        return out;
      },
    );
    return pkgDumpPromise;
  }

  async function fetchLive() {
    if (!isReady.value) return;
    try {
      const [memOut, cpuOut] = await Promise.all([
        shellCommand(serial.value, `dumpsys meminfo ${packageName.value}`),
        shellCommand(serial.value, `dumpsys cpuinfo 2>/dev/null | head -40`),
      ]);
      memInfo.value = parseMemInfo(memOut);
      cpuInfo.value = parseCpuInfo(cpuOut, packageName.value);
      liveError.value = null;
    } catch (e) {
      liveError.value = String(e);
    }
  }

  function startLive() {
    stopLive();
    if (!isReady.value) return;
    isLive.value = true;
    void fetchLive();
    liveTimer = setInterval(() => void fetchLive(), 2500);
  }

  function stopLive() {
    if (liveTimer) {
      clearInterval(liveTimer);
      liveTimer = null;
    }
    isLive.value = false;
    memInfo.value = null;
    cpuInfo.value = null;
    liveError.value = null;
  }

  async function fetchPermissions(options?: { force?: boolean }) {
    if (!isReady.value) return;
    isLoadingPerms.value = true;
    permsError.value = null;
    try {
      const dump = await getPackageDump(options);
      permissions.value = parsePermissions(dump);
    } catch (e) {
      permsError.value = String(e);
    } finally {
      isLoadingPerms.value = false;
    }
  }

  async function fetchNetworkStats(options?: { force?: boolean }) {
    if (!isReady.value) return;
    isLoadingNetwork.value = true;
    networkError.value = null;
    try {
      const dump = await getPackageDump(options);
      const uidMatch = dump.match(/userId=(\d+)/);
      const uid = uidMatch ? parseInt(uidMatch[1]!, 10) : null;

      if (!uid) {
        networkStats.value = {
          uid: null,
          wifiRxBytes: 0,
          wifiTxBytes: 0,
          mobileRxBytes: 0,
          mobileTxBytes: 0,
          available: false,
        };
        return;
      }

      const statsOut = await shellCommand(
        serial.value,
        `cat /proc/net/xt_qtaguid/stats 2>/dev/null`,
      );

      const parsed = parseNetworkStats(statsOut, uid);
      const hasAnyData =
        parsed.wifiRxBytes + parsed.wifiTxBytes + parsed.mobileRxBytes + parsed.mobileTxBytes > 0;

      networkStats.value = {
        uid,
        ...parsed,
        available: statsOut.length > 0 && hasAnyData,
      };
    } catch (e) {
      networkError.value = String(e);
    } finally {
      isLoadingNetwork.value = false;
    }
  }

  async function fetchBatteryStats(_options?: { force?: boolean }) {
    if (!isReady.value) return;
    isLoadingBattery.value = true;
    batteryError.value = null;
    try {
      const out = await shellCommand(
        serial.value,
        `dumpsys batterystats --charged ${packageName.value} 2>/dev/null | head -60`,
      );
      batteryStats.value = parseBatteryStats(out);
    } catch (e) {
      batteryError.value = String(e);
    } finally {
      isLoadingBattery.value = false;
    }
  }

  async function fetchCapacitorInfo(options?: { force?: boolean }) {
    if (!isReady.value) return;
    isLoadingCap.value = true;
    try {
      const dump = await getPackageDump(options);
      capacitorInfo.value = detectCapacitor(dump);
    } catch {
      capacitorInfo.value = {
        isCapacitor: false,
        bridgeActivity: null,
        plugins: [],
        version: null,
      };
    } finally {
      isLoadingCap.value = false;
    }
  }

  function resetAll() {
    stopLive();
    permissions.value = null;
    networkStats.value = null;
    batteryStats.value = null;
    capacitorInfo.value = null;
    pkgDump.value = null;
    pkgDumpPromise = null;
    permsError.value = null;
    networkError.value = null;
    batteryError.value = null;
  }

  function invalidatePackageDump() {
    pkgDump.value = null;
    pkgDumpPromise = null;
  }

  watch(
    [serial, packageName],
    ([s, p]) => {
      resetAll();
      if (s && p) {
        startLive();
        void fetchCapacitorInfo();
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stopLive();
  });

  return {
    memInfo,
    cpuInfo,
    isLive,
    liveError,
    refetchLive: fetchLive,
    permissions,
    isLoadingPerms,
    permsError,
    fetchPermissions,
    networkStats,
    isLoadingNetwork,
    networkError,
    fetchNetworkStats,
    batteryStats,
    isLoadingBattery,
    batteryError,
    fetchBatteryStats,
    capacitorInfo,
    isLoadingCap,
    fetchCapacitorInfo,
    invalidatePackageDump,
  };
}
