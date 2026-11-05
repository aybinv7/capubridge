<script setup lang="ts">
import { computed } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { StatusDot } from "@capubridge/cladd";
import type { ADBDevice } from "@/types/adb.types";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import DeviceKindIcon from "@/components/device-manager/DeviceKindIcon.vue";
import { describeDeviceState } from "@/components/device-manager/deviceState";
import IconAction from "@/shared/components/presentation/IconAction.vue";

const props = defineProps<{
  device: ADBDevice;
  androidVersion: string | null;
  apiLevel: number | null;
  refreshing: boolean;
}>();

const emit = defineEmits<{ refresh: [] }>();

const names = useDeviceNamesStore();
const name = computed(() => names.nameOf(props.device));
const state = computed(() => describeDeviceState(props.device, Date.now(), name.value));
const transport = computed(() => {
  if (props.device.deviceKind === "emulator") return "Emulator";
  return props.device.connectionType === "wifi" ? "over Wi-Fi" : "over USB";
});
const stateLine = computed(() =>
  state.value.condition === "online"
    ? `${state.value.label} ${transport.value}`
    : state.value.label,
);
</script>

<template>
  <header class="flex items-center gap-3.5">
    <div
      class="flex size-11 shrink-0 items-center justify-center rounded-well bg-surface-2 text-muted-foreground shadow-bevel"
    >
      <DeviceKindIcon :device="props.device" :size="20" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <h1 class="truncate text-xl font-medium text-foreground" :title="props.device.serial">
        {{ name }}
      </h1>
      <p class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <StatusDot :color="state.dotColor" :variant="state.dotVariant" />
        <span class="shrink-0">{{ stateLine }}</span>
        <template v-if="props.androidVersion">
          <span aria-hidden="true" class="text-[var(--fg-subtle)]">·</span>
          <span class="shrink-0">Android {{ props.androidVersion }}</span>
        </template>
        <template v-if="props.apiLevel">
          <span aria-hidden="true" class="text-[var(--fg-subtle)]">·</span>
          <span class="shrink-0 font-mono text-2xs">API {{ props.apiLevel }}</span>
        </template>
      </p>
    </div>
    <IconAction
      label="Refresh device info"
      :loading="props.refreshing"
      class="shrink-0"
      @click="emit('refresh')"
    >
      <RefreshCw :stroke-width="1.8" />
    </IconAction>
  </header>
</template>
