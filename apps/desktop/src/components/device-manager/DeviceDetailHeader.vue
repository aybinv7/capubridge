<script setup lang="ts">
import { computed } from "vue";
import { Unplug, Wifi } from "lucide-vue-next";
import { Button, Spinner, StatusDot } from "@capubridge/cladd";
import type { ADBDevice } from "@/types/adb.types";
import { deviceIdentity } from "@/lib/device-name";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DeviceKindIcon from "./DeviceKindIcon.vue";
import PortReversePopover from "./PortReversePopover.vue";
import { describeDeviceState } from "./deviceState";

const props = defineProps<{
  device: ADBDevice;
  androidVersion: string | null;
  apiLevel: number | null;
  loadingInfo: boolean;
  switchingToWifi: boolean;
  forgetting: boolean;
}>();

const emit = defineEmits<{ useWifi: []; disconnect: []; forget: [] }>();

const names = useDeviceNamesStore();
const name = computed(() => names.nameOf(props.device));
const state = computed(() => describeDeviceState(props.device, Date.now(), name.value));
const identity = computed(() => deviceIdentity(props.device));
const online = computed(() => state.value.condition === "online");
const transport = computed(() => {
  if (props.device.deviceKind === "emulator") return "Emulator";
  return props.device.connectionType === "wifi" ? "Wi-Fi" : "USB";
});
</script>

<template>
  <header class="flex items-start gap-3 px-5 pt-5 pb-4">
    <div
      class="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-muted-foreground shadow-bevel"
    >
      <DeviceKindIcon :device="props.device" :size="17" />
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex min-w-0 items-center gap-2">
        <h2 class="truncate text-base font-medium text-foreground">{{ name }}</h2>
        <StatusDot :color="state.dotColor" :variant="state.dotVariant" />
        <span class="shrink-0 text-xs text-muted-foreground">{{ state.label }}</span>
      </div>
      <div class="flex min-w-0 items-center gap-1.5 text-2xs text-[var(--fg-subtle)]">
        <span class="shrink-0">{{ transport }}</span>
        <template v-if="props.androidVersion">
          <span aria-hidden="true">·</span>
          <span class="shrink-0">Android {{ props.androidVersion }}</span>
        </template>
        <template v-if="props.apiLevel">
          <span aria-hidden="true">·</span>
          <span class="shrink-0 font-mono">API {{ props.apiLevel }}</span>
        </template>
        <Spinner v-else-if="props.loadingInfo" size="xs" class="shrink-0" />
        <span aria-hidden="true">·</span>
        <span class="truncate" :title="props.device.serial">{{ identity }}</span>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-0.5">
      <Button
        v-if="
          online && props.device.connectionType === 'usb' && props.device.deviceKind !== 'emulator'
        "
        variant="transparent"
        :outline="false"
        size="sm"
        :loading="props.switchingToWifi"
        content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
        class="text-muted-foreground hover:text-foreground"
        title="Switch this device to Wi-Fi debugging so the cable can come out"
        @click="emit('useWifi')"
      >
        <Wifi :stroke-width="1.8" />
        Use Wi-Fi
      </Button>
      <PortReversePopover v-if="online" :serial="props.device.serial" />
      <IconAction
        v-if="state.condition !== 'absent' && props.device.connectionType === 'wifi'"
        label="Disconnect"
        hint="Drops the Wi-Fi debugging link"
        @click="emit('disconnect')"
      >
        <Unplug :stroke-width="1.8" />
      </IconAction>
      <Button
        v-if="state.condition === 'absent'"
        variant="transparent"
        :outline="false"
        size="sm"
        :loading="props.forgetting"
        content-class-name="px-2.5"
        class="text-muted-foreground hover:text-foreground"
        @click="emit('forget')"
      >
        Forget
      </Button>
    </div>
  </header>
</template>
