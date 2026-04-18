<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { ref, reactive, computed, watch } from "vue";
import {
  X,
  Usb,
  Wifi,
  Link,
  ExternalLink,
  RefreshCw,
  Loader2,
  Smartphone,
  Globe,
  Play,
  XCircle,
  Plus,
  WifiOff,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useDevicesStore } from "@/stores/devices.store";
import { useSourceStore } from "@/stores/source.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useConnectionStore } from "@/stores/connection.store";
import { useAdb } from "@/composables/useAdb";
import type { CDPTarget } from "@/types/cdp.types";
import AdbReversePopover from "@/components/layout/AdbReversePopover.vue";
import { ChevronRight } from "lucide-vue-next";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; selectDevice: [serial: string] }>();

const devicesStore = useDevicesStore();
const sourceStore = useSourceStore();
const targetsStore = useTargetsStore();
const connectionStore = useConnectionStore();
const { getDeviceOverview, tcpip, connectDevice, disconnectDevice, pairDevice } = useAdb();

type Panel = "device" | "local" | "connect";
const activePanel = ref<Panel>("device");
const selectedSerial = ref<string | null>(null);
const deviceInfoCache = reactive<Record<string, Awaited<ReturnType<typeof getDeviceOverview>>>>({});
const deviceInfoLoading = ref(false);
const isRefreshingDevices = ref(false);
const scanningTargets = ref(false);
const wifiIp = ref("");
const wifiPort = ref("5555");
const pairAddr = ref("");
const pairCode = ref("");
const chromePortInput = ref(9223);
const showChromePortInput = ref(false);
const chromeNewUrl = ref("https://");
const openingChromeUrl = ref(false);
const isWifiConnecting = ref(false);

const selectedDevice = computed(
  () => devicesStore.devices.find((d) => d.serial === selectedSerial.value) ?? null,
);
const selectedDeviceInfo = computed(() =>
  selectedSerial.value ? (deviceInfoCache[selectedSerial.value] ?? null) : null,
);
const isUsb = computed(() => selectedDevice.value?.connectionType === "usb");

const androidTargets = computed(() =>
  targetsStore.targets.filter((t) => t.source === "adb" && t.deviceSerial === selectedSerial.value),
);
const chromeTargets = computed(() => targetsStore.targets.filter((t) => t.source === "chrome"));
const isFetchingTargets = computed(() => targetsStore.fetchingSources.size > 0);

function connStatus(id: string) {
  return connectionStore.connections.get(id)?.status ?? "disconnected";
}

function getRemoteDevtoolsUrl(target: CDPTarget, wsDebuggerUrl: string, frontendPort: number) {
  try {
    const wsUrl = new URL(wsDebuggerUrl);
    if (wsUrl.protocol !== "ws:" && wsUrl.protocol !== "wss:") {
      return null;
    }

    const wsAddress = `${wsUrl.host}${wsUrl.pathname}${wsUrl.search}`;
    if (target.devtoolsFrontendUrl) {
      const baseUrl = `http://127.0.0.1:${frontendPort}`;
      const frontendUrl = new URL(target.devtoolsFrontendUrl, baseUrl);
      frontendUrl.searchParams.set("ws", wsAddress);
      frontendUrl.searchParams.set("dockSide", "undocked");
      return frontendUrl.toString();
    }

    const query = new URLSearchParams({
      ws: wsAddress,
      dockSide: "undocked",
    }).toString();
    return `http://127.0.0.1:${frontendPort}/devtools/inspector.html?${query}`;
  } catch {
    return null;
  }
}

async function resolveRemoteDevtoolsWsUrl(target: CDPTarget) {
  if (target.source !== "adb") {
    console.log("[device-manager] external-devtools raw ws", {
      targetId: target.id,
      wsUrl: target.webSocketDebuggerUrl,
    });
    return target.webSocketDebuggerUrl;
  }

  const proxy = await invoke<{ wsUrl: string; localPort: number }>("cdp_start_proxy", {
    wsUrl: target.webSocketDebuggerUrl,
  });

  console.log("[device-manager] external-devtools proxy ws", {
    targetId: target.id,
    rawWsUrl: target.webSocketDebuggerUrl,
    proxyWsUrl: proxy.wsUrl,
    proxyPort: proxy.localPort,
  });
  return proxy.wsUrl;
}

