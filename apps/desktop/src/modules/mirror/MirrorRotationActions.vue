<script setup lang="ts">
import { computed } from "vue";
import { Lock, RotateCcwSquare, RotateCwSquare } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { DeviceOrientation } from "./deviceRotation";

const props = withDefaults(
  defineProps<{
    target: DeviceOrientation;
    locked: boolean;
    available: boolean;
    busy: boolean;
    size?: "sm" | "md";
  }>(),
  { size: "md" },
);

const emit = defineEmits<{ rotate: []; restoreAuto: [] }>();

const rotateLabel = computed(() =>
  props.target === "landscape" ? "Turn to landscape" : "Turn to portrait",
);
const rotateHint = computed(() =>
  props.available
    ? "Holds the device in this orientation; auto-rotate stays off until you turn it back on"
    : "Rotation settings could not be read from this device",
);
</script>

<template>
  <IconAction
    :label="rotateLabel"
    :hint="rotateHint"
    :size="props.size"
    position="top"
    :disabled="!props.available"
    :loading="props.busy"
    @click="emit('rotate')"
  >
    <RotateCwSquare v-if="props.target === 'landscape'" :stroke-width="1.8" />
    <RotateCcwSquare v-else :stroke-width="1.8" />
  </IconAction>
  <IconAction
    v-if="props.locked"
    label="Orientation held: turn auto-rotate back on"
    hint="The device follows how it is held again"
    :size="props.size"
    position="top"
    pressed
    :disabled="props.busy"
    @click="emit('restoreAuto')"
  >
    <Lock :stroke-width="1.8" />
  </IconAction>
</template>
