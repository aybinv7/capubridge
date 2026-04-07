<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import {
  X,
  Usb,
  Wifi,
  ArrowRightLeft,
  ArrowLeftRight,
  Link,
  RefreshCw,
  Circle,
  Power,
  RotateCcw,
  Camera,
  Terminal,
  MonitorSmartphone,
  Smartphone,
  Loader2,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useDevicesStore } from "@/stores/devices.store";
import { useAdb } from "@/composables/useAdb";
import type { ADBDevice } from "@/types/adb.types";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; selectDevice: [serial: string] }>();

const devicesStore = useDevicesStore();
const { getDeviceOverview, connectDevice, disconnectDevice, pairDevice, reboot, restartServer, tcpip, shellCommand } = useAdb();

const selectedDeviceSerial = ref<string | null>(null);
const rightView = ref<"device" | "connect">("device");
type DeviceTab = "connection" | "forwarding" | "reverse" | "actions";
const deviceTab = ref<DeviceTab>("connection");

const selectedDevice = computed(() => {
  if (!selectedDeviceSerial.value) return null;
  return devicesStore.devices.find((d) => d.serial === selectedDeviceSerial.value) ?? null;
});

const deviceInfoCache = reactive<Record<string, Awaited<ReturnType<typeof getDeviceOverview>>>>({});
const deviceInfoLoading = ref(false);

async function fetchDeviceInfo(serial: string) {
  if (deviceInfoCache[serial]) return;
  deviceInfoLoading.value = true;
  try {
    const info = await getDeviceOverview(serial);
    if (info) {
      deviceInfoCache[serial] = info;
    }
  } catch {
    // info unavailable
  } finally {
    deviceInfoLoading.value = false;
  }
}

const selectedDeviceInfo = computed(() => {
  if (!selectedDeviceSerial.value) return null;
  return deviceInfoCache[selectedDeviceSerial.value] ?? null;
});

const deviceConn = reactive<Record<string, string>>({});

function getConnectionType(device: ADBDevice): string {
  if (device.connectionType === "wifi") return "WiFi";
  if (device.serial.includes("emulator")) return "Emulator";
  return "USB";
}

const wifiIp = ref("");
const wifiPort = ref("5555");
const pairAddr = ref("");
const pairCode = ref("");
const actionLoading = ref<string | null>(null);

function selectDevice(serial: string) {
  selectedDeviceSerial.value = serial;
  rightView.value = "device";
  deviceTab.value = "connection";
  void fetchDeviceInfo(serial);
}

function onSelectDevice(serial: string) {
  emit("selectDevice", serial);
  emit("close");
}

function refreshDevices() {
  void devicesStore.refreshDevices();
}

async function handleConnect() {
  if (!wifiIp.value) {
    toast.error("Enter an IP address");
    return;
  }
  const port = parseInt(wifiPort.value, 10) || 5555;
  try {
    await connectDevice(wifiIp.value, port);
    toast.success("Device connected", { description: `${wifiIp.value}:${port}` });
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
    toast.error("Invalid address", { description: "Expected format: 192.168.1.x:PORT" });
    return;
  }
  try {
    await pairDevice(host, port, pairCode.value);
    toast.success("Device paired", { description: `${pairAddr.value}` });
    pairCode.value = "";
  } catch (err) {
    toast.error("Pairing failed", { description: String(err) });
  }
}

async function handleAction(action: string) {
  const serial = selectedDevice.value?.serial;
  if (!serial) return;
  actionLoading.value = action;
  try {
    switch (action) {
      case "screenshot": {
        await shellCommand(serial, "screencap -p /sdcard/capubridge_screenshot.png");
        toast.success("Screenshot saved", { description: "/sdcard/capubridge_screenshot.png" });
        break;
      }
      case "restart-adb": {
        await restartServer();
        toast.success("ADB server restarted");
        await devicesStore.refreshDevices();
        break;
      }
      case "wifi-debug": {
        await tcpip(serial);
        const ip = selectedDeviceInfo.value?.ipAddresses[0];
        toast.success("WiFi debugging enabled on port 5555", {
          description: ip ? `Connect via: ${ip}:5555` : "Connect using the device IP",
        });
        break;
      }
      case "reboot": {
        await reboot(serial);
        toast.info("Rebooting device…");
        break;
      }
      case "reboot-recovery": {
        await reboot(serial, "recovery");
        toast.info("Rebooting to recovery…");
        break;
      }
    }
  } catch (err) {
    toast.error(`Action failed: ${action}`, { description: String(err) });
  } finally {
    actionLoading.value = null;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      void devicesStore.refreshDevices();
      if (!selectedDeviceSerial.value && devicesStore.devices.length > 0) {
        selectDevice(devicesStore.devices[0].serial);
      }
    }
  },
);

