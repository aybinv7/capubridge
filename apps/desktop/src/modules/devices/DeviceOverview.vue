<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  Smartphone,
  Monitor,
  Cpu,
  HardDrive,
  Battery,
  Wifi,
  ScreenShare,
  FolderOpen,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { devices } from "@/data/mock-data";

const device = ref(devices[0]);

const perf = ref({
  cpu: 24,
  ram: 62,
  battery: 87,
  fps: 60,
  rxKbps: 48,
  txKbps: 12,
});

let perfTimer: ReturnType<typeof setInterval>;
onMounted(() => {
  perfTimer = setInterval(() => {
    perf.value = {
      cpu: Math.max(5, Math.min(95, perf.value.cpu + (Math.random() - 0.5) * 15)),
      ram: Math.max(20, Math.min(90, perf.value.ram + (Math.random() - 0.5) * 5)),
      battery: Math.max(1, perf.value.battery - (Math.random() > 0.9 ? 1 : 0)),
      fps: Math.max(24, Math.min(60, Math.round(perf.value.fps + (Math.random() - 0.5) * 8))),
      rxKbps: Math.max(0, perf.value.rxKbps + (Math.random() - 0.5) * 20),
      txKbps: Math.max(0, perf.value.txKbps + (Math.random() - 0.5) * 8),
    };
  }, 1200);
});
onUnmounted(() => clearInterval(perfTimer));

const cpuColor = computed(() =>
  perf.value.cpu > 80 ? "text-error" : perf.value.cpu > 60 ? "text-warning" : "text-success",
);
const ramColor = computed(() =>
  perf.value.ram > 80 ? "text-error" : perf.value.ram > 60 ? "text-warning" : "text-info",
);
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div class="grid grid-cols-3 gap-2.5 max-w-3xl">
      <div
        v-for="item in [
          {
            icon: Smartphone,
            label: 'Model',
            value: device.model,
            color: 'text-foreground',
          },
          {
            icon: Monitor,
            label: 'Display',
            value: device.resolution,
            color: 'text-info',
          },
          {
            icon: Cpu,
            label: 'Processor',
            value: device.cpu,
            color: 'text-warning',
          },
          {
            icon: HardDrive,
            label: 'Storage',
            value: device.storage,
            color: 'text-success',
          },
          {
            icon: Battery,
            label: 'Battery',
            value: `${device.battery}%`,
            color: device.battery > 50 ? 'text-success' : 'text-warning',
          },
          {
            icon: Wifi,
            label: 'Connection',
            value: `${device.connection} · ${device.ip}`,
            color: 'text-info',
          },
        ]"
        :key="item.label"
        class="bg-background/30 p-3 border border-border transition-colors"
      >
        <div class="flex items-center gap-2 mb-2">
          <div
            class="w-6 h-6 rounded-md bg-secondary flex items-center justify-center"
            :class="item.color"
          >
            <component :is="item.icon" class="w-3 h-3" />
          </div>
          <span class="text-2xs text-muted-foreground uppercase tracking-wider">{{
            item.label
          }}</span>
        </div>
        <span class="text-xs font-medium text-foreground">{{ item.value }}</span>
      </div>
    </div>

    <div class="mt-5 max-w-3xl">
      <span class="text-2xs text-muted-foreground uppercase tracking-wider">Quick Actions</span>
      <div class="flex gap-2 mt-2">
        <Button
          v-for="action in [
            { icon: ScreenShare, label: 'Screenshot' },
            { icon: FolderOpen, label: 'File Explorer' },
            { icon: Wifi, label: 'Wireless Debug' },
          ]"
          :key="action.label"
          variant="outline"
          size="sm"
        >
          <component :is="action.icon" class="w-3.5 h-3.5 mr-1.5" />
          {{ action.label }}
        </Button>
      </div>
    </div>
  </div>
</template>
