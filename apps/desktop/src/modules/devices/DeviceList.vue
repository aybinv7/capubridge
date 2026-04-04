<script setup lang="ts">
import { Smartphone } from "lucide-vue-next";
import { useDevicesStore } from "@/stores/devices.store";
import DeviceCard from "./DeviceCard.vue";

const devicesStore = useDevicesStore();
</script>

<template>
  <div
    class="flex h-full w-[280px] shrink-0 flex-col border-r border-border/30 overflow-hidden bg-surface-2"
  >
    <!-- Section header -->
    <div class="flex h-10 shrink-0 items-center border-b border-border/30 px-4">
      <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
        Connected Devices
      </span>
    </div>

    <!-- Device list -->
    <div class="flex-1 overflow-y-auto">
      <!-- Empty state -->
      <div
        v-if="devicesStore.devices.length === 0"
        class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <Smartphone :size="32" class="text-muted-foreground/15" />
        <div class="space-y-1">
          <p class="text-sm font-medium text-muted-foreground/40">No devices connected</p>
          <p class="text-xs text-muted-foreground/25">
            Connect an Android device via USB or enable wireless ADB
          </p>
        </div>
      </div>

      <!-- Device cards -->
      <div v-else class="divide-y divide-border/20">
        <DeviceCard
          v-for="device in devicesStore.devices"
          :key="device.serial"
          :device="device"
          :is-selected="devicesStore.selectedDevice?.serial === device.serial"
          @select="devicesStore.selectDevice(device)"
        />
      </div>
    </div>

    <!-- Error bar -->
    <div
      v-if="devicesStore.error"
      class="shrink-0 border-t border-border/30 bg-error/[0.06] px-4 py-2 text-xs text-error"
    >
      {{ devicesStore.error }}
    </div>
  </div>
</template>
