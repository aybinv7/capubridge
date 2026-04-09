<script setup lang="ts">
import type { ADBDevice } from "@/types/adb.types";
import { Usb, Wifi, XCircle } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import { useDevicesStore } from "@/stores/devices.store";

const props = defineProps<{
  device: ADBDevice;
  isSelected: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

const devicesStore = useDevicesStore();
const { disconnectDevice } = useAdb();

const statusLabel: Record<ADBDevice["status"], string> = {
  online: "Online",
  offline: "Offline",
  unauthorized: "Unauthorized",
  "no-permissions": "No Permissions",
};

const statusClass: Record<ADBDevice["status"], string> = {
  online: "text-success",
  offline: "text-muted-foreground/30",
  unauthorized: "text-warning",
  "no-permissions": "text-warning",
};

async function handleDisconnect(event: Event) {
  event.stopPropagation();
  const { serial, connectionType } = props.device;
  if (connectionType !== "wifi") return;

  const lastColon = serial.lastIndexOf(":");
  if (lastColon === -1) return;

  const host = serial.slice(0, lastColon);
  const port = parseInt(serial.slice(lastColon + 1), 10);

  try {
    await disconnectDevice(host, port);
    await devicesStore.refreshDevices();
    toast.info("Device disconnected");
  } catch {
    toast.error("Failed to disconnect device");
  }
}
</script>

<template>
  <button
    class="group w-full border-l-2 px-4 py-3.5 text-left transition-[background-color,border-color] duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
    :class="
      props.isSelected
        ? 'border-l-foreground bg-surface-3'
        : 'border-l-transparent hover:bg-surface-3 hover:border-l-border/50'
    "
    @click="emit('select')"
  >
    <!-- Top row: model name + status badge -->
    <div class="flex items-center justify-between gap-2 mb-1.5">
      <span
        class="text-sm font-medium truncate text-foreground"
        :class="{ 'text-foreground': props.isSelected }"
      >
        {{ props.device.model || props.device.serial }}
      </span>
      <span class="text-[10px] font-semibold shrink-0" :class="statusClass[props.device.status]">
        {{ statusLabel[props.device.status] }}
      </span>
    </div>

    <!-- Bottom row: serial + connection type + disconnect -->
    <div class="flex items-center justify-between">
      <span class="font-mono text-xs text-muted-foreground/40 truncate">
        {{ props.device.serial }}
      </span>
      <div class="flex items-center gap-1.5">
        <component
          :is="props.device.connectionType === 'wifi' ? Wifi : Usb"
          :size="12"
          class="text-muted-foreground/20 shrink-0"
        />
        <button
          v-if="props.device.connectionType === 'wifi' && props.device.status === 'online'"
          @click="handleDisconnect"
          class="flex items-center p-0.5 rounded text-muted-foreground/30 hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Disconnect WiFi device"
        >
          <XCircle :size="11" />
        </button>
      </div>
    </div>

    <!-- Unauthorized hint -->
    <p
      v-if="props.device.status === 'unauthorized'"
      class="mt-2 text-[10px] leading-snug text-warning/70"
    >
      Accept the USB debugging prompt on the device
    </p>
  </button>
</template>
