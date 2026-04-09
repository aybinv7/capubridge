<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Smartphone, Usb, Wifi, ChevronDown } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useDevicesStore } from "@/stores/devices.store";
import { useAdb } from "@/composables/useAdb";
import DeviceManagerModal from "@/components/DeviceManagerModal.vue";
import AdbReversePopover from "./AdbReversePopover.vue";

const devicesStore = useDevicesStore();
const { tcpip, getDeviceOverview } = useAdb();

const modalOpen = ref(false);

const device = computed(() => devicesStore.selectedDevice);
const isUsb = computed(() => device.value?.connectionType === "usb");

const statusDot = computed(() => {
  if (!device.value) return "bg-muted-foreground/20";
  if (device.value.status === "online") return "bg-status-success";
  return "bg-status-warning";
});

watch(
  () => devicesStore.devices,
  (devices) => {
    if (devicesStore.selectedDevice) return;
    const first = devices.find((d) => d.status === "online");
    if (first) devicesStore.selectDevice(first);
  },
  { immediate: true },
);

function onDeviceSelected(serial: string) {
  const d = devicesStore.devices.find((x) => x.serial === serial);
  if (d) devicesStore.selectDevice(d);
}

async function handleWifiSwitch() {
  if (!device.value) return;
  try {
    await tcpip(device.value.serial, 5555);
    const info = await getDeviceOverview(device.value.serial);
    const ip = info?.ipAddresses?.[0];
    toast.success("WiFi debugging enabled", {
      description: ip ? `Connect via ${ip}:5555` : "Connect using device IP on port 5555",
    });
  } catch (err) {
    toast.error("Failed to enable WiFi debugging", { description: String(err) });
  }
}
</script>

<template>
  <!-- No device -->
  <button
    v-if="!device"
    @click="modalOpen = true"
    class="flex items-center gap-1.5 h-7 px-3 rounded-full border border-dashed border-border/30 text-muted-foreground/35 hover:text-muted-foreground/60 hover:border-border/50 hover:bg-surface-2/60 transition-all duration-150 text-[11px]"
    style="-webkit-app-region: no-drag"
  >
    <Smartphone :size="11" class="shrink-0" />
    <span>No device</span>
    <ChevronDown :size="9" class="text-muted-foreground/20" />
  </button>

  <!-- Device present -->
  <div
    v-else
    class="group flex items-center gap-0.5 h-7 rounded-full border border-border/30 bg-surface-2 transition-colors hover:border-border/50 hover:bg-surface-3"
    style="-webkit-app-region: no-drag"
  >
    <button
      @click="modalOpen = true"
      class="flex items-center gap-1.5 h-full pl-2.5 pr-1.5 rounded-l-full focus:outline-none"
    >
      <span class="w-1.5 h-1.5 rounded-full shrink-0 transition-colors" :class="statusDot" />

      <span class="text-[11px] font-medium text-foreground leading-none">
        {{ device.model }}
      </span>

      <span
        class="hidden group-hover:inline font-mono text-[9px] text-muted-foreground/35 leading-none"
      >
        {{ device.serial.slice(0, 8) }}
      </span>

      <component :is="isUsb ? Usb : Wifi" :size="9" class="text-muted-foreground/25 shrink-0" />
    </button>

    <!-- Hover-revealed actions -->
    <div
      class="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 border-l border-border/20 pl-1"
    >
      <button
        v-if="isUsb"
        @click.stop="handleWifiSwitch"
        class="flex items-center justify-center w-5 h-5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-surface-3 transition-colors"
        title="Switch to WiFi debugging"
      >
        <Wifi :size="10" />
      </button>
      <AdbReversePopover :serial="device.serial" />
    </div>
  </div>

  <DeviceManagerModal
    :open="modalOpen"
    @close="modalOpen = false"
    @select-device="onDeviceSelected"
  />
</template>
