<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useUIStore } from "@/stores/ui.store";
import { useAppPackages } from "@/composables/useAppPackages";
import { targetAppName } from "@/lib/target-app-name";
import AppIcon from "@/shared/apps/AppIcon.vue";
import DeviceManagerDialog from "@/components/device-manager/DeviceManagerDialog.vue";
import { LINK_TONE_MARK, LINK_TONE_TEXT } from "@/components/gate/linkTone";

const context = useActiveContextStore();
const devicesStore = useDevicesStore();
const ui = useUIStore();
const deviceNames = useDeviceNamesStore();

const device = computed(() => context.device);
const target = computed(() => context.target);

const sourceLabel = computed(() => {
  if (context.kind === "local") return "This PC";
  if (context.kind === "chrome") return "Chrome";
  return device.value ? deviceNames.nameOf(device.value) : "No device";
});

const serial = computed(() => device.value?.serial ?? "");
const { getCachedPackage } = useAppPackages(serial);

const targetPackage = computed(() => {
  const selected = target.value;
  return selected?.source === "adb" && selected.packageName ? selected.packageName : null;
});

const targetLabel = computed(() => {
  const packageName = targetPackage.value;
  return targetAppName(target.value, packageName ? getCachedPackage(packageName)?.label : null);
});

const leadMark = computed(() => {
  if (target.value) return LINK_TONE_MARK[context.link.tone];
  if (context.kind === "local" || context.kind === "chrome") return "rounded-full bg-success";
  if (device.value?.status === "online") return "rounded-full bg-success";
  if (device.value) return "rounded-full bg-[var(--fg-subtle)]";
  return "rounded-full ring-1 ring-inset ring-[var(--border-strong)]";
});

const linkText = computed(() =>
  context.link.tone === "live" ? "text-muted-foreground" : LINK_TONE_TEXT[context.link.tone],
);

const title = computed(() => {
  const parts = [sourceLabel.value];
  if (device.value && context.kind !== "local" && context.kind !== "chrome") {
    parts.push(device.value.serial, device.value.status);
  }
  if (targetLabel.value) parts.push(targetLabel.value, context.link.description);
  return parts.join(" · ");
});

function onDeviceSelected(selectedSerial: string) {
  const match = devicesStore.devices.find((entry) => entry.serial === selectedSerial);
  if (match) void devicesStore.selectDevice(match);
}
</script>

<template>
  <Button
    variant="solid"
    surface-level="1"
    class="h-7.5 max-w-[460px] min-w-0 border border-border text-sm font-normal"
    content-class-name="min-w-0 gap-2.5 overflow-hidden px-3 [&>svg]:size-3"
    aria-haspopup="dialog"
    :aria-label="`Context: ${sourceLabel}${targetLabel ? `, ${targetLabel}, ${context.link.label}` : ''}. Change device or target`"
    :title="title"
    style="-webkit-app-region: no-drag"
    @click="ui.openDeviceManager()"
  >
    <span class="size-1.75 shrink-0" :class="leadMark" aria-hidden="true" />
    <span class="shrink-0 truncate font-medium text-foreground">{{ sourceLabel }}</span>
    <span class="shrink-0 text-[var(--fg-subtle)]" aria-hidden="true">/</span>
    <template v-if="targetLabel">
      <AppIcon
        v-if="targetPackage"
        :serial="serial"
        :package-name="targetPackage"
        :apk-path="getCachedPackage(targetPackage)?.apkPath ?? ''"
        :icon-path="getCachedPackage(targetPackage)?.iconPath"
        size="sm"
        class="!size-4 shrink-0 !rounded-[4px]"
      />
      <span class="min-w-0 truncate text-foreground">{{ targetLabel }}</span>
      <span class="shrink-0" :class="linkText">{{ context.link.label }}</span>
    </template>
    <span v-else-if="context.kind === 'local'" class="shrink-0 text-muted-foreground">New tab</span>
    <span v-else class="shrink-0 text-signal-select">Select a target</span>
    <ChevronDown :size="12" class="shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
  </Button>

  <DeviceManagerDialog
    :open="ui.deviceManagerOpen"
    :panel="ui.deviceManagerPanel"
    @close="ui.closeDeviceManager()"
    @select-device="onDeviceSelected"
  />
</template>
