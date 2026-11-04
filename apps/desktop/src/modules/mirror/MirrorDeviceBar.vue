<script setup lang="ts">
import { toRef } from "vue";
import { Toolbar } from "@capubridge/cladd";
import MirrorKeyGroup from "./MirrorKeyGroup.vue";
import MirrorRotationActions from "./MirrorRotationActions.vue";
import type { DeviceOrientation } from "./deviceRotation";
import type { AndroidKeyCode } from "./mirrorTypes";
import { useDeviceRotation } from "./useDeviceRotation";

const props = withDefaults(
  defineProps<{
    serial: string | null;
    streamOrientation: DeviceOrientation | null;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{ keyevent: [keycode: AndroidKeyCode] }>();

const rotation = useDeviceRotation({
  serial: toRef(props, "serial"),
  streamOrientation: toRef(props, "streamOrientation"),
});
</script>

<template>
  <Toolbar
    size="sm"
    role="toolbar"
    aria-label="Device buttons"
    aria-orientation="horizontal"
    class="w-full"
    content-class-name="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1 p-1"
  >
    <div class="flex items-center gap-0.5 justify-self-start">
      <MirrorKeyGroup
        group="volume"
        :disabled="props.disabled"
        @keyevent="emit('keyevent', $event)"
      />
    </div>
    <div class="flex items-center gap-0.5">
      <MirrorKeyGroup
        group="navigation"
        :disabled="props.disabled"
        @keyevent="emit('keyevent', $event)"
      />
    </div>
    <div class="flex items-center gap-0.5 justify-self-end">
      <MirrorRotationActions
        :target="rotation.target.value"
        :locked="rotation.locked.value"
        :available="rotation.available.value && !props.disabled"
        :busy="rotation.busy.value"
        @rotate="rotation.rotate()"
        @restore-auto="rotation.restoreAuto()"
      />
      <MirrorKeyGroup
        group="power"
        :disabled="props.disabled"
        @keyevent="emit('keyevent', $event)"
      />
    </div>
  </Toolbar>
</template>
