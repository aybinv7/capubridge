<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, ChevronDown } from "lucide-vue-next";
import { useDevicesStore } from "@/stores/devices.store";
import { useSourceStore } from "@/stores/source.store";
import { useTargetsStore } from "@/stores/targets.store";
import DeviceManagerModal from "@/components/DeviceManagerModal.vue";

const emit = defineEmits<{ openModal: [] }>();

const devicesStore = useDevicesStore();
const sourceStore = useSourceStore();
const targetsStore = useTargetsStore();

const modalOpen = ref(false);

const device = computed(() => devicesStore.selectedDevice);
const target = computed(() => targetsStore.selectedTarget);
const hasChromeSource = computed(() => sourceStore.hasChromeSource);

const isConnected = computed(() => device.value?.status === "online" || hasChromeSource.value);

const statusClass = computed(() => {
  if (target.value?.source === "chrome") return "bg-blue-400";
  if (device.value?.status === "online") return "bg-status-success";
  if (hasChromeSource.value) return "bg-status-success";
  return "bg-muted-foreground/20";
});

const sourceLabel = computed(() => {
  if (target.value?.source === "chrome") return "Local";
  if (device.value?.status === "online") return device.value.model;
  if (hasChromeSource.value) return "Local";
  if (device.value) return device.value.model;
  return "No connection";
});

const targetLabel = computed(() => {
  if (!target.value) return null;
  const t = target.value.title?.trim();
  return t && t !== "" ? t : target.value.url;
});

function onDeviceSelected(serial: string) {
  const d = devicesStore.devices.find((x) => x.serial === serial);
  if (d) devicesStore.selectDevice(d);
}
</script>

<template>
  <button
    @click="modalOpen = true"
    class="flex items-center gap-1.5 h-7 px-3 rounded-full border transition-all duration-150 max-w-[360px] min-w-[140px]"
    :class="
      isConnected
        ? 'bg-surface-2 border-border/30 hover:border-border/50 hover:bg-surface-3'
        : 'border-dashed border-border/20 hover:border-border/40 hover:bg-surface-2/40'
    "
    style="-webkit-app-region: no-drag"
  >
    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="statusClass" />

    <span class="text-[11px] font-medium text-foreground/80 leading-none shrink-0">
      {{ sourceLabel }}
    </span>

    <span
      v-if="device?.status === 'online' && hasChromeSource"
      class="w-1 h-1 rounded-full bg-blue-400/50 shrink-0"
      title="Local Chrome also active"
    />

    <template v-if="targetLabel">
      <ChevronRight :size="9" class="text-muted-foreground/25 shrink-0" />
      <img v-if="target?.faviconUrl" :src="target.faviconUrl" alt="" class="w-4 h-4" />
      <span class="text-[11px] text-muted-foreground/55 truncate leading-none">
        {{ targetLabel }}
      </span>
    </template>
    <span v-else class="text-[11px] text-muted-foreground/25 leading-none shrink-0">
      no target
    </span>

    <ChevronDown :size="9" class="text-muted-foreground/25 shrink-0 ml-0.5" />
  </button>

  <DeviceManagerModal
    :open="modalOpen"
    @close="modalOpen = false"
    @select-device="onDeviceSelected"
  />
</template>
