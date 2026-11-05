<script setup lang="ts">
import { computed } from "vue";
import { ListButton, StatusDot } from "@capubridge/cladd";
import type { ADBDevice } from "@/types/adb.types";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import DeviceKindIcon from "./DeviceKindIcon.vue";
import { describeDeviceState } from "./deviceState";

const props = defineProps<{
  device: ADBDevice;
  connections: string;
  serials: string[];
  viewed: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{ select: [] }>();

const names = useDeviceNamesStore();
const name = computed(() => names.nameOf(props.device));
const state = computed(() => describeDeviceState(props.device, Date.now(), name.value));
const offline = computed(() => props.device.isStale === true);
</script>

<template>
  <ListButton
    size="md"
    :selected="props.viewed"
    :disabled="props.busy"
    data-roving-item
    :data-current="props.viewed || undefined"
    :title="props.serials.join(' · ')"
    tight-focus-ring
    class="w-full"
    :class="offline && !props.viewed ? 'opacity-70 hover:opacity-100' : ''"
    content-class-name="gap-2.5 px-2.5 py-1.5"
    icon-class-name="text-muted-foreground"
    @click="emit('select')"
  >
    <template #icon>
      <DeviceKindIcon :device="props.device" />
    </template>
    <span class="truncate text-sm font-medium text-foreground">{{ name }}</span>
    <template #footer>
      <span class="flex min-w-0 items-center gap-1.5 text-2xs font-normal">
        <StatusDot :color="state.dotColor" :variant="state.dotVariant" size="xs" class="shrink-0" />
        <span class="shrink-0 text-muted-foreground">{{ state.label }}</span>
        <span class="truncate text-[var(--fg-subtle)]">{{ props.connections }}</span>
      </span>
    </template>
  </ListButton>
</template>
