<script setup lang="ts">
import { computed, type Component } from "vue";
import { Circle, Power, Square, Triangle, Volume1, Volume2 } from "lucide-vue-next";
import type { TooltipPosition } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { AndroidKey, type AndroidKeyCode } from "./mirrorTypes";

export type MirrorKeyGroupName = "volume" | "navigation" | "power";

const props = withDefaults(
  defineProps<{
    group: MirrorKeyGroupName;
    disabled?: boolean;
    position?: TooltipPosition;
    size?: "sm" | "md";
  }>(),
  { disabled: false, position: "top", size: "sm" },
);

const emit = defineEmits<{ keyevent: [keycode: AndroidKeyCode] }>();

interface KeyAction {
  label: string;
  hint?: string;
  keycode: AndroidKeyCode;
  icon: Component;
  iconClass?: string;
}

const GROUPS: Record<MirrorKeyGroupName, KeyAction[]> = {
  volume: [
    { label: "Volume down", keycode: AndroidKey.VOLUME_DOWN, icon: Volume1 },
    { label: "Volume up", keycode: AndroidKey.VOLUME_UP, icon: Volume2 },
  ],
  navigation: [
    {
      label: "Back",
      hint: "Right-click on the screen does the same",
      keycode: AndroidKey.BACK,
      icon: Triangle,
      iconClass: "-rotate-90",
    },
    {
      label: "Home",
      hint: "Middle-click on the screen does the same",
      keycode: AndroidKey.HOME,
      icon: Circle,
    },
    { label: "Recent apps", keycode: AndroidKey.RECENTS, icon: Square },
  ],
  power: [{ label: "Turn the screen off", keycode: AndroidKey.SLEEP, icon: Power }],
};

const actions = computed(() => GROUPS[props.group]);
</script>

<template>
  <IconAction
    v-for="action in actions"
    :key="action.keycode"
    :label="action.label"
    :hint="action.hint"
    :size="props.size"
    :position="props.position"
    :disabled="props.disabled"
    @click="emit('keyevent', action.keycode)"
  >
    <component :is="action.icon" :stroke-width="1.8" :class="action.iconClass" />
  </IconAction>
</template>
