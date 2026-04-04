<script setup lang="ts">
import type { ADBDevice } from "@/types/adb.types";
import { Usb, Wifi } from "lucide-vue-next";

const props = defineProps<{
  device: ADBDevice;
  isSelected: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

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

    <!-- Bottom row: serial + connection type -->
    <div class="flex items-center justify-between">
      <span class="font-mono text-xs text-muted-foreground/40 truncate">
        {{ props.device.serial }}
      </span>
      <component
        :is="props.device.connectionType === 'wifi' ? Wifi : Usb"
        :size="12"
        class="text-muted-foreground/20 shrink-0"
      />
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
