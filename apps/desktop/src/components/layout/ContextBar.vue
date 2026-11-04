<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, Globe, Monitor, Smartphone } from "lucide-vue-next";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useAppPackages } from "@/composables/useAppPackages";
import DeviceManagerModal from "@/components/DeviceManagerModal.vue";
import AppIcon from "@/modules/devices/AppIcon.vue";

const context = useActiveContextStore();
const devicesStore = useDevicesStore();
const modalOpen = ref(false);

const device = computed(() => context.device);
const target = computed(() => context.target);
const serial = computed(() => device.value?.serial ?? "");
const { getCachedPackage } = useAppPackages(serial);

const sourceIcon = computed(() => {
  if (context.kind === "local") return Monitor;
  if (context.kind === "chrome") return Globe;
  return Smartphone;
});

const sourceLabel = computed(() => {
  if (context.kind === "local") return "This PC";
  if (context.kind === "chrome") return "Chrome";
  return device.value?.model ?? "No device";
});

const deviceOnline = computed(() => device.value?.status === "online");

const targetLabel = computed(() => {
  const selected = target.value;
  if (!selected) return null;
  const title = selected.title?.trim();
  return title ? title : selected.url;
});

const link = computed(() => {
  switch (context.targetStatus) {
    case "connected":
      return { label: "live", dot: "bg-signal-live", text: "text-signal-live" };
    case "connecting":
      return { label: "connecting", dot: "bg-warning", text: "text-warning" };
    case "error":
      return { label: "error", dot: "bg-error", text: "text-error" };
    case "disconnected":
      return { label: "disconnected", dot: "bg-error", text: "text-error" };
    case "idle":
      return { label: "attached", dot: "bg-[var(--fg-subtle)]", text: "text-muted-foreground" };
    default:
      return null;
  }
});

const deviceDot = computed(() => {
  if (context.kind === "local" || context.kind === "chrome") return "bg-success";
  if (deviceOnline.value) return "bg-success";
  if (device.value) return "bg-[var(--fg-subtle)]";
  return "bg-transparent ring-1 ring-[var(--border-strong)]";
});

function onDeviceSelected(selectedSerial: string) {
  const match = devicesStore.devices.find((entry) => entry.serial === selectedSerial);
  if (match) void devicesStore.selectDevice(match);
}
</script>

<template>
  <button
    type="button"
    class="group flex h-7 min-w-[220px] max-w-[460px] items-center gap-2 rounded-md bg-[var(--bg-surface-cut)] px-2.5 shadow-cut transition-colors duration-[120ms] hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
    aria-haspopup="dialog"
    :aria-label="`Context: ${sourceLabel}${targetLabel ? ` › ${targetLabel}` : ''}. Change device or target`"
    style="-webkit-app-region: no-drag"
    @click="modalOpen = true"
  >
    <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="deviceDot" />
    <component :is="sourceIcon" :size="13" class="shrink-0 text-muted-foreground" />
    <span class="shrink-0 truncate text-xs font-medium text-foreground">{{ sourceLabel }}</span>

    <span class="shrink-0 text-xs text-[var(--fg-subtle)]">›</span>

    <template v-if="targetLabel">
      <AppIcon
        v-if="target?.source === 'adb' && target?.packageName"
        :serial="serial"
        :package-name="target.packageName"
        :apk-path="getCachedPackage(target.packageName)?.apkPath ?? ''"
        :icon-path="getCachedPackage(target.packageName)?.iconPath"
        size="sm"
        class="!h-4 !w-4 !rounded-sm"
      />
      <span class="min-w-0 flex-1 truncate text-left text-xs text-muted-foreground">
        {{ targetLabel }}
      </span>
      <span
        v-if="link"
        class="flex shrink-0 items-center gap-1 font-mono text-2xs"
        :class="link.text"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="link.dot" />
        {{ link.label }}
      </span>
    </template>
    <span v-else class="flex-1 text-left text-xs text-signal-select"> Select a target </span>

    <ChevronDown :size="12" class="shrink-0 text-[var(--fg-subtle)] group-hover:text-foreground" />
  </button>

  <DeviceManagerModal
    :open="modalOpen"
    @close="modalOpen = false"
    @select-device="onDeviceSelected"
  />
</template>
