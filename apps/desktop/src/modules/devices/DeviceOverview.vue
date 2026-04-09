<script setup lang="ts">
import { computed } from "vue";
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
  MemoryStick,
  RefreshCw,
  Usb,
  AlertCircle,
  Loader2,
} from "lucide-vue-next";
import { useQuery } from "@tanstack/vue-query";
import { Button } from "@/components/ui/button";
import { useDevicesStore } from "@/stores/devices.store";
import { useAdb } from "@/composables/useAdb";

const devicesStore = useDevicesStore();
const { getDeviceOverview } = useAdb();

const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");

const {
  data: info,
  isLoading,
  isError,
  error,
  refetch,
} = useQuery({
  queryKey: computed(() => ["device-info", serial.value]),
  queryFn: () => getDeviceOverview(serial.value),
  enabled: computed(() => !!serial.value),
  staleTime: 30_000,
});

function fmtBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const infoCards = computed(() => {
  const d = info.value;
  if (!d) return [];
  const usedStorage = d.totalStorage - d.availableStorage;
  const storagePct = d.totalStorage > 0 ? Math.round((usedStorage / d.totalStorage) * 100) : 0;

  return [
    {
      icon: Monitor,
      label: "Display",
      value: d.screenResolution || "—",
      color: "text-sky-400",
    },
    {
      icon: Cpu,
      label: "CPU / ABI",
      value: d.model || "—",
      color: "text-amber-400",
    },
    {
      icon: HardDrive,
      label: "Storage",
      value: d.totalStorage
        ? `${fmtBytes(usedStorage)} / ${fmtBytes(d.totalStorage)} (${storagePct}%)`
        : "—",
      color: "text-foreground",
    },
    {
      icon: MemoryStick,
      label: "RAM",
      value: d.totalStorage ? fmtBytes(d.totalRam ?? 0) : "—",
      color: "text-violet-400",
    },
    {
      icon: Wifi,
      label: "IP Address",
      value: (d.ipAddresses ?? []).join(", ") || "—",
      color: "text-emerald-400",
    },
    {
      icon: Zap,
      label: "Android",
      value: d.androidVersion ? `Android ${d.androidVersion} (API ${d.apiLevel})` : "—",
      color: "text-foreground",
    },
  ];
});

const deviceName = computed(() => {
  const d = info.value;
  if (!d) return devicesStore.selectedDevice?.model ?? "Device";
  return d.manufacturer ? `${d.manufacturer} ${d.model}` : d.model;
});

const connectionIcon = computed(() =>
  devicesStore.selectedDevice?.connectionType === "wifi" ? Wifi : Usb,
);
const connectionLabel = computed(() =>
  devicesStore.selectedDevice?.connectionType === "wifi" ? "Wi-Fi" : "USB",
);
</script>

<template>
  <div class="flex-1 overflow-y-auto p-8">
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- Loading -->
      <div
        v-if="isLoading"
        class="flex items-center justify-center h-40 text-muted-foreground/50 gap-2 text-sm"
      >
        <Loader2 class="w-4 h-4 animate-spin" />
        Loading device info…
      </div>

      <!-- Error -->
      <div
        v-else-if="isError"
        class="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
      >
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
        <div class="flex-1">
          <div class="font-medium">Failed to load device info</div>
          <div class="mt-0.5 font-mono text-[11px] text-red-400/70">
            {{ error }}
          </div>
        </div>
        <Button variant="ghost" size="sm" class="text-red-400 h-7 px-2" @click="refetch">
          <RefreshCw class="w-3.5 h-3.5 mr-1" /> Retry
        </Button>
      </div>

      <template v-else-if="info || devicesStore.selectedDevice">
        <!-- Device header -->
        <div class="flex items-center gap-4">
          <div
            class="w-14 h-14 rounded-xl bg-surface-2 border border-border/30 flex items-center justify-center"
          >
            <Smartphone class="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h1 class="text-lg font-semibold text-foreground">
              {{ deviceName }}
            </h1>
            <p class="text-sm text-muted-foreground font-mono">{{ serial }}</p>
          </div>
          <div class="ml-auto flex items-center gap-3">
            <div class="flex items-center gap-1.5 text-sm">
              <component :is="connectionIcon" class="w-3.5 h-3.5 text-muted-foreground" />
              <span class="text-muted-foreground text-xs">{{ connectionLabel }}</span>
            </div>
            <div class="w-px h-4 bg-border/30" />
            <Button
              variant="ghost"
              size="icon-sm"
              class="w-7 h-7 text-muted-foreground/50"
              @click="refetch"
            >
              <RefreshCw class="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <!-- Info grid -->
        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="item in infoCards"
            :key="item.label"
            class="bg-surface-2 border border-border/30 rounded-lg p-4 transition-colors hover:border-border/50"
          >
            <div class="flex items-center gap-2.5 mb-3">
              <div
                class="w-8 h-8 rounded-md bg-surface-3 border border-border/20 flex items-center justify-center"
              >
                <component :is="item.icon" class="w-4 h-4" :class="item.color" />
              </div>
              <span class="text-xs text-muted-foreground uppercase tracking-wider">
                {{ item.label }}
              </span>
            </div>
            <span class="text-sm font-medium text-foreground font-mono break-all">{{
              item.value
            }}</span>
          </div>
        </div>
      </template>

      <!-- No device selected -->
      <div v-else class="flex items-center justify-center h-40 text-muted-foreground/30 text-sm">
        No device selected
      </div>
    </div>
  </div>
</template>