watch(
  () => devicesStore.devices,
  (devices) => {
    for (const d of devices) {
      if (!deviceConn[d.serial]) {
        deviceConn[d.serial] = getConnectionType(d);
      }
    }
  },
  { immediate: true },
);

watch(
  () => devicesStore.selectedDevice,
  (d) => {
    if (d) {
      selectedDeviceSerial.value = d.serial;
      if (!deviceConn[d.serial]) {
        deviceConn[d.serial] = getConnectionType(d);
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-[0.98]"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-[0.98]"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="emit('close')" />

        <div
          class="relative flex bg-surface-1 border border-border/30 rounded-xl overflow-hidden shadow-2xl"
          style="width: 960px; height: 580px"
        >
          <!-- LEFT SIDEBAR -->
          <div class="w-[260px] border-r border-border/30 flex flex-col shrink-0 bg-surface-0">
            <div
              class="h-12 flex items-center gap-3 px-4 border-b border-border/30 shrink-0 bg-surface-0"
            >
              <MonitorSmartphone class="w-4 h-4 text-muted-foreground/70" />
              <span class="text-sm font-semibold text-foreground">Devices</span>
              <span class="ml-auto text-xs font-mono text-muted-foreground/60">
                {{ devicesStore.onlineDevices.length }}/{{ devicesStore.devices.length }}
              </span>
              <button
                class="w-6 h-6 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors rounded-md hover:bg-surface-2"
                @click="refreshDevices"
              >
                <RefreshCw class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <!-- Empty state -->
              <div
                v-if="devicesStore.devices.length === 0"
                class="flex flex-col items-center justify-center py-12 px-4 text-center"
              >
                <Smartphone :size="24" class="text-muted-foreground/20 mb-2" />
                <p class="text-xs text-muted-foreground/40">No devices connected</p>
                <p class="text-[10px] text-muted-foreground/25 mt-1">
                  Connect an Android device via USB
                </p>
              </div>

              <button
                v-for="d in devicesStore.devices"
                :key="d.serial"
                @click="selectDevice(d.serial)"
                class="w-full text-left p-3 rounded-lg transition-all duration-150 border border-transparent"
                :class="
                  selectedDeviceSerial === d.serial && rightView === 'device'
                    ? 'border-border/30 bg-surface-2'
                    : 'hover:bg-surface-2/50'
                "
              >
                <div class="flex items-center gap-2">
                  <Circle
                    class="w-2 h-2 shrink-0"
                    :class="
                      d.status === 'online'
                        ? 'fill-success text-success'
                        : 'fill-muted-foreground/30 text-muted-foreground/30'
                    "
                  />
                  <span class="text-sm font-medium text-foreground truncate flex-1">{{
                    d.model || d.serial
                  }}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-1 pl-5">
                  <span class="text-xs font-mono text-muted-foreground/60 truncate">{{
                    d.serial.slice(0, 10)
                  }}</span>
                  <span class="text-xs text-muted-foreground/50">·</span>
                  <span
                    class="text-xs shrink-0"
                    :class="
                      deviceConn[d.serial] === 'USB'
                        ? 'text-success/80'
                        : deviceConn[d.serial] === 'WiFi'
                          ? 'text-info/80'
                          : 'text-warning/80'
                    "
                    >{{ deviceConn[d.serial] }}</span
                  >
                </div>
              </button>
            </div>

            <div class="p-3 border-t border-border/30 shrink-0">
              <button
                @click="rightView = 'connect'"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-dashed border-border/40 transition-all duration-150 text-left"
                :class="
                  rightView === 'connect'
                    ? 'border-border/60 bg-surface-2 text-foreground'
                    : 'text-muted-foreground/70 hover:text-muted-foreground hover:bg-surface-2/50 hover:border-border/60'
                "
              >
                <Link class="w-4 h-4 shrink-0" />
                <div>
                  <div class="text-sm font-medium">Connect New</div>
                  <div class="text-xs opacity-70">TCP/IP · WiFi Pair</div>
                </div>
              </button>
            </div>
          </div>

          <!-- RIGHT PANEL -->
          <div class="flex-1 flex flex-col overflow-hidden">
            <button
              @click="emit('close')"
              class="absolute top-3 right-3 z-10 p-1.5 text-muted-foreground/40 hover:text-foreground hover:bg-surface-2 rounded-md transition-colors"
            >
              <X class="w-4 h-4" />
            </button>

            <!-- DEVICE VIEW -->
            <template v-if="rightView === 'device' && selectedDevice">
              <div
                class="h-14 flex items-center gap-4 px-6 border-b border-border/30 shrink-0 bg-surface-0"
              >
                <div>
                  <div class="flex items-center gap-2.5">
                    <span class="text-base font-semibold text-foreground">{{
                      selectedDevice.model || selectedDevice.serial
                    }}</span>
                    <span
                      class="text-xs px-2 py-0.5 font-medium rounded-full"
                      :class="
                        selectedDevice.status === 'online'
                          ? 'bg-success/10 text-success/70 border border-success/20'
                          : 'bg-surface-2 text-muted-foreground/50 border border-border/30'
                      "
                      >{{ selectedDevice.status }}</span
                    >
                  </div>
                  <div class="text-xs text-muted-foreground/40 font-mono mt-0.5">
                    <template v-if="selectedDeviceInfo">
                      Android {{ selectedDeviceInfo.androidVersion }} · API
                      {{ selectedDeviceInfo.apiLevel }}
                    </template>
                    <template v-else-if="deviceInfoLoading">
                      <Loader2 :size="10" class="inline animate-spin mr-1" />
                      Loading device info…
                    </template>
                    <template v-else>
                      {{ selectedDevice.serial }}
                    </template>
                  </div>
                </div>
                <button
                  @click="onSelectDevice(selectedDevice.serial)"
                  class="ml-auto flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shrink-0"
                >
                  Set Active
                </button>
              </div>

              <!-- Device tab bar -->
              <div
                class="flex items-center gap-1 px-6 py-1 border-b border-border/30 shrink-0 bg-surface-0"
              >
                <button
                  v-for="t in [
                    { id: 'connection', label: 'Connection' },
                    { id: 'forwarding', label: 'Forwarding' },
                    { id: 'reverse', label: 'Reverse' },
                    { id: 'actions', label: 'Actions' },
                  ]"
                  :key="t.id"
                  @click="deviceTab = t.id as DeviceTab"
                  class="px-3 py-1 text-sm transition-colors duration-150 rounded-full"
                  :class="
                    deviceTab === t.id
                      ? 'text-foreground font-medium bg-surface-2 border border-border/30'
                      : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface-2/50'
                  "
                >
                  {{ t.label }}
                </button>
              </div>

              <!-- CONNECTION TAB -->
              <div v-if="deviceTab === 'connection'" class="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <div class="text-xs text-muted-foreground/50 uppercase tracking-wider mb-3">
                    Connection Mode
                  </div>
                  <div class="flex gap-3">
                    <button
                      v-for="mode in ['USB', 'WiFi', 'Emulator']"
                      :key="mode"
                      @click="deviceConn[selectedDevice.serial] = mode"
                      class="flex-1 flex flex-col items-center gap-2 py-5 rounded-lg border-2 transition-all duration-150"
                      :class="
                        deviceConn[selectedDevice.serial] === mode
                          ? 'border-border/60 bg-surface-2'
                          : 'border-border/20 hover:border-border/40'
                      "
                    >
                      <component
                        :is="mode === 'WiFi' ? Wifi : mode === 'USB' ? Usb : Terminal"
                        class="w-5 h-5"
                        :class="
                          deviceConn[selectedDevice.serial] === mode
                            ? 'text-foreground'
                            : 'text-muted-foreground/40'
                        "
                      />
                      <span
                        class="text-sm font-medium"
                        :class="
                          deviceConn[selectedDevice.serial] === mode
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                        "
                        >{{ mode }}</span
                      >
                      <div
                        v-if="deviceConn[selectedDevice.serial] === mode"
                        class="text-xs text-muted-foreground/50"
                      >
                        Active
                      </div>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-surface-2 border border-border/30 rounded-lg px-4 py-3">
                    <div class="text-xs text-muted-foreground/50 mb-1">Serial</div>
                    <div class="text-sm font-mono text-foreground truncate">
                      {{ selectedDevice.serial }}
                    </div>
                  </div>
                  <div
                    v-if="selectedDeviceInfo?.ipAddresses?.length"
                    class="bg-surface-2 border border-border/30 rounded-lg px-4 py-3"
                  >
                    <div class="text-xs text-muted-foreground/50 mb-1">IP Address</div>
                    <div class="text-sm font-mono text-foreground truncate">
                      {{ selectedDeviceInfo.ipAddresses[0] }}
                    </div>
                  </div>
                  <div
                    v-if="selectedDeviceInfo?.screenResolution"
                    class="bg-surface-2 border border-border/30 rounded-lg px-4 py-3"
                  >
                    <div class="text-xs text-muted-foreground/50 mb-1">Resolution</div>
                    <div class="text-sm font-mono text-foreground truncate">
                      {{ selectedDeviceInfo.screenResolution }}
                    </div>
                  </div>
                  <div
                    v-if="selectedDeviceInfo?.totalStorage"
                    class="bg-surface-2 border border-border/30 rounded-lg px-4 py-3"
                  >
                    <div class="text-xs text-muted-foreground/50 mb-1">Storage</div>
                    <div class="text-sm font-mono text-foreground truncate">
                      {{ Math.round(selectedDeviceInfo.availableStorage / 1073741824) }} GB free /
                      {{ Math.round(selectedDeviceInfo.totalStorage / 1073741824) }} GB
                    </div>
                  </div>
                </div>

                <div
                  v-if="deviceConn[selectedDevice.serial] === 'USB'"
                  class="bg-surface-2 border border-border/30 rounded-lg p-4 space-y-2"
                >
                  <div class="text-xs text-muted-foreground/50 font-medium">
                    Switch to WiFi Debugging
                  </div>
                  <div class="flex items-center gap-2 text-xs text-muted-foreground/50 font-mono">
                    <span
                      class="bg-surface-3 px-2 py-0.5 text-foreground rounded border border-border/20"
                      >adb tcpip 5555</span
                    >
                    <span>→ then connect via</span>
                    <span class="text-info/70">
                      {{ selectedDeviceInfo?.ipAddresses?.[0] ?? "device IP" }}:5555
                    </span>
                  </div>
                </div>
              </div>

              <!-- FORWARDING TAB -->
              <div
                v-else-if="deviceTab === 'forwarding'"
                class="flex-1 flex flex-col overflow-hidden"
              >
                <div class="flex-1 overflow-y-auto p-4">
                  <div
                    class="text-xs text-muted-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-2"
                  >
                    <ArrowRightLeft class="w-3.5 h-3.5" /> host → device
                  </div>
                  <div class="py-8 text-center text-sm text-muted-foreground/30">
                    Port forwarding managed automatically by Capubridge
                  </div>
                </div>
              </div>

              <!-- REVERSE TAB -->
              <div v-else-if="deviceTab === 'reverse'" class="flex-1 flex flex-col overflow-hidden">
                <div class="flex-1 overflow-y-auto p-4">
                  <div
                    class="text-xs text-muted-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-2"
                  >
                    <ArrowLeftRight class="w-3.5 h-3.5" /> device → host
                  </div>
                  <div class="py-8 text-center text-sm text-muted-foreground/30">
                    No reverse forwards configured
                  </div>
                </div>
              </div>

              <!-- ACTIONS TAB -->
              <div v-else class="flex-1 overflow-y-auto p-6">
                <div class="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    v-for="action in [
                      { id: 'screenshot', icon: Camera, label: 'Take Screenshot', color: 'text-info/70' },
                      { id: 'restart-adb', icon: RotateCcw, label: 'Restart ADB', color: 'text-warning/70' },
                      { id: 'wifi-debug', icon: Wifi, label: 'Enable WiFi Debug', color: 'text-foreground/70' },
                      { id: 'reboot', icon: Power, label: 'Reboot Device', color: 'text-error/70' },
                      { id: 'reboot-recovery', icon: Power, label: 'Reboot Recovery', color: 'text-warning/70' },
                    ]"
                    :key="action.id"
                    :disabled="actionLoading !== null"
                    @click="handleAction(action.id)"
                    class="flex items-center gap-3 px-4 py-3.5 rounded-lg border border-border/30 hover:bg-surface-2 transition-all duration-150 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Loader2
                      v-if="actionLoading === action.id"
                      class="w-4 h-4 shrink-0 animate-spin text-muted-foreground/60"
                    />
                    <component
                      v-else
                      :is="action.icon"
                      class="w-4 h-4 shrink-0 transition-colors"
                      :class="action.color"
                    />
                    <span
                      class="text-sm text-muted-foreground/60 group-hover:text-foreground transition-colors"
                      >{{ action.label }}</span
                    >
                  </button>
                </div>
              </div>
            </template>

            <!-- CONNECT NEW VIEW -->
            <template v-else-if="rightView === 'connect'">
              <div
                class="h-14 flex items-center px-6 border-b border-border/30 shrink-0 bg-surface-0"
              >
                <span class="text-base font-semibold text-foreground">Connect New Device</span>
              </div>
              <div class="flex-1 overflow-y-auto p-6 space-y-8">
                <div class="space-y-3">
                  <div
                    class="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider"
                  >
                    Connect via TCP/IP
                  </div>
                  <div class="flex gap-3">
                    <div
                      class="flex-1 bg-surface-2 border border-border/30 rounded-lg px-3 py-2.5 flex items-center gap-2 focus-within:border-border/60 transition-colors"
                    >
                      <span class="text-xs text-muted-foreground/40 font-mono">IP</span>
                      <input
                        v-model="wifiIp"
                        class="bg-transparent text-sm text-foreground flex-1 outline-none font-mono placeholder:text-muted-foreground/30"
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div
                      class="w-28 bg-surface-2 border border-border/30 rounded-lg px-3 py-2.5 flex items-center gap-2 focus-within:border-border/60 transition-colors"
                    >
                      <span class="text-xs text-muted-foreground/40 font-mono">:</span>
                      <input
                        v-model="wifiPort"
                        class="bg-transparent text-sm text-foreground flex-1 outline-none font-mono"
                      />
                    </div>
                    <button
                      class="px-5 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                      @click="handleConnect"
                    >
                      <Link class="w-3.5 h-3.5" /> Connect
                    </button>
                  </div>
                  <p class="text-xs text-muted-foreground/40">
                    Run
                    <span
                      class="font-mono bg-surface-2 px-2 py-0.5 text-foreground rounded border border-border/20"
                      >adb tcpip 5555</span
                    >
                    on a USB-connected device first.
                  </p>
                </div>

                <div class="space-y-3">
                  <div
                    class="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider"
                  >
                    Wireless Debugging — Android 11+
                  </div>
                  <div class="bg-surface-2 border border-border/30 rounded-lg p-5 space-y-3">
                    <div class="flex gap-3">
                      <div
                        class="flex-1 bg-surface-3 border border-border/30 rounded-lg px-3 py-2.5 flex items-center gap-2 focus-within:border-border/60 transition-colors"
                      >
                        <span class="text-xs text-muted-foreground/40 font-mono">addr</span>
                        <input
                          v-model="pairAddr"
                          class="bg-transparent text-sm text-foreground flex-1 outline-none font-mono placeholder:text-muted-foreground/30"
                          placeholder="192.168.1.100:37261"
                        />
                      </div>
                      <div
                        class="w-36 bg-surface-3 border border-border/30 rounded-lg px-3 py-2.5 flex items-center gap-2 focus-within:border-border/60 transition-colors"
                      >
                        <span class="text-xs text-muted-foreground/40">code</span>
                        <input
                          v-model="pairCode"
                          class="bg-transparent text-sm text-foreground flex-1 outline-none font-mono"
                          placeholder="123456"
                        />
                      </div>
                      <button
                        class="px-5 bg-surface-2 text-foreground border border-border/30 text-sm rounded-lg hover:bg-surface-3 transition-colors flex items-center gap-2"
                        @click="handlePair"
                      >
                        <Wifi class="w-3.5 h-3.5" /> Pair
                      </button>
                    </div>
                    <p class="text-xs text-muted-foreground/40 leading-relaxed">
                      Settings → Developer options → Wireless debugging → Pair device with pairing
                      code
                    </p>
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
