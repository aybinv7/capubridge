<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import {
  X,
  Usb,
  Wifi,
  Plus,
  Trash2,
  ArrowRightLeft,
  ArrowLeftRight,
  Link,
  RefreshCw,
  Circle,
  Power,
  RotateCcw,
  Camera,
  Terminal,
  ChevronRight,
  MonitorSmartphone,
} from "lucide-vue-next";
import { devices, portForwards } from "@/data/mock-data";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; selectDevice: [id: string] }>();

const selectedDeviceId = ref(devices[0].id);
const rightView = ref<"device" | "connect">("device");
type DeviceTab = "connection" | "forwarding" | "reverse" | "actions";
const deviceTab = ref<DeviceTab>("connection");

const selectedDevice = computed(() => devices.find((d) => d.id === selectedDeviceId.value)!);

const devicePorts = reactive<
  Record<string, { forwards: typeof portForwards; reverses: typeof portForwards }>
>({
  [devices[0].id]: {
    forwards: portForwards.map((f) => ({ ...f })),
    reverses: [{ id: 10, local: 3000, remote: 3000, description: "React Native Metro" }],
  },
  [devices[1].id]: {
    forwards: [{ id: 20, local: 8081, remote: 8081, description: "Metro Bundler" }],
    reverses: [],
  },
  [devices[2].id]: { forwards: [], reverses: [] },
});

function ensureDevicePorts(id: string) {
  if (!devicePorts[id]) devicePorts[id] = { forwards: [], reverses: [] };
}

const deviceConn = reactive<Record<string, string>>(
  Object.fromEntries(devices.map((d) => [d.id, d.connection])),
);

const newLocal = ref("");
const newRemote = ref("");
const newDesc = ref("");

function addPort(type: "forwards" | "reverses") {
  if (!newLocal.value || !newRemote.value) return;
  ensureDevicePorts(selectedDeviceId.value);
  devicePorts[selectedDeviceId.value][type].push({
    id: Date.now(),
    local: Number(newLocal.value),
    remote: Number(newRemote.value),
    description: newDesc.value,
  });
  newLocal.value = "";
  newRemote.value = "";
  newDesc.value = "";
}

function removePort(type: "forwards" | "reverses", id: number) {
  ensureDevicePorts(selectedDeviceId.value);
  devicePorts[selectedDeviceId.value][type] = devicePorts[selectedDeviceId.value][type].filter(
    (f) => f.id !== id,
  );
}

const wifiIp = ref("");
const wifiPort = ref("5555");
const pairAddr = ref("");
const pairCode = ref("");

