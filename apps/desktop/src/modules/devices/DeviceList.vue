<script setup lang="ts">
import { Smartphone } from "lucide-vue-next";
import { useDevicesStore } from "@/stores/devices.store";
import DeviceCard from "./DeviceCard.vue";

const devicesStore = useDevicesStore();
</script>

<template>
  <div class="flex h-full w-[260px] shrink-0 flex-col border-r border-border overflow-hidden">
    <!-- Section header -->
    <div class="flex h-8 shrink-0 items-center border-b border-border px-3">
      <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
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
        <Smartphone :size="28" class="text-muted-foreground/20" />
        <div class="space-y-1">
          <p class="text-[12px] font-medium text-muted-foreground/50">No devices connected</p>
          <p class="text-[11px] text-muted-foreground/30">
            Connect an Android device via USB or enable wireless ADB
          </p>
        </div>
      </div>

      <!-- Device cards -->
      <div v-else class="divide-y divide-border/50">
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
      class="shrink-0 border-t border-border bg-destructive/10 px-3 py-1.5 text-[11px] text-status-error"
    >
      {{ devicesStore.error }}
    </div>
  </div>
</template>
