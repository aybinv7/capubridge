<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Cpu, HardDrive, Battery, Activity, Wifi, ArrowDown, ArrowUp } from "lucide-vue-next";
import { devices } from "@/data/mock-data";

const device = ref(devices[0]);

const perf = ref({ cpu: 24, ram: 62, battery: 87, fps: 60, rxKbps: 48, txKbps: 12 });

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
const fpsColor = computed(() =>
  perf.value.fps < 30 ? "text-error" : perf.value.fps < 50 ? "text-warning" : "text-success",
);
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div class="max-w-2xl space-y-3">
      <div class="bg-accent border border-border p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Cpu class="w-4 h-4 text-foreground" />
            <span class="text-xs font-medium text-foreground">CPU Usage</span>
          </div>
          <span class="text-xl font-bold font-mono" :class="cpuColor"
            >{{ Math.round(perf.cpu) }}%</span
          >
        </div>
        <div class="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-700"
            :class="perf.cpu > 80 ? 'bg-error' : perf.cpu > 60 ? 'bg-warning' : 'bg-foreground'"
            :style="{ width: `${perf.cpu}%` }"
          />
        </div>
        <div class="flex justify-between mt-1.5 text-2xs text-muted-foreground">
          <span>{{ device.cpu }}</span>
          <span>8 cores</span>
        </div>
      </div>

      <div class="bg-accent border border-border p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <HardDrive class="w-4 h-4 text-info" />
            <span class="text-xs font-medium text-foreground">Memory</span>
          </div>
          <span class="text-xl font-bold font-mono" :class="ramColor"
            >{{ Math.round(perf.ram) }}%</span
          >
        </div>
        <div class="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-700"
            :class="perf.ram > 80 ? 'bg-error' : perf.ram > 60 ? 'bg-warning' : 'bg-info'"
            :style="{ width: `${perf.ram}%` }"
          />
        </div>
        <div class="flex justify-between mt-1.5 text-2xs text-muted-foreground">
          <span>{{ ((perf.ram / 100) * 8).toFixed(1) }} GB used</span>
          <span>{{ device.ram }} total</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="bg-accent border border-border p-4">
          <div class="flex items-center gap-2 mb-2">
            <Battery class="w-4 h-4 text-success" />
            <span class="text-xs font-medium text-foreground">Battery</span>
          </div>
          <div
            class="text-2xl font-bold font-mono"
            :class="
              perf.battery < 20 ? 'text-error' : perf.battery < 40 ? 'text-warning' : 'text-success'
            "
          >
            {{ perf.battery }}%
          </div>
          <div class="text-2xs text-muted-foreground mt-1">Discharging</div>
        </div>

        <div class="bg-accent border border-border p-4">
          <div class="flex items-center gap-2 mb-2">
            <Activity class="w-4 h-4 text-warning" />
            <span class="text-xs font-medium text-foreground">Frame Rate</span>
          </div>
          <div class="text-2xl font-bold font-mono" :class="fpsColor">{{ perf.fps }}</div>
          <div class="text-2xs text-muted-foreground mt-1">FPS target: 60</div>
        </div>
      </div>

      <div class="bg-accent border border-border p-4">
        <div class="flex items-center gap-2 mb-3">
          <Wifi class="w-4 h-4 text-info" />
          <span class="text-xs font-medium text-foreground">Network</span>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <ArrowDown class="w-3 h-3 text-success" />
              <span class="text-2xs text-muted-foreground">Download</span>
            </div>
            <div class="text-lg font-bold font-mono text-success">
              {{ Math.round(perf.rxKbps) }}
              <span class="text-xs font-normal text-muted-foreground">KB/s</span>
            </div>
          </div>
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <ArrowUp class="w-3 h-3 text-foreground" />
              <span class="text-2xs text-muted-foreground">Upload</span>
            </div>
            <div class="text-lg font-bold font-mono text-foreground">
              {{ Math.round(perf.txKbps) }}
              <span class="text-xs font-normal text-muted-foreground">KB/s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