function selectDevice(id: string) {
  selectedDeviceId.value = id;
  rightView.value = "device";
  deviceTab.value = "connection";
  emit("selectDevice", id);
}
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
        <div class="absolute inset-0 bg-black/60" @click="emit('close')" />

        <div
          class="relative flex bg-background border border-border overflow-hidden"
          style="width: 900px; height: 560px"
        >
          <!-- LEFT SIDEBAR -->
          <div class="w-[230px] border-r border-border flex flex-col shrink-0">
            <div class="h-12 flex items-center gap-2 px-4 border-b border-border shrink-0">
              <MonitorSmartphone class="w-3.5 h-3.5 text-foreground" />
              <span class="text-xs font-semibold text-foreground">Devices</span>
              <span class="ml-auto text-2xs font-mono text-muted-foreground">
                {{ devices.filter((d) => d.status === "online").length }}/{{ devices.length }}
              </span>
              <button
                class="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <RefreshCw class="w-3 h-3" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                v-for="d in devices"
                :key="d.id"
                @click="selectDevice(d.id)"
                class="w-full text-left p-2.5 border transition-all duration-150"
                :class="
                  selectedDeviceId === d.id && rightView === 'device'
                    ? 'border-border bg-accent'
                    : 'border-transparent hover:bg-accent'
                "
              >
                <div class="flex items-center gap-2">
                  <Circle
                    class="w-[6px] h-[6px] shrink-0"
                    :class="
                      d.status === 'online'
                        ? 'fill-success text-success'
                        : 'fill-muted-foreground/30 text-muted-foreground/30'
                    "
                  />
                  <span class="text-xs font-medium text-foreground truncate flex-1">{{
                    d.model
                  }}</span>
                  <ChevronRight
                    v-if="selectedDeviceId === d.id && rightView === 'device'"
                    class="w-3 h-3 text-foreground shrink-0"
                  />
                </div>
                <div class="flex items-center gap-1.5 mt-1 pl-3.5">
                  <span class="text-2xs font-mono text-muted-foreground truncate">{{
                    d.id.slice(0, 12)
                  }}</span>
                  <span class="text-2xs text-muted-foreground shrink-0">·</span>
                  <span
                    class="text-2xs shrink-0"
                    :class="
                      deviceConn[d.id] === 'USB'
                        ? 'text-success'
                        : deviceConn[d.id] === 'WiFi'
                          ? 'text-info'
                          : 'text-warning'
                    "
                    >{{ deviceConn[d.id] }}</span
                  >
                </div>
              </button>
            </div>

            <div class="p-2 border-t border-border shrink-0">
              <button
                @click="rightView = 'connect'"
                class="w-full flex items-center gap-2 px-3 py-2.5 border transition-all duration-150 text-left"
                :class="
                  rightView === 'connect'
                    ? 'border-border bg-accent text-foreground'
                    : 'border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                "
              >
                <Link class="w-3.5 h-3.5 shrink-0" />
                <div>
                  <div class="text-xs font-medium">Connect New</div>
                  <div class="text-2xs opacity-70">TCP/IP · WiFi Pair</div>
                </div>
              </button>
            </div>
          </div>

          <!-- RIGHT PANEL -->
          <div class="flex-1 flex flex-col overflow-hidden">
            <button
              @click="emit('close')"
              class="absolute top-3 right-3 z-10 p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
            >
              <X class="w-3.5 h-3.5" />
            </button>

            <!-- DEVICE VIEW -->
            <template v-if="rightView === 'device' && selectedDevice">
              <div class="h-12 flex items-center gap-3 px-5 border-b border-border shrink-0">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-foreground">{{
                      selectedDevice.model
                    }}</span>
                    <span
                      class="text-2xs px-1.5 py-0.5 font-medium"
                      :class="
                        selectedDevice.status === 'online'
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground'
                      "
                      >{{ selectedDevice.status }}</span
                    >
                  </div>
                  <div class="text-2xs text-muted-foreground font-mono">
                    Android {{ selectedDevice.androidVersion }} · API
                    {{ selectedDevice.apiLevel }} · {{ selectedDevice.ip }}
                  </div>
                </div>
                <button
                  @click="
                    emit('selectDevice', selectedDevice.id);
                    emit('close');
                  "
                  class="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity shrink-0"
                >
                  Set Active
                </button>
              </div>

              <!-- Device tab bar -->
              <div class="flex items-end px-1 border-b border-border shrink-0">
                <button
                  v-for="t in [
                    { id: 'connection', label: 'Connection' },
                    { id: 'forwarding', label: 'Forwarding' },
                    { id: 'reverse', label: 'Reverse' },
                    { id: 'actions', label: 'Actions' },
                  ]"
                  :key="t.id"
                  @click="deviceTab = t.id as DeviceTab"
                  class="relative px-3 py-2.5 text-2xs transition-colors duration-150"
                  :class="
                    deviceTab === t.id
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                >
                  {{ t.label }}
                  <div
                    v-if="deviceTab === t.id"
                    class="absolute bottom-0 left-1 right-1 h-0.5 bg-foreground"
                  />
                </button>
              </div>

              <!-- CONNECTION TAB -->
              <div v-if="deviceTab === 'connection'" class="flex-1 overflow-y-auto p-5 space-y-5">
                <div>
                  <div class="text-2xs text-muted-foreground uppercase tracking-wider mb-3">
                    Connection Mode
                  </div>
                  <div class="flex gap-3">
                    <button
                      v-for="mode in ['USB', 'WiFi', 'Emulator']"
                      :key="mode"
                      @click="deviceConn[selectedDevice.id] = mode"
                      class="flex-1 flex flex-col items-center gap-2 py-4 border-2 transition-all duration-150"
                      :class="
                        deviceConn[selectedDevice.id] === mode
                          ? 'border-foreground bg-accent'
                          : 'border-border hover:border-muted-foreground'
                      "
                    >
                      <component
                        :is="mode === 'WiFi' ? Wifi : mode === 'USB' ? Usb : Terminal"
                        class="w-5 h-5"
                        :class="
                          deviceConn[selectedDevice.id] === mode
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        "
                      />
                      <span
                        class="text-xs font-medium"
                        :class="
                          deviceConn[selectedDevice.id] === mode
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        "
                        >{{ mode }}</span
                      >
                      <div
                        v-if="deviceConn[selectedDevice.id] === mode"
                        class="text-2xs text-muted-foreground font-medium"
                      >
                        Active
                      </div>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div
                    v-for="info in [
                      { label: 'Serial', value: selectedDevice.id },
                      { label: 'IP Address', value: selectedDevice.ip },
                      { label: 'Resolution', value: selectedDevice.resolution },
                      { label: 'Storage', value: selectedDevice.storage },
                    ]"
                    :key="info.label"
                    class="bg-accent/50 px-3 py-2 border border-border"
                  >
                    <div class="text-2xs text-muted-foreground mb-0.5">{{ info.label }}</div>
                    <div class="text-xs font-mono text-foreground truncate">{{ info.value }}</div>
                  </div>
                </div>

                <div
                  v-if="deviceConn[selectedDevice.id] === 'USB'"
                  class="bg-accent/30 border border-border p-3 space-y-1.5"
                >
                  <div class="text-2xs text-muted-foreground font-medium">
                    Switch to WiFi Debugging
                  </div>
                  <div class="flex items-center gap-2 text-2xs text-muted-foreground font-mono">
                    <span class="bg-secondary px-1.5 py-0.5 text-foreground">adb tcpip 5555</span>
                    <span>→ then connect via</span>
                    <span class="text-info">{{ selectedDevice.ip }}:5555</span>
                  </div>
                </div>
              </div>

              <!-- FORWARDING TAB -->
              <div
                v-else-if="deviceTab === 'forwarding'"
                class="flex-1 flex flex-col overflow-hidden"
              >
                <div class="flex-1 overflow-y-auto p-4 space-y-1.5">
                  <div
                    class="text-2xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"
                  >
                    <ArrowRightLeft class="w-2.5 h-2.5" /> host → device
                  </div>
                  <div
                    v-if="!devicePorts[selectedDevice.id]?.forwards?.length"
                    class="py-6 text-center text-2xs text-muted-foreground"
                  >
                    No forwards for this device
                  </div>
                  <div
                    v-for="fwd in devicePorts[selectedDevice.id]?.forwards ?? []"
                    :key="fwd.id"
                    class="flex items-center gap-3 px-3 py-2 bg-accent/30 border border-border group"
                  >
                    <span class="font-mono text-xs text-success">:{{ fwd.local }}</span>
                    <ArrowRightLeft class="w-3 h-3 text-muted-foreground shrink-0" />
                    <span class="font-mono text-xs text-info">:{{ fwd.remote }}</span>
                    <span class="text-2xs text-muted-foreground flex-1 truncate">{{
                      fwd.description
                    }}</span>
                    <button
                      @click="removePort('forwards', fwd.id)"
                      class="p-1 text-muted-foreground hover:text-error transition-colors duration-150 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div class="p-3 border-t border-border flex gap-2">
                  <input
                    v-model="newLocal"
                    class="w-20 bg-transparent border border-border px-2 py-1.5 text-xs font-mono text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                    placeholder="host"
                  />
                  <ArrowRightLeft class="w-3 h-3 text-muted-foreground self-center shrink-0" />
                  <input
                    v-model="newRemote"
                    class="w-20 bg-transparent border border-border px-2 py-1.5 text-xs font-mono text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                    placeholder="device"
                  />
                  <input
                    v-model="newDesc"
                    class="flex-1 bg-transparent border border-border px-2 py-1.5 text-xs text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                    placeholder="description"
                  />
                  <button
                    @click="addPort('forwards')"
                    class="px-3 py-1.5 bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
                  >
                    <Plus class="w-3 h-3" /> Add
                  </button>
                </div>
              </div>

              <!-- REVERSE TAB -->
              <div v-else-if="deviceTab === 'reverse'" class="flex-1 flex flex-col overflow-hidden">
                <div class="flex-1 overflow-y-auto p-4 space-y-1.5">
                  <div
                    class="text-2xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"
                  >
                    <ArrowLeftRight class="w-2.5 h-2.5" /> device → host
                  </div>
                  <div
                    v-if="!devicePorts[selectedDevice.id]?.reverses?.length"
                    class="py-6 text-center text-2xs text-muted-foreground"
                  >
                    No reverses for this device
                  </div>
                  <div
                    v-for="rev in devicePorts[selectedDevice.id]?.reverses ?? []"
                    :key="rev.id"
                    class="flex items-center gap-3 px-3 py-2 bg-accent/30 border border-border group"
                  >
                    <span class="font-mono text-xs text-info">:{{ rev.local }}</span>
                    <ArrowLeftRight class="w-3 h-3 text-muted-foreground shrink-0" />
                    <span class="font-mono text-xs text-success">:{{ rev.remote }}</span>
                    <span class="text-2xs text-muted-foreground flex-1 truncate">{{
                      rev.description
                    }}</span>
                    <button
                      @click="removePort('reverses', rev.id)"
                      class="p-1 text-muted-foreground hover:text-error transition-colors duration-150 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div class="p-3 border-t border-border flex gap-2">
                  <input
                    v-model="newLocal"
                    class="w-20 bg-transparent border border-border px-2 py-1.5 text-xs font-mono text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                    placeholder="device"
                  />
                  <ArrowLeftRight class="w-3 h-3 text-muted-foreground self-center shrink-0" />
                  <input
                    v-model="newRemote"
                    class="w-20 bg-transparent border border-border px-2 py-1.5 text-xs font-mono text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                    placeholder="host"
                  />
                  <input
                    v-model="newDesc"
                    class="flex-1 bg-transparent border border-border px-2 py-1.5 text-xs text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                    placeholder="description"
                  />
                  <button
                    @click="addPort('reverses')"
                    class="px-3 py-1.5 bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
                  >
                    <Plus class="w-3 h-3" /> Add
                  </button>
                </div>
              </div>

              <!-- ACTIONS TAB -->
              <div v-else class="flex-1 overflow-y-auto p-4">
                <div class="grid grid-cols-2 gap-2 max-w-sm">
                  <button
                    v-for="action in [
                      { icon: Camera, label: 'Take Screenshot', color: 'text-info' },
                      { icon: RotateCcw, label: 'Restart ADB', color: 'text-warning' },
                      { icon: Wifi, label: 'Enable WiFi Debug', color: 'text-foreground' },
                      { icon: Power, label: 'Reboot Device', color: 'text-error' },
                      { icon: Power, label: 'Reboot Recovery', color: 'text-warning' },
                      { icon: Terminal, label: 'Open Shell', color: 'text-success' },
                    ]"
                    :key="action.label"
                    class="flex items-center gap-2.5 px-3 py-3 border border-border hover:bg-accent transition-all duration-150 text-left group"
                  >
                    <component
                      :is="action.icon"
                      class="w-3.5 h-3.5 shrink-0 transition-colors"
                      :class="action.color"
                    />
                    <span
                      class="text-xs text-muted-foreground group-hover:text-foreground transition-colors"
                      >{{ action.label }}</span
                    >
                  </button>
                </div>
              </div>
            </template>

            <!-- CONNECT NEW VIEW -->
            <template v-else-if="rightView === 'connect'">
              <div class="h-12 flex items-center px-5 border-b border-border shrink-0">
                <span class="text-sm font-semibold text-foreground">Connect New Device</span>
              </div>
              <div class="flex-1 overflow-y-auto p-5 space-y-6">
                <div class="space-y-3">
                  <div class="text-2xs font-medium text-muted-foreground uppercase tracking-wider">
                    Connect via TCP/IP
                  </div>
                  <div class="flex gap-2">
                    <div
                      class="flex-1 bg-transparent border border-border px-3 py-2.5 flex items-center gap-2 focus-within:border-foreground transition-colors"
                    >
                      <span class="text-2xs text-muted-foreground font-mono">IP</span>
                      <input
                        v-model="wifiIp"
                        class="bg-transparent text-xs text-foreground flex-1 outline-none font-mono placeholder:text-muted-foreground"
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div
                      class="w-24 bg-transparent border border-border px-3 py-2.5 flex items-center gap-2 focus-within:border-foreground transition-colors"
                    >
                      <span class="text-2xs text-muted-foreground font-mono">:</span>
                      <input
                        v-model="wifiPort"
                        class="bg-transparent text-xs text-foreground flex-1 outline-none font-mono"
                      />
                    </div>
                    <button
                      class="px-4 bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
                    >
                      <Link class="w-3 h-3" /> Connect
                    </button>
                  </div>
                  <p class="text-2xs text-muted-foreground">
                    Run
                    <span class="font-mono bg-secondary px-1.5 py-0.5 text-foreground"
                      >adb tcpip 5555</span
                    >
                    on a USB-connected device first.
                  </p>
                </div>

                <div class="space-y-3">
                  <div class="text-2xs font-medium text-muted-foreground uppercase tracking-wider">
                    Wireless Debugging — Android 11+
                  </div>
                  <div class="bg-accent/30 border border-border p-4 space-y-3">
                    <div class="flex gap-2">
                      <div
                        class="flex-1 bg-transparent border border-border px-3 py-2.5 flex items-center gap-2 focus-within:border-foreground transition-colors"
                      >
                        <span class="text-2xs text-muted-foreground font-mono">addr</span>
                        <input
                          v-model="pairAddr"
                          class="bg-transparent text-xs text-foreground flex-1 outline-none font-mono placeholder:text-muted-foreground"
                          placeholder="192.168.1.100:37261"
                        />
                      </div>
                      <div
                        class="w-32 bg-transparent border border-border px-3 py-2.5 flex items-center gap-2 focus-within:border-foreground transition-colors"
                      >
                        <span class="text-2xs text-muted-foreground">code</span>
                        <input
                          v-model="pairCode"
                          class="bg-transparent text-xs text-foreground flex-1 outline-none font-mono"
                          placeholder="123456"
                        />
                      </div>
                      <button
                        class="px-4 bg-secondary text-foreground border border-border text-xs hover:bg-accent transition-colors flex items-center gap-1.5"
                      >
                        <Wifi class="w-3 h-3" /> Pair
                      </button>
                    </div>
                    <p class="text-2xs text-muted-foreground leading-relaxed">
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