async function handleOpenRemoteDevtools(target: CDPTarget, event: Event) {
  event.stopPropagation();
  const chromeSource = sourceStore.getChromeSource();
  if (!chromeSource) {
    toast.error("Connect Local Chrome first", {
      description: "DevTools frontend comes from the Local Chrome debug session.",
    });
    return;
  }

  try {
    console.log("[device-manager] external-devtools open:start", {
      targetId: target.id,
      source: target.source,
      selectedTargetId: targetsStore.selectedTarget?.id ?? null,
      hasExistingConnection: connectionStore.connections.has(target.id),
    });
    connectionStore.setExternalDevtoolsTarget(target.id);
    if (connectionStore.connections.has(target.id)) {
      await connectionStore.disconnectTarget(target.id);
    }
    if (targetsStore.selectedTarget?.id === target.id) {
      targetsStore.selectTarget(null);
    }

    const wsDebuggerUrl = await resolveRemoteDevtoolsWsUrl(target);
    const devtoolsUrl = getRemoteDevtoolsUrl(target, wsDebuggerUrl, chromeSource.port);
    if (!devtoolsUrl) {
      toast.error("Unable to open DevTools", {
        description: "Target does not expose a valid CDP WebSocket URL.",
      });
      return;
    }

    console.log("[device-manager] external-devtools open:url", {
      targetId: target.id,
      devtoolsFrontendUrl: target.devtoolsFrontendUrl ?? null,
      devtoolsUrl,
    });
    await invoke("chrome_open_devtools_url", { url: devtoolsUrl });
  } catch (err) {
    console.error("[device-manager] external-devtools open:error", {
      targetId: target.id,
      error: String(err),
    });
    toast.error("Failed to open DevTools window", { description: String(err) });
  }
}

async function loadDeviceInfo(serial: string) {
  if (deviceInfoCache[serial]) return;
  deviceInfoLoading.value = true;
  try {
    const info = await getDeviceOverview(serial);
    if (info) deviceInfoCache[serial] = info;
  } catch {
    // info unavailable
  } finally {
    deviceInfoLoading.value = false;
  }
}

async function handleRefreshTargets() {
  if (scanningTargets.value) return;
  scanningTargets.value = true;
  const wasPolling = devicesStore.isPolling;
  if (wasPolling) devicesStore.stopPolling();
  try {
    await Promise.all(sourceStore.activeSources.map((s) => targetsStore.fetchTargetsForSource(s)));
  } finally {
    scanningTargets.value = false;
    if (wasPolling && props.open) devicesStore.startPolling(3000);
  }
}

async function handleRefreshDevices() {
  if (isRefreshingDevices.value) {
    return;
  }
  isRefreshingDevices.value = true;
  try {
    await devicesStore.refreshDevices();
    if (
      selectedSerial.value &&
      !devicesStore.devices.some((d) => d.serial === selectedSerial.value)
    ) {
      selectedSerial.value =
        devicesStore.selectedDevice?.serial ?? devicesStore.devices[0]?.serial ?? null;
    }
  } finally {
    isRefreshingDevices.value = false;
  }
}

async function handleSelectTarget(target: CDPTarget) {
  const wasPolling = devicesStore.isPolling;
  if (wasPolling) devicesStore.stopPolling();
  try {
    const prevId = connectionStore.selectedTargetId;
    if (prevId && prevId !== target.id) {
      await connectionStore.disconnectTarget(prevId);
    }
    connectionStore.clearExternalDevtoolsTarget(target.id);
    targetsStore.selectTarget(target);
    await connectionStore.connect(target);
    emit("close");
  } catch (err) {
    toast.error("Failed to connect to target", { description: String(err) });
    if (wasPolling && props.open) devicesStore.startPolling(3000);
  }
}

async function handleDisconnectTarget(targetId: string, event: Event) {
  event.stopPropagation();
  try {
    await connectionStore.disconnectTarget(targetId);
    if (targetsStore.selectedTarget?.id === targetId) {
      targetsStore.selectTarget(null);
    }
    toast.info("Target disconnected");
  } catch (err) {
    toast.error("Failed to disconnect", { description: String(err) });
  }
}

async function selectSidebarDevice(serial: string) {
  const d = devicesStore.devices.find((x) => x.serial === serial);
  if (!d) return;
  const wasPolling = devicesStore.isPolling;
  if (wasPolling) devicesStore.stopPolling();
  selectedSerial.value = serial;
  activePanel.value = "device";
  devicesStore.selectDevice(d);
  emit("selectDevice", serial);
  await loadDeviceInfo(serial);
  if (wasPolling && props.open) devicesStore.startPolling(3000);
}

