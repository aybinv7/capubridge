<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  Usb,
  Wifi,
  Link,
  RefreshCw,
  Loader2,
  Smartphone,
  Globe,
  Plus,
  WifiOff,
  Monitor,
  Crosshair,
  Trash2,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useConnectionStore } from "@/stores/connection.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useAdb } from "@/composables/useAdb";
import { useAppPackages } from "@/composables/useAppPackages";
import { normalizeInspectableUrl } from "@/lib/inspect-url";
import type { CDPTarget } from "@/types/cdp.types";
import AdbReversePopover from "@/components/layout/AdbReversePopover.vue";
import { ChevronRight } from "lucide-vue-next";
import AppIcon from "@/modules/devices/AppIcon.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; selectDevice: [serial: string] }>();

const router = useRouter();
const devicesStore = useDevicesStore();
const targetsStore = useTargetsStore();
const connectionStore = useConnectionStore();
const localWebviewStore = useLocalWebviewStore();
const mirrorStore = useMirrorStore();
const { getDeviceOverview, tcpip, connectDevice, disconnectDevice, pairDevice } = useAdb();

type Panel = "device" | "local" | "connect";
const activePanel = ref<Panel>("device");
const selectedSerial = ref<string | null>(null);
const { getCachedPackage } = useAppPackages(selectedSerial);
const deviceInfoCache = reactive<Record<string, Awaited<ReturnType<typeof getDeviceOverview>>>>({});
const deviceInfoLoading = ref(false);
const isRefreshingDevices = ref(false);
const scanningTargets = ref(false);
const wifiIp = ref("");
const wifiPort = ref("5555");
const pairAddr = ref("");
const pairCode = ref("");
const localTargetUrl = ref("http://localhost:5173");
const creatingLocalTarget = ref(false);
const localDeviceName = ref("This PC");
const isWifiConnecting = ref(false);
const expandedTargetPackages = ref<Set<string>>(new Set());
const openRunId = ref(0);

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
const localTargets = computed(() => targetsStore.targets.filter((t) => t.source === "local"));
const isFetchingTargets = computed(() => targetsStore.fetchingSources.size > 0);
const groupedAndroidTargets = computed(() => {
  const groups = new Map<string, CDPTarget[]>();
  for (const target of androidTargets.value) {
    const key = target.packageName?.trim() || "Unknown package";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(target);
  }
  return Array.from(groups.entries()).map(([packageName, targets]) => ({
    packageName,
    targets,
  }));
});

function targetTypeLabel(target: CDPTarget) {
  return target.type === "page" ? "page" : target.type;
}

function shouldCollapsePackage(packageName: string) {
  const group = groupedAndroidTargets.value.find((entry) => entry.packageName === packageName);
  return (group?.targets.length ?? 0) > 2;
}

function shouldShowPackageHeader(packageName: string) {
  const group = groupedAndroidTargets.value.find((entry) => entry.packageName === packageName);
  return (group?.targets.length ?? 0) > 1;
}

function isPackageExpanded(packageName: string) {
  if (!shouldCollapsePackage(packageName)) {
    return true;
  }
  return expandedTargetPackages.value.has(packageName);
}

function toggleTargetPackage(packageName: string) {
  if (!shouldCollapsePackage(packageName)) {
    return;
  }
  const next = new Set(expandedTargetPackages.value);
  if (next.has(packageName)) {
    next.delete(packageName);
  } else {
    next.add(packageName);
  }
  expandedTargetPackages.value = next;
}

async function loadDeviceInfo(serial: string) {
  if (deviceInfoCache[serial]) return;
  deviceInfoLoading.value = true;
  try {
    const info = await getDeviceOverview(serial);
    if (info) deviceInfoCache[serial] = info;
  } catch (error) {
    console.warn("Failed to load device overview", serial, error);
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
    if (activePanel.value === "local") {
      return;
    }

    const serial = selectedSerial.value ?? devicesStore.selectedDevice?.serial ?? null;
    if (!serial) {
      return;
    }

    await targetsStore.fetchTargetsForSource({ type: "adb", serial });
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
      if (selectedSerial.value) {
        activePanel.value = "device";
      }
    }
  } finally {
    isRefreshingDevices.value = false;
  }
}

async function connectRemoteTarget(target: CDPTarget) {
  const prevId = connectionStore.selectedTargetId;
  if (prevId && prevId !== target.id) {
    await connectionStore.disconnectTarget(prevId);
  }
  connectionStore.clearExternalDevtoolsTarget(target.id);
  targetsStore.selectTarget(target);
  await connectionStore.connect(target);
}

