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
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="emit('close')" />

        <div
          class="relative flex bg-surface-1 border border-border/30 rounded-xl overflow-hidden shadow-2xl"
          style="width: 960px; height: 580px"
        >
          <!-- LEFT SIDEBAR -->
          <div class="w-[260px] border-r border-border/30 flex flex-col shrink-0 bg-surface-0">
            <div class="h-12 flex items-center gap-3 px-4 border-b border-border/30 shrink-0 bg-surface-0">
              <MonitorSmartphone class="w-4 h-4 text-muted-foreground/70" />
              <span class="text-sm font-semibold text-foreground">Devices</span>
              <span class="ml-auto text-xs font-mono text-muted-foreground/60">
                {{ devices.filter((d) => d.status === "online").length }}/{{ devices.length }}
              </span>
              <button
                class="w-6 h-6 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors rounded-md hover:bg-surface-2"
              >
                <RefreshCw class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                v-for="d in devices"
                :key="d.id"
                @click="selectDevice(d.id)"
                class="w-full text-left p-3 rounded-lg transition-all duration-150 border border-transparent"
                :class="
                  selectedDeviceId === d.id && rightView === 'device'
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
                    d.model
                  }}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-1 pl-5">
                  <span class="text-xs font-mono text-muted-foreground/60 truncate">{{
                    d.id.slice(0, 10)
                  }}</span>
                  <span class="text-xs text-muted-foreground/50">·</span>
                  <span
                    class="text-xs shrink-0"
                    :class="
                      deviceConn[d.id] === 'USB'
                        ? 'text-success/80'
                        : deviceConn[d.id] === 'WiFi'
                          ? 'text-info/80'
                          : 'text-warning/80'
                    "
                    >{{ deviceConn[d.id] }}</span
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
                      selectedDevice.model
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
                    Android {{ selectedDevice.androidVersion }} · API
                    {{ selectedDevice.apiLevel }} · {{ selectedDevice.ip }}
                  </div>
                </div>
                <button
                  @click="
                    emit('selectDevice', selectedDevice.id);
                    emit('close');
                  "
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
                      @click="deviceConn[selectedDevice.id] = mode"
                      class="flex-1 flex flex-col items-center gap-2 py-5 rounded-lg border-2 transition-all duration-150"
                      :class="
                        deviceConn[selectedDevice.id] === mode
                          ? 'border-border/60 bg-surface-2'
                          : 'border-border/20 hover:border-border/40'
                      "
                    >
                      <component
                        :is="mode === 'WiFi' ? Wifi : mode === 'USB' ? Usb : Terminal"
                        class="w-5 h-5"
                        :class="
                          deviceConn[selectedDevice.id] === mode
                            ? 'text-foreground'
                            : 'text-muted-foreground/40'
                        "
                      />
                      <span
                        class="text-sm font-medium"
                        :class="
                          deviceConn[selectedDevice.id] === mode
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                        "
                        >{{ mode }}</span
                      >
                      <div
                        v-if="deviceConn[selectedDevice.id] === mode"
                        class="text-xs text-muted-foreground/50"
                      >
                        Active
                      </div>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div
                    v-for="info in [
                      { label: 'Serial', value: selectedDevice.id },
                      { label: 'IP Address', value: selectedDevice.ip },
                      { label: 'Resolution', value: selectedDevice.resolution },
                      { label: 'Storage', value: selectedDevice.storage },
                    ]"
                    :key="info.label"
                    class="bg-surface-2 border border-border/30 rounded-lg px-4 py-3"
                  >
                    <div class="text-xs text-muted-foreground/50 mb-1">
                      {{ info.label }}
                    </div>
                    <div class="text-sm font-mono text-foreground truncate">
                      {{ info.value }}
                    </div>
                  </div>
                </div>

                <div
                  v-if="deviceConn[selectedDevice.id] === 'USB'"
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
                    <span class="text-info/70">{{ selectedDevice.ip }}:5555</span>
                  </div>
                </div>
              </div>

              <!-- FORWARDING TAB -->
              <div
                v-else-if="deviceTab === 'forwarding'"
                class="flex-1 flex flex-col overflow-hidden"
              >
                <div class="flex-1 overflow-y-auto p-4 space-y-2">
                  <div
                    class="text-xs text-muted-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-2"
                  >
                    <ArrowRightLeft class="w-3.5 h-3.5" /> host → device
                  </div>
                  <div
                    v-if="!devicePorts[selectedDevice.id]?.forwards?.length"
                    class="py-8 text-center text-sm text-muted-foreground/30"
                  >
                    No forwards for this device
                  </div>
                  <div
                    v-for="fwd in devicePorts[selectedDevice.id]?.forwards ?? []"
                    :key="fwd.id"
                    class="flex items-center gap-3 px-4 py-3 bg-surface-2 border border-border/30 rounded-lg group"
                  >
                    <span class="font-mono text-sm text-success/70">:{{ fwd.local }}</span>
                    <ArrowRightLeft class="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                    <span class="font-mono text-sm text-info/70">:{{ fwd.remote }}</span>
                    <span class="text-xs text-muted-foreground/50 flex-1 truncate">{{
                      fwd.description
                    }}</span>
                    <button
                      @click="removePort('forwards', fwd.id)"
                      class="p-1.5 text-muted-foreground/30 hover:text-error transition-colors opacity-0 group-hover:opacity-100 rounded-md hover:bg-error/10"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div class="p-4 border-t border-border/30 flex gap-2">
                  <input
                    v-model="newLocal"
                    class="w-20 bg-surface-2 border border-border/30 rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-border/60 transition-colors placeholder:text-muted-foreground/30"
                    placeholder="host"
                  />
                  <ArrowRightLeft
                    class="w-3.5 h-3.5 text-muted-foreground/30 self-center shrink-0"
                  />
                  <input
                    v-model="newRemote"
                    class="w-20 bg-surface-2 border border-border/30 rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-border/60 transition-colors placeholder:text-muted-foreground/30"
                    placeholder="device"
                  />
                  <input
                    v-model="newDesc"
                    class="flex-1 bg-surface-2 border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-border/60 transition-colors placeholder:text-muted-foreground/30"
                    placeholder="description"
                  />
                  <button
                    @click="addPort('forwards')"
                    class="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <Plus class="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              <!-- REVERSE TAB -->
              <div v-else-if="deviceTab === 'reverse'" class="flex-1 flex flex-col overflow-hidden">
                <div class="flex-1 overflow-y-auto p-4 space-y-2">
                  <div
                    class="text-xs text-muted-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-2"
                  >
                    <ArrowLeftRight class="w-3.5 h-3.5" /> device → host
                  </div>
                  <div
                    v-if="!devicePorts[selectedDevice.id]?.reverses?.length"
                    class="py-8 text-center text-sm text-muted-foreground/30"
                  >
                    No reverses for this device
                  </div>
                  <div
                    v-for="rev in devicePorts[selectedDevice.id]?.reverses ?? []"
                    :key="rev.id"
                    class="flex items-center gap-3 px-4 py-3 bg-surface-2 border border-border/30 rounded-lg group"
                  >
                    <span class="font-mono text-sm text-info/70">:{{ rev.local }}</span>
                    <ArrowLeftRight class="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                    <span class="font-mono text-sm text-success/70">:{{ rev.remote }}</span>
                    <span class="text-xs text-muted-foreground/50 flex-1 truncate">{{
                      rev.description
                    }}</span>
                    <button
                      @click="removePort('reverses', rev.id)"
                      class="p-1.5 text-muted-foreground/30 hover:text-error transition-colors opacity-0 group-hover:opacity-100 rounded-md hover:bg-error/10"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div class="p-4 border-t border-border/30 flex gap-2">
                  <input
                    v-model="newLocal"
                    class="w-20 bg-surface-2 border border-border/30 rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-border/60 transition-colors placeholder:text-muted-foreground/30"
                    placeholder="device"
                  />
                  <ArrowLeftRight
                    class="w-3.5 h-3.5 text-muted-foreground/30 self-center shrink-0"
                  />
                  <input
                    v-model="newRemote"
                    class="w-20 bg-surface-2 border border-border/30 rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-border/60 transition-colors placeholder:text-muted-foreground/30"
                    placeholder="host"
                  />
                  <input
                    v-model="newDesc"
                    class="flex-1 bg-surface-2 border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-border/60 transition-colors placeholder:text-muted-foreground/30"
                    placeholder="description"
                  />
                  <button
                    @click="addPort('reverses')"
                    class="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <Plus class="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              <!-- ACTIONS TAB -->
              <div v-else class="flex-1 overflow-y-auto p-6">
                <div class="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    v-for="action in [
                      {
                        icon: Camera,
                        label: 'Take Screenshot',
                        color: 'text-info/70',
                      },
                      {
                        icon: RotateCcw,
                        label: 'Restart ADB',
                        color: 'text-warning/70',
                      },
                      {
                        icon: Wifi,
                        label: 'Enable WiFi Debug',
                        color: 'text-foreground/70',
                      },
                      {
                        icon: Power,
                        label: 'Reboot Device',
                        color: 'text-error/70',
                      },
                      {
                        icon: Power,
                        label: 'Reboot Recovery',
                        color: 'text-warning/70',
                      },
                      {
                        icon: Terminal,
                        label: 'Open Shell',
                        color: 'text-success/70',
                      },
                    ]"
                    :key="action.label"
                    class="flex items-center gap-3 px-4 py-3.5 rounded-lg border border-border/30 hover:bg-surface-2 transition-all duration-150 text-left group"
                  >
                    <component
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
                      class="px-5 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
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