async function handleDisconnectDevice() {
  if (!selectedDevice.value) return;
  const { serial, connectionType } = selectedDevice.value;
  if (connectionType !== "usb") {
    const lastColon = serial.lastIndexOf(":");
    if (lastColon !== -1) {
      const host = serial.slice(0, lastColon);
      const port = parseInt(serial.slice(lastColon + 1), 10);
      try {
        await disconnectDevice(host, port);
      } catch {
        /* ignore */
      }
    }
  }
  selectedSerial.value = null;
  await devicesStore.refreshDevices();
  toast.info("Device disconnected");
}

async function handleWifiDebug() {
  if (!selectedSerial.value || isWifiConnecting.value) return;
  isWifiConnecting.value = true;

  // Pause polling so it doesn't race with the WiFi switch
  const wasPolling = devicesStore.isPolling;
  if (wasPolling) devicesStore.stopPolling();

  try {
    // Grab the IP while the device is still reachable over USB
    let ip = selectedDeviceInfo.value?.ipAddresses?.[0];
    if (!ip) {
      const info = await getDeviceOverview(selectedSerial.value);
      if (info) {
        deviceInfoCache[selectedSerial.value] = info;
        ip = info.ipAddresses?.[0];
      }
    }

    // Switch to TCP mode (may drop the USB connection immediately)
    await tcpip(selectedSerial.value, 5555);

    if (!ip) {
      toast.warning("WiFi mode enabled — connect manually", {
        description: "Could not detect device IP. Run: adb connect <ip>:5555",
      });
      return;
    }

    // Wait for the device to restart its ADB listener in TCP mode
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    await connectDevice(ip, 5555);
    await devicesStore.refreshDevices();

    toast.success("WiFi debugging active", {
      description: `Connected via ${ip}:5555 — you can remove the USB cable`,
    });
  } catch (err) {
    toast.error("Failed to enable WiFi debugging", {
      description: String(err),
    });
  } finally {
    isWifiConnecting.value = false;
    if (wasPolling && props.open) devicesStore.startPolling(3000);
  }
}

async function handleTcpConnect() {
  if (!wifiIp.value) {
    toast.error("Enter an IP address");
    return;
  }
  const port = parseInt(wifiPort.value, 10) || 5555;
  try {
    await connectDevice(wifiIp.value, port);
    toast.success("Device connected", {
      description: `${wifiIp.value}:${port}`,
    });
    await devicesStore.refreshDevices();
  } catch (err) {
    toast.error("Failed to connect", { description: String(err) });
  }
}

async function handlePair() {
  if (!pairAddr.value || !pairCode.value) {
    toast.error("Enter address and pairing code");
    return;
  }
  const [host, portStr] = pairAddr.value.split(":");
  const port = parseInt(portStr, 10);
  if (!host || isNaN(port)) {
    toast.error("Invalid address", {
      description: "Expected format: 192.168.1.x:PORT",
    });
    return;
  }
  try {
    await pairDevice(host, port, pairCode.value);
    toast.success("Paired successfully", { description: pairAddr.value });
    pairCode.value = "";
  } catch (err) {
    toast.error("Pairing failed", { description: String(err) });
  }
}

async function handleChromeLaunch() {
  const ok = await sourceStore.launchChrome();
  if (ok) {
    toast.success("Chrome launched", {
      description: `Port ${sourceStore.getChromeSource()?.port}`,
    });
    setTimeout(() => handleRefreshTargets(), 800);
  } else {
    toast.error("Failed to launch Chrome", {
      description: sourceStore.chromeError ?? "Unknown error",
    });
  }
}

async function handleChromeConnect() {
  const ok = await sourceStore.connectChrome(chromePortInput.value);
  if (ok) {
    showChromePortInput.value = false;
    localStorage.setItem("capubridge:chrome-port", String(chromePortInput.value));
    toast.success("Connected to Chrome", {
      description: `Port ${chromePortInput.value}`,
    });
    setTimeout(() => handleRefreshTargets(), 500);
  } else {
    toast.error("Failed to connect", {
      description: sourceStore.chromeError ?? "Unknown error",
    });
  }
}

async function handleChromeDisconnect() {
  await sourceStore.disconnectChrome();
  toast.info("Chrome disconnected");
}