async function connectLocalTarget(target: CDPTarget) {
  const prevId = connectionStore.selectedTargetId;
  if (prevId && prevId !== target.id) {
    await connectionStore.disconnectTarget(prevId);
  }
  targetsStore.selectTarget(target);
  await localWebviewStore.ensureWebview(target);
}

async function warmLocalTargetCdp(targetId: string) {
  const target = targetsStore.targets.find((entry) => entry.id === targetId);
  if (!target || target.source !== "local") return;
  try {
    const readyTarget = await localWebviewStore.ensureCdpTarget(target);
    await connectionStore.connect(readyTarget);
    if (targetsStore.selectedTarget?.id === targetId) {
      targetsStore.selectTarget(readyTarget);
    }
  } catch (err) {
    toast.error("Local DevTools connection failed", { description: String(err) });
  }
}

async function handleSelectTarget(target: CDPTarget) {
  const wasPolling = devicesStore.isPolling;
  if (wasPolling) devicesStore.stopPolling();
  try {
    if (target.source === "local") {
      await connectLocalTarget(target);
      mirrorStore.open();
      emit("close");
      void warmLocalTargetCdp(target.id);
      return;
    }

    await connectRemoteTarget(target);
    emit("close");
  } catch (err) {
    toast.error("Failed to connect to target", { description: String(err) });
    if (wasPolling && props.open) devicesStore.startPolling(3000);
  }
}

async function handleInspectTarget(target: CDPTarget, event: Event) {
  event.stopPropagation();
  try {
    if (target.source === "local") {
      await connectLocalTarget(target);
      mirrorStore.open();
      emit("close");
      void warmLocalTargetCdp(target.id);
      await localWebviewStore.openDevtools(target);
      return;
    }

    await connectRemoteTarget(target);
    emit("close");
    await router.push("/inspect/elements");
  } catch (err) {
    toast.error("Failed to inspect target", { description: String(err) });
  }
}

