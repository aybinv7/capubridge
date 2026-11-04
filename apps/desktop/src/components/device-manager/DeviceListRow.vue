<script setup lang="ts">
import { computed } from "vue";
import { ListButton, StatusDot } from "@capubridge/cladd";
import type { ADBDevice } from "@/types/adb.types";
import DeviceKindIcon from "./DeviceKindIcon.vue";
import { describeDeviceState, deviceDisplayName } from "./deviceState";

const props = defineProps<{
  device: ADBDevice;
  viewed: boolean;
  inUse: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{ select: [] }>();

const state = computed(() => describeDeviceState(props.device));
const name = computed(() => deviceDisplayName(props.device));
</script>

<template>
  <ListButton
    size="md"
    :selected="props.viewed"
    :disabled="props.busy"
    data-roving-item
    :data-current="props.viewed || undefined"
    :aria-current="props.inUse ? 'true' : undefined"
    class="w-full"
    content-class-name="gap-2.5 px-2.5 py-1.5"
    icon-class-name="text-muted-foreground"
    @click="emit('select')"
  >
    <template #icon>
      <DeviceKindIcon :device="props.device" />
    </template>
    <span class="flex min-w-0 items-center gap-1.5">
      <span class="truncate text-sm font-medium text-foreground">{{ name }}</span>
      <span v-if="props.inUse" class="shrink-0 text-2xs font-normal text-signal-select"
        >In use</span
      >
    </span>
    <template #footer>
      <span class="flex min-w-0 items-center gap-1.5 text-2xs">
        <StatusDot :color="state.dotColor" :variant="state.dotVariant" size="xs" class="shrink-0" />
        <span class="shrink-0 text-muted-foreground">{{ state.label }}</span>
        <span class="truncate font-mono text-[var(--fg-subtle)]">{{ props.device.serial }}</span>
      </span>
    </template>
  </ListButton>
</template>