async function handleChromeOpenUrl() {
  const source = sourceStore.getChromeSource();
  if (!source) {
    toast.error("Chrome is not connected");
    return;
  }
  const raw = chromeNewUrl.value.trim();
  if (!raw) {
    toast.error("Enter URL first");
    return;
  }
  const normalizedUrl =
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("about:") ||
    raw.startsWith("file:")
      ? raw
      : `https://${raw}`;

  openingChromeUrl.value = true;
  try {
    const target = await targetsStore.createChromeTarget(normalizedUrl, source.port);
    await handleRefreshTargets();
    await handleSelectTarget(target);
  } catch (err) {
    toast.error("Failed to open debuggable tab", { description: String(err) });
  } finally {
    openingChromeUrl.value = false;
  }
}

// Show toast feedback when ADB server is being auto-started
let adbToastId: string | number | undefined;
watch(
  () => devicesStore.adbServerStatus,
  (status, prev) => {
    if (status === "starting") {
      adbToastId = toast.loading("Starting ADB server…", { duration: Infinity });
    } else if (status === "running" && prev === "starting") {
      if (adbToastId !== undefined) toast.dismiss(adbToastId);
      toast.success("ADB server ready");
      adbToastId = undefined;
    } else if (status === "error") {
      if (adbToastId !== undefined) toast.dismiss(adbToastId);
      toast.error("Could not start ADB server", {
        description: "Make sure adb is installed and in your PATH.",
      });
      adbToastId = undefined;
    }
  },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      devicesStore.startPolling(3000);
      if (devicesStore.selectedDevice) {
        selectedSerial.value = devicesStore.selectedDevice.serial;
        activePanel.value = "device";
        void loadDeviceInfo(devicesStore.selectedDevice.serial);
      } else if (sourceStore.hasChromeSource) {
        activePanel.value = "local";
      } else if (devicesStore.devices.length) {
        selectedSerial.value = devicesStore.devices[0].serial;
        activePanel.value = "device";
        void loadDeviceInfo(devicesStore.devices[0].serial);
      }
    } else {
      devicesStore.stopPolling();
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-[0.97]"
      leave-active-class="transition-all duration-120 ease-in"
      leave-to-class="opacity-0 scale-[0.97]"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/65 backdrop-blur-sm" @click="emit('close')" />

        <div
          class="relative flex bg-surface-1 border border-border/25 rounded-2xl overflow-hidden shadow-2xl"
          style="width: 760px; height: 490px"
        >
          <!-- LEFT SIDEBAR -->
          <div class="w-[196px] border-r border-border/20 flex flex-col shrink-0 bg-surface-0/60">
            <div class="px-3 pt-4 pb-2 flex items-center gap-2">
              <span
                class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
              >
                Devices
              </span>
              <span class="ml-auto text-[10px] font-mono text-muted-foreground/30">
                {{ devicesStore.onlineDevices.length }}/{{ devicesStore.devices.length }}
              </span>
              <button
                class="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
                :disabled="isRefreshingDevices"
                @click="void handleRefreshDevices()"
                title="Refresh devices"
              >
                <RefreshCw :size="11" :class="{ 'animate-spin': isRefreshingDevices }" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
              <!-- Empty state -->
              <div
                v-if="devicesStore.devices.length === 0"
                class="flex flex-col items-center justify-center py-10 gap-1.5"
              >
                <Smartphone :size="20" class="text-muted-foreground/15" />
                <p class="text-[11px] text-muted-foreground/30 text-center">
                  No Android devices<br />Connect via USB
                </p>
              </div>

              <button
                v-for="d in devicesStore.devices"
                :key="d.serial"
                @click="selectSidebarDevice(d.serial)"
                class="w-full text-left px-2.5 py-2 rounded-lg transition-colors"
                :class="
                  activePanel === 'device' && selectedSerial === d.serial
                    ? 'bg-surface-2 border border-border/30'
                    : 'hover:bg-surface-2/50 border border-transparent'
                "
              >
                <div class="flex items-center gap-1.5">
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    :class="d.status === 'online' ? 'bg-status-success' : 'bg-muted-foreground/25'"
                  />
                  <span class="text-[12px] font-medium text-foreground truncate">
                    {{ d.model || d.serial }}
                  </span>
                </div>
                <div class="flex items-center gap-1 mt-0.5 pl-3">
                  <span class="font-mono text-[9px] text-muted-foreground/35 truncate">
                    {{ d.serial.slice(0, 10) }}
                  </span>
                  <span class="text-muted-foreground/20 text-[9px]">·</span>
                  <component
                    :is="d.connectionType === 'usb' ? Usb : Wifi"
                    :size="9"
                    class="text-muted-foreground/30 shrink-0"
                  />
                  <span class="text-[9px] text-muted-foreground/35">
                    {{ d.connectionType === "usb" ? "USB" : "WiFi" }}
                  </span>
                </div>
              </button>
            </div>

            <!-- Local Chrome + Connect New -->
            <div class="px-2 pb-2 space-y-1 border-t border-border/15 pt-2">
              <button
                @click="activePanel = 'local'"
                class="w-full text-left px-2.5 py-2 rounded-lg transition-colors"
                :class="
                  activePanel === 'local'
                    ? 'bg-surface-2 border border-border/30'
                    : 'hover:bg-surface-2/50 border border-transparent'
                "
              >
                <div class="flex items-center gap-1.5">
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    :class="
                      sourceStore.hasChromeSource ? 'bg-status-success' : 'bg-muted-foreground/15'
                    "
                  />
                  <Globe :size="11" class="text-muted-foreground/40 shrink-0" />
                  <span class="text-[12px] font-medium text-foreground/70">Local</span>
                  <span
                    v-if="sourceStore.hasChromeSource"
                    class="ml-auto font-mono text-[9px] text-muted-foreground/35"
                  >
                    :{{ sourceStore.getChromeSource()?.port }}
                  </span>
                </div>
              </button>

              <button
                @click="activePanel = 'connect'"
                class="w-full text-left px-2.5 py-2 rounded-lg transition-colors"
                :class="
                  activePanel === 'connect'
                    ? 'bg-surface-2 border border-border/30'
                    : 'hover:bg-surface-2/50 border border-transparent'
                "
              >
                <div class="flex items-center gap-1.5 text-muted-foreground/40">
                  <Plus :size="11" class="shrink-0" />
                  <span class="text-[11px]">Connect new device</span>
                </div>
              </button>
            </div>
          </div>

          <!-- RIGHT PANEL -->
          <div class="flex-1 flex flex-col overflow-hidden">
            <!-- ── DEVICE PANEL ── -->
            <template v-if="activePanel === 'device'">
              <template v-if="selectedDevice">
                <!-- Header -->
                <div class="px-6 pt-5 pb-4 border-b border-border/15 shrink-0">
                  <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-0.5">
                        <span class="text-[15px] font-semibold text-foreground">
                          {{ selectedDevice.model || selectedDevice.serial }}
                        </span>
                        <span
                          class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          :class="
                            selectedDevice.status === 'online'
                              ? 'bg-status-success/10 text-status-success border border-status-success/20'
                              : 'bg-surface-2 text-muted-foreground/40 border border-border/20'
                          "
                        >
                          {{ selectedDevice.status }}
                        </span>
                      </div>
                      <div
                        class="flex items-center gap-2 text-[11px] text-muted-foreground/40 font-mono"
                      >
                        <span>{{ selectedDevice.serial }}</span>
                        <template v-if="selectedDeviceInfo">
                          <span class="text-muted-foreground/20">·</span>
                          <span>Android {{ selectedDeviceInfo.androidVersion }}</span>
                          <span class="text-muted-foreground/20">·</span>
                          <span>API {{ selectedDeviceInfo.apiLevel }}</span>
                        </template>
                        <Loader2
                          v-else-if="deviceInfoLoading"
                          :size="10"
                          class="animate-spin text-muted-foreground/30"
                        />
                      </div>
                    </div>
                    <!-- Device actions -->
                    <div class="flex items-center gap-1.5 shrink-0">
                      <button
                        v-if="isUsb"
                        @click="handleWifiDebug"
                        :disabled="isWifiConnecting"
                        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/25 bg-surface-2 hover:border-border/45 hover:bg-surface-3 transition-colors text-[11px] text-muted-foreground/60 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Switch to WiFi debugging"
                      >
                        <Loader2 v-if="isWifiConnecting" :size="11" class="animate-spin" />
                        <Wifi v-else :size="11" />
                        WiFi
                      </button>
                      <AdbReversePopover :serial="selectedDevice.serial" />
                      <button
                        @click="handleDisconnectDevice"
                        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/25 bg-surface-2 hover:border-error/30 hover:bg-error/10 hover:text-error transition-colors text-[11px] text-muted-foreground/50"
                        title="Disconnect device"
                      >
                        <WifiOff v-if="selectedDevice.connectionType !== 'usb'" :size="11" />
                        <Usb v-else :size="11" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Targets -->
                <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <span
                        class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                      >
                        Targets
                      </span>
                      <button
                        class="flex items-center gap-1 text-[10px] transition-colors"
                        :class="
                          scanningTargets || isFetchingTargets
                            ? 'text-muted-foreground/20 cursor-not-allowed'
                            : 'text-muted-foreground/30 hover:text-muted-foreground/60'
                        "
                        :disabled="scanningTargets || isFetchingTargets"
                        @click="handleRefreshTargets"
                      >
                        <RefreshCw
                          :size="9"
                          :class="{
                            'animate-spin': scanningTargets || isFetchingTargets,
                          }"
                        />
                        Refresh
                      </button>
                    </div>

                    <!-- Target list -->
                    <div v-if="androidTargets.length" class="space-y-1">
                      <div
                        v-for="t in androidTargets"
                        :key="t.id"
                        @click="handleSelectTarget(t)"
                        class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors text-left group cursor-pointer"
                        :class="
                          targetsStore.selectedTarget?.id === t.id
                            ? 'bg-surface-2 border-border/35'
                            : 'border-transparent hover:bg-surface-2/60 hover:border-border/20'
                        "
                      >
                        <span
                          class="w-1.5 h-1.5 rounded-full shrink-0"
                          :class="
                            connStatus(t.id) === 'connected'
                              ? 'bg-status-success'
                              : 'bg-muted-foreground/20'
                          "
                        />
                        <div class="flex-1 min-w-0">
                          <div class="text-[12px] text-foreground/80 truncate leading-tight">
                            {{ t.title || "(no title)" }}
                          </div>
                          <div
                            class="text-[10px] font-mono text-muted-foreground/35 truncate mt-0.5"
                          >
                            {{ t.url }}
                          </div>
                        </div>
                        <button
                          @click="handleOpenRemoteDevtools(t, $event)"
                          class="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-surface-3 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          :title="
                            sourceStore.hasChromeSource
                              ? 'Open remote DevTools'
                              : 'Connect Local Chrome first'
                          "
                        >
                          <ExternalLink :size="11" />
                        </button>
                        <ChevronRight
                          :size="11"
                          class="text-muted-foreground/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    </div>

                    <div
                      v-else-if="scanningTargets || isFetchingTargets"
                      class="flex items-center gap-2 py-6 text-[11px] text-muted-foreground/35"
                    >
                      <Loader2 :size="12" class="animate-spin" />
                      Scanning for targets…
                    </div>

                    <div v-else class="py-6 text-center text-[11px] text-muted-foreground/25">
                      No debuggable targets found.
                      <button
                        class="underline underline-offset-2 hover:text-muted-foreground/50 transition-colors ml-1"
                        @click="handleRefreshTargets"
                      >
                        Scan again
                      </button>
                    </div>
                  </div>
                </div>
              </template>

              <!-- No device selected -->
              <div
                v-else
                class="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8"
              >
                <Smartphone :size="28" class="text-muted-foreground/15" />
                <p class="text-[12px] text-muted-foreground/30">Select a device from the sidebar</p>
              </div>
            </template>

            <!-- ── LOCAL / CHROME PANEL ── -->
            <template v-else-if="activePanel === 'local'">
              <div class="px-6 pt-5 pb-4 border-b border-border/15 shrink-0">
                <div class="flex items-start gap-3">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                      <Globe :size="15" class="text-muted-foreground/50" />
                      <span class="text-[15px] font-semibold text-foreground">Local Chrome</span>
                      <span
                        v-if="sourceStore.hasChromeSource"
                        class="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-status-success/10 text-status-success border border-status-success/20"
                      >
                        connected
                      </span>
                    </div>
                    <div
                      v-if="sourceStore.hasChromeSource"
                      class="text-[11px] font-mono text-muted-foreground/40"
                    >
                      Port :{{ sourceStore.getChromeSource()?.port }}
                    </div>
                    <div v-else class="text-[11px] text-muted-foreground/35">
                      Chrome debug session · localhost
                    </div>
                  </div>

                  <!-- Chrome controls -->
                  <div class="flex items-center gap-2 shrink-0">
                    <template v-if="sourceStore.hasChromeSource">
                      <button
                        @click="handleChromeDisconnect"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/25 bg-surface-2 hover:border-border/45 hover:bg-surface-3 transition-colors text-[11px] text-muted-foreground/50 hover:text-foreground"
                      >
                        <XCircle :size="11" />
                        Disconnect
                      </button>
                    </template>
                    <template v-else>
                      <button
                        @click="handleChromeLaunch"
                        :disabled="sourceStore.chromeStatus === 'launching'"
                        class="flex items-center gap-1.5 px-3.5 py-1.5 bg-foreground text-background text-[12px] font-medium rounded-lg hover:opacity-85 transition-opacity disabled:opacity-40"
                      >
                        <Loader2
                          v-if="sourceStore.chromeStatus === 'launching'"
                          :size="11"
                          class="animate-spin"
                        />
                        <Play v-else :size="11" />
                        Launch Chrome
                      </button>
                      <button
                        @click="showChromePortInput = !showChromePortInput"
                        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/25 text-[11px] text-muted-foreground/40 hover:text-foreground hover:bg-surface-2 transition-colors"
                        title="Connect to custom port"
                      >
                        <Link :size="11" />
                      </button>
                    </template>
                  </div>
                </div>

                <!-- Manual port input -->
                <Transition
                  enter-active-class="transition-all duration-150 ease-out"
                  leave-active-class="transition-all duration-100 ease-in"
                  enter-from-class="opacity-0 -translate-y-1"
                  leave-to-class="opacity-0 -translate-y-1"
                >
                  <div
                    v-if="showChromePortInput && !sourceStore.hasChromeSource"
                    class="flex items-center gap-2 mt-3"
                  >
                    <input
                      v-model.number="chromePortInput"
                      type="number"
                      placeholder="9223"
                      class="w-24 h-7 px-2 bg-surface-2 border border-border/30 rounded-md text-[12px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
                    />
                    <button
                      @click="handleChromeConnect"
                      class="h-7 px-3 rounded-md bg-surface-2 border border-border/30 text-[11px] hover:bg-surface-3 transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                </Transition>

                <div v-if="sourceStore.hasChromeSource" class="mt-3 space-y-1.5">
                  <div
                    class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35"
                  >
                    New Tab URL
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="chromeNewUrl"
                      placeholder="https://example.com"
                      class="flex-1 h-7 px-2 bg-surface-2 border border-border/30 rounded-md text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
                      @keydown.enter="void handleChromeOpenUrl()"
                    />
                    <button
                      @click="void handleChromeOpenUrl()"
                      :disabled="openingChromeUrl"
                      class="h-7 px-3 rounded-md bg-surface-2 border border-border/30 text-[11px] hover:bg-surface-3 transition-colors disabled:opacity-50"
                    >
                      <Loader2 v-if="openingChromeUrl" :size="11" class="animate-spin" />
                      <span v-else>Open</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Chrome targets -->
              <div class="flex-1 overflow-y-auto px-6 py-4">
                <div class="flex items-center justify-between mb-2">
                  <span
                    class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                  >
                    Targets
                  </span>
                  <button
                    class="flex items-center gap-1 text-[10px] transition-colors"
                    :class="
                      scanningTargets || isFetchingTargets
                        ? 'text-muted-foreground/20 cursor-not-allowed'
                        : 'text-muted-foreground/30 hover:text-muted-foreground/60'
                    "
                    :disabled="scanningTargets || isFetchingTargets"
                    @click="handleRefreshTargets"
                  >
                    <RefreshCw
                      :size="9"
                      :class="{ 'animate-spin': scanningTargets || isFetchingTargets }"
                    />
                    Refresh
                  </button>
                </div>

                <div v-if="chromeTargets.length" class="space-y-1">
                  <div
                    v-for="t in chromeTargets"
                    :key="t.id"
                    @click="handleSelectTarget(t)"
                    class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors text-left group cursor-pointer"
                    :class="
                      targetsStore.selectedTarget?.id === t.id
                        ? 'bg-surface-2 border-border/35'
                        : 'border-transparent hover:bg-surface-2/60 hover:border-border/20'
                    "
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      :class="
                        connStatus(t.id) === 'connected'
                          ? 'bg-status-success'
                          : 'bg-muted-foreground/20'
                      "
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-[12px] text-foreground/80 truncate">
                        {{ t.title || "(no title)" }}
                      </div>
                      <div class="text-[10px] font-mono text-muted-foreground/35 truncate mt-0.5">
                        {{ t.url }}
                      </div>
                    </div>
                    <button
                      @click="handleOpenRemoteDevtools(t, $event)"
                      class="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-surface-3 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title="Open remote DevTools"
                    >
                      <ExternalLink :size="11" />
                    </button>
                    <button
                      v-if="connStatus(t.id) === 'connected'"
                      @click="handleDisconnectTarget(t.id, $event)"
                      class="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground/50 hover:text-error hover:bg-error/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title="Disconnect"
                    >
                      <XCircle :size="11" />
                    </button>
                    <ChevronRight
                      v-else
                      :size="11"
                      class="text-muted-foreground/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>

                <div
                  v-else-if="!sourceStore.hasChromeSource"
                  class="py-8 text-center text-[11px] text-muted-foreground/25"
                >
                  Launch or connect Chrome to see targets.
                </div>

                <div
                  v-else-if="isFetchingTargets"
                  class="flex items-center gap-2 py-6 text-[11px] text-muted-foreground/35"
                >
                  <Loader2 :size="12" class="animate-spin" />
                  Scanning…
                </div>

                <div v-else class="py-8 text-center text-[11px] text-muted-foreground/25">
                  No targets found.
                  <button
                    class="underline underline-offset-2 hover:text-muted-foreground/50 transition-colors ml-1"
                    @click="handleRefreshTargets"
                  >
                    Scan again
                  </button>
                </div>
              </div>
            </template>

            <!-- ── CONNECT NEW PANEL ── -->
            <template v-else-if="activePanel === 'connect'">
              <div class="px-6 pt-5 pb-3 border-b border-border/15 shrink-0">
                <h2 class="text-[15px] font-semibold text-foreground">Connect New Device</h2>
                <p class="text-[11px] text-muted-foreground/40 mt-0.5">
                  Connect wirelessly via TCP/IP or Wireless Debugging
                </p>
              </div>

              <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                <!-- TCP/IP -->
                <div class="space-y-2">
                  <div
                    class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                  >
                    TCP / IP (Android ≤ 10)
                  </div>
                  <div class="text-[11px] text-muted-foreground/35 font-mono">
                    Run
                    <span
                      class="bg-surface-2 px-1.5 py-0.5 rounded border border-border/20 text-foreground/60"
                      >adb tcpip 5555</span
                    >
                    on USB device first
                  </div>
                  <div class="flex gap-2 mt-1">
                    <input
                      v-model="wifiIp"
                      placeholder="192.168.1.100"
                      class="flex-1 h-8 px-3 bg-surface-2 border border-border/30 rounded-lg text-[12px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/25"
                    />
                    <div
                      class="flex items-center bg-surface-2 border border-border/30 rounded-lg px-2"
                    >
                      <span class="text-[11px] text-muted-foreground/35">:</span>
                      <input
                        v-model="wifiPort"
                        class="w-14 h-8 bg-transparent text-[12px] font-mono text-foreground focus:outline-none px-1 placeholder:text-muted-foreground/25"
                      />
                    </div>
                    <button
                      @click="handleTcpConnect"
                      class="px-4 h-8 bg-foreground text-background text-[12px] font-medium rounded-lg hover:opacity-85 transition-opacity flex items-center gap-1.5"
                    >
                      <Link :size="12" /> Connect
                    </button>
                  </div>
                </div>

                <!-- Wireless Debugging (Android 11+) -->
                <div class="space-y-2">
                  <div
                    class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                  >
                    Wireless Debugging (Android 11+)
                  </div>
                  <p class="text-[11px] text-muted-foreground/35 leading-relaxed">
                    Settings → Developer options → Wireless debugging → Pair with pairing code
                  </p>
                  <div class="flex gap-2">
                    <input
                      v-model="pairAddr"
                      placeholder="192.168.1.100:37261"
                      class="flex-1 h-8 px-3 bg-surface-2 border border-border/30 rounded-lg text-[12px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/25"
                    />
                    <input
                      v-model="pairCode"
                      placeholder="123456"
                      class="w-24 h-8 px-3 bg-surface-2 border border-border/30 rounded-lg text-[12px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/25"
                    />
                    <button
                      @click="handlePair"
                      class="px-4 h-8 bg-surface-2 border border-border/30 text-[12px] text-foreground/70 font-medium rounded-lg hover:bg-surface-3 hover:text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <Wifi :size="12" /> Pair
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