async function handleDisconnectTarget(targetId: string, event: Event) {
  event.stopPropagation();
  try {
    const target = targetsStore.targets.find((entry) => entry.id === targetId) ?? null;
    if (target?.source === "local") {
      await localWebviewStore.closeTarget(target);
      targetsStore.removeTarget(targetId);
      toast.info("Local target removed");
      return;
    }

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
  await devicesStore.selectDevice(d);
  emit("selectDevice", serial);
  await loadDeviceInfo(serial);
  if (wasPolling && props.open) devicesStore.startPolling(3000);
}

function selectLocalDevice() {
  selectedSerial.value = null;
  activePanel.value = "local";
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
      } catch (error) {
        console.warn("Failed to disconnect device during WiFi transition", serial, error);
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

async function handleCreateLocalTarget() {
  const normalizedUrl = normalizeInspectableUrl(localTargetUrl.value);
  if (!normalizedUrl) {
    toast.error("Enter a valid URL");
    return;
  }

  creatingLocalTarget.value = true;
  try {
    const target = targetsStore.createLocalTarget(normalizedUrl);
    localTargetUrl.value = normalizedUrl;
    await handleSelectTarget(target);
  } catch (err) {
    toast.error("Failed to create local target", { description: String(err) });
  } finally {
    creatingLocalTarget.value = false;
  }
}

// Show toast feedback when ADB server is being auto-started
let adbToastId: string | number | undefined;
watch(
  () => devicesStore.adbServerStatus,
  (status, prev) => {
    if (status === "starting") {
      adbToastId = toast.loading("Starting ADB server…", {
        duration: Infinity,
      });
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
      void localWebviewStore.hideAll();
      const runId = ++openRunId.value;

      const preferredDevice =
        devicesStore.selectedDevice?.status === "online"
          ? devicesStore.selectedDevice
          : (devicesStore.onlineDevices[0] ?? null);

      if (preferredDevice) {
        void selectSidebarDevice(preferredDevice.serial);
      } else {
        selectLocalDevice();
      }

      void (async () => {
        await handleRefreshDevices();
        if (!props.open || runId !== openRunId.value) {
          return;
        }
      })();
    } else {
      openRunId.value += 1;
      devicesStore.stopPolling();
      localWebviewStore.requestLayoutSync();
    }
  },
);

onMounted(() => {
  void localWebviewStore.localDeviceName().then((name) => {
    localDeviceName.value = name;
  });
});

watch(
  groupedAndroidTargets,
  (groups) => {
    const next = new Set(
      groups
        .filter((group) => group.targets.length > 2)
        .map((group) => group.packageName)
        .filter((packageName) => expandedTargetPackages.value.has(packageName)),
    );
    if (next.size === 0 && groups.some((group) => group.targets.length > 2)) {
      for (const group of groups) {
        if (group.targets.length > 2) {
          next.add(group.packageName);
        }
      }
    }
    expandedTargetPackages.value = next;
  },
  { immediate: true },
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
          <div class="w-[196px] border-r border-border/20 flex flex-col shrink-0 bg-surface-0/60">
            <div class="px-3 pt-4 pb-2 flex items-center gap-2">
              <span
                class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
              >
                Devices
              </span>
              <span class="ml-auto text-[10px] font-mono text-muted-foreground/30">
                {{ devicesStore.onlineDevices.length + 1 }}/{{ devicesStore.devices.length + 1 }}
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
              <button
                @click="selectLocalDevice"
                class="w-full text-left px-2.5 py-2 rounded-lg transition-colors"
                :class="
                  activePanel === 'local'
                    ? 'bg-surface-2 border border-border/30'
                    : 'hover:bg-surface-2/50 border border-transparent'
                "
              >
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0 bg-success" />
                  <Monitor :size="11" class="text-muted-foreground/40 shrink-0" />
                  <span class="text-[12px] font-medium text-foreground truncate">
                    {{ localDeviceName }}
                  </span>
                </div>
                <div class="flex items-center gap-1 mt-0.5 pl-3">
                  <span class="font-mono text-[9px] text-muted-foreground/35 truncate">
                    local-host
                  </span>
                  <span class="text-muted-foreground/20 text-[9px]">·</span>
                  <span class="text-[9px] text-muted-foreground/35">Native WebView</span>
                </div>
              </button>

              <div
                v-if="devicesStore.devices.length === 0"
                class="px-2.5 py-3 text-[11px] text-muted-foreground/25"
              >
                No Android devices connected.
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
                    :class="d.status === 'online' ? 'bg-success' : 'bg-muted-foreground/25'"
                  />
                  <span class="text-[12px] font-medium text-foreground truncate">
                    {{ d.model || d.serial }}
                  </span>
                  <span
                    v-if="d.isStale"
                    class="ml-auto text-[9px] px-1.5 py-0.5 rounded-full border border-border/20 bg-surface-2 text-muted-foreground/45"
                  >
                    stale
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

            <div class="px-2 pb-2 space-y-1 border-t border-border/15 pt-2">
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
                              ? 'bg-success/10 text-success border border-success/20'
                              : 'bg-surface-2 text-muted-foreground/40 border border-border/20'
                          "
                        >
                          {{ selectedDevice.isStale ? "stale" : selectedDevice.status }}
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

                    <div v-if="groupedAndroidTargets.length" class="space-y-3">
                      <div
                        v-for="group in groupedAndroidTargets"
                        :key="group.packageName"
                        :class="
                          shouldShowPackageHeader(group.packageName)
                            ? 'rounded-xl border border-border/20 bg-surface-2/30 overflow-hidden'
                            : 'space-y-2'
                        "
                      >
                        <button
                          v-if="shouldShowPackageHeader(group.packageName)"
                          class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-3/40"
                          @click="toggleTargetPackage(group.packageName)"
                        >
                          <template
                            v-if="selectedSerial && group.packageName !== 'Unknown package'"
                          >
                            <AppIcon
                              :serial="selectedSerial"
                              :package-name="group.packageName"
                              :apk-path="getCachedPackage(group.packageName)?.apkPath ?? ''"
                              :icon-path="getCachedPackage(group.packageName)?.iconPath"
                              size="sm"
                            />
                          </template>
                          <div
                            v-else
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info"
                          >
                            <Globe :size="14" />
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="truncate text-[12px] font-medium text-foreground/85">
                              {{ group.packageName }}
                            </div>
                            <div class="mt-0.5 text-[10px] text-muted-foreground/40">
                              {{ group.targets.length }} targets
                            </div>
                          </div>
                          <ChevronRight
                            v-if="shouldCollapsePackage(group.packageName)"
                            :size="12"
                            class="shrink-0 text-muted-foreground/35 transition-transform"
                            :class="isPackageExpanded(group.packageName) ? 'rotate-90' : ''"
                          />
                        </button>

                        <div
                          v-if="isPackageExpanded(group.packageName)"
                          :class="
                            shouldShowPackageHeader(group.packageName)
                              ? 'space-y-2 px-2 pb-2'
                              : 'space-y-2'
                          "
                        >
                          <div
                            v-for="t in group.targets"
                            :key="t.id"
                            @click="handleSelectTarget(t)"
                            class="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors group cursor-pointer"
                            :class="
                              targetsStore.selectedTarget?.id === t.id
                                ? 'bg-surface-2 border-border/35'
                                : 'bg-surface-1/40 border-border/20 hover:bg-surface-3/50'
                            "
                          >
                            <template v-if="selectedSerial && t.packageName">
                              <AppIcon
                                :serial="selectedSerial"
                                :package-name="t.packageName"
                                :apk-path="getCachedPackage(t.packageName)?.apkPath ?? ''"
                                :icon-path="getCachedPackage(t.packageName)?.iconPath"
                                size="sm"
                              />
                            </template>
                            <div
                              v-else
                              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info"
                            >
                              <Globe :size="14" />
                            </div>
                            <div class="min-w-0 flex-1">
                              <div class="truncate text-sm font-medium text-foreground">
                                {{ t.title || "(no title)" }}
                              </div>
                              <div
                                class="mt-0.5 truncate text-xs font-mono text-muted-foreground/50"
                              >
                                {{ t.url }}
                              </div>
                            </div>
                            <span
                              class="shrink-0 rounded border border-border/20 bg-surface-3 px-2 py-0.5 text-xs text-muted-foreground/50"
                            >
                              {{ targetTypeLabel(t) }}
                            </span>
                            <button
                              @click="handleInspectTarget(t, $event)"
                              class="flex shrink-0 items-center gap-2 rounded-md border border-border/30 px-3 py-1.5 text-xs text-foreground/70 transition-all hover:bg-surface-3 hover:text-foreground opacity-0 group-hover:opacity-100"
                              title="Inspect target"
                            >
                              <Crosshair :size="13" />
                              Inspect
                            </button>
                          </div>
                        </div>
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

            <template v-else-if="activePanel === 'local'">
              <div class="px-6 pt-5 pb-4 border-b border-border/15 shrink-0">
                <div class="flex items-start gap-3">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                      <Monitor :size="15" class="text-muted-foreground/50" />
                      <span class="text-[15px] font-semibold text-foreground">
                        {{ localDeviceName }}
                      </span>
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-success/10 text-success border border-success/20"
                      >
                        connected
                      </span>
                    </div>
                    <div class="text-[11px] text-muted-foreground/35">
                      Native child WebView · created targets only
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex-1 overflow-y-auto px-6 py-4">
                <div class="flex items-center justify-between mb-2">
                  <span
                    class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                  >
                    Targets
                  </span>
                  <span class="text-[10px] text-muted-foreground/30">URL creates target</span>
                </div>

                <div
                  class="mb-3 flex items-center gap-2 rounded-lg border border-dashed border-border/25 bg-surface-1/40 px-3 py-2.5"
                >
                  <Plus :size="12" class="shrink-0 text-muted-foreground/40" />
                  <input
                    v-model="localTargetUrl"
                    placeholder="http://localhost:5173"
                    class="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/25"
                    @keydown.enter="void handleCreateLocalTarget()"
                  />
                  <button
                    @click="void handleCreateLocalTarget()"
                    :disabled="creatingLocalTarget"
                    class="h-7 rounded-md border border-border/30 bg-surface-2 px-3 text-[11px] text-foreground/70 transition-colors hover:bg-surface-3 disabled:opacity-50"
                  >
                    <Loader2 v-if="creatingLocalTarget" :size="11" class="animate-spin" />
                    <span v-else>Add</span>
                  </button>
                </div>

                <div v-if="localTargets.length" class="space-y-1">
                  <div
                    v-for="t in localTargets"
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
                        targetsStore.selectedTarget?.id === t.id
                          ? 'bg-success'
                          : 'bg-muted-foreground/20'
                      "
                    />
                    <Globe :size="13" class="shrink-0 text-muted-foreground/35" />
                    <div class="flex-1 min-w-0">
                      <div class="text-[12px] text-foreground/80 truncate">
                        {{ t.title || "(no title)" }}
                      </div>
                      <div class="text-[10px] font-mono text-muted-foreground/35 truncate mt-0.5">
                        {{ t.url }}
                      </div>
                    </div>
                    <button
                      @click="handleInspectTarget(t, $event)"
                      class="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-surface-3 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title="Inspect child webview"
                    >
                      <Crosshair :size="11" />
                    </button>
                    <button
                      @click="handleDisconnectTarget(t.id, $event)"
                      class="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground/50 hover:text-error hover:bg-error/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 :size="11" />
                    </button>
                    <ChevronRight
                      :size="11"
                      class="text-muted-foreground/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>

                <div v-else class="py-8 text-center text-[11px] text-muted-foreground/25">
                  Add a URL to create a local child webview target.
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
