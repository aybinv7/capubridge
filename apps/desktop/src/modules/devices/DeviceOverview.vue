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
  Zap,
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
  perf.value.cpu > 80 ? "text-error" : perf.value.cpu > 60 ? "text-warning" : "text-foreground",
);
const ramColor = computed(() =>
  perf.value.ram > 80 ? "text-error" : perf.value.ram > 60 ? "text-warning" : "text-info",
);
</script>

<template>
  <div class="flex-1 overflow-y-auto p-8">
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- Device header -->
      <div class="flex items-center gap-4">
        <div
          class="w-14 h-14 rounded-xl bg-surface-2 border border-border/30 flex items-center justify-center"
        >
          <Smartphone class="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <h1 class="text-lg font-semibold text-foreground">{{ device.model }}</h1>
          <p class="text-sm text-muted-foreground font-mono">{{ device.serial }}</p>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <div class="flex items-center gap-2 text-sm">
            <div
              class="w-2 h-2 rounded-full"
              :class="device.battery > 50 ? 'bg-success' : 'bg-warning'"
            />
            <span class="text-muted-foreground">{{ device.battery }}%</span>
          </div>
          <div class="w-px h-4 bg-border/30" />
          <span class="text-sm text-muted-foreground font-mono">{{ device.connection }}</span>
        </div>
      </div>

      <!-- Info grid -->
      <div class="grid grid-cols-3 gap-3">
        <div
          v-for="item in [
            { icon: Monitor, label: 'Display', value: device.resolution, color: 'text-info' },
            { icon: Cpu, label: 'Processor', value: device.cpu, color: 'text-warning' },
            { icon: HardDrive, label: 'Storage', value: device.storage, color: 'text-foreground' },
            { icon: Battery, label: 'Battery', value: `${device.battery}%`, color: 'text-success' },
            { icon: Wifi, label: 'IP Address', value: device.ip, color: 'text-info' },
            { icon: Zap, label: 'Android', value: device.androidVersion, color: 'text-foreground' },
          ]"
          :key="item.label"
          class="bg-surface-2 border border-border/30 rounded-lg p-4 transition-colors hover:border-border/50"
        >
          <div class="flex items-center gap-2.5 mb-3">
            <div
              class="w-8 h-8 rounded-md bg-surface-3 border border-border/20 flex items-center justify-center"
              :class="item.color"
            >
              <component :is="item.icon" class="w-4 h-4" />
            </div>
            <span class="text-xs text-muted-foreground uppercase tracking-wider">{{
              item.label
            }}</span>
          </div>
          <span class="text-sm font-medium text-foreground font-mono">{{ item.value }}</span>
        </div>
      </div>

      <!-- Quick actions -->
      <div>
        <span class="text-xs text-muted-foreground uppercase tracking-wider">Quick Actions</span>
        <div class="flex gap-2 mt-3">
          <Button
            v-for="action in [
              { icon: ScreenShare, label: 'Screenshot' },
              { icon: FolderOpen, label: 'File Explorer' },
              { icon: Wifi, label: 'Wireless Debug' },
            ]"
            :key="action.label"
            variant="outline"
            size="sm"
            class="gap-2"
          >
            <component :is="action.icon" class="w-4 h-4" />
            {{ action.label }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
