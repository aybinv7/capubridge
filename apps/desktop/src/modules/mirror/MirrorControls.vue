<script setup lang="ts">
import { computed } from "vue";
import { Toolbar, ToolbarSeparator } from "@capubridge/cladd";
import MirrorKeyGroup from "./MirrorKeyGroup.vue";
import type { AndroidKeyCode } from "./mirrorTypes";

const props = withDefaults(defineProps<{ vertical?: boolean; disabled?: boolean }>(), {
  vertical: false,
  disabled: false,
});

const emit = defineEmits<{ keyevent: [keycode: AndroidKeyCode] }>();

const separatorClass = computed(() => (props.vertical ? "mx-0 my-1 h-px w-1/2" : undefined));
</script>

<template>
  <Toolbar
    size="sm"
    role="toolbar"
    aria-label="Device buttons"
    :aria-orientation="props.vertical ? 'vertical' : 'horizontal'"
    :content-class-name="props.vertical ? 'flex-col gap-0.5 p-1' : 'gap-0.5 p-1'"
  >
    <MirrorKeyGroup
      group="volume"
      :disabled="props.disabled"
      @keyevent="emit('keyevent', $event)"
    />
    <ToolbarSeparator :class="separatorClass" />
    <MirrorKeyGroup
      group="navigation"
      :disabled="props.disabled"
      @keyevent="emit('keyevent', $event)"
    />
    <ToolbarSeparator :class="separatorClass" />
    <MirrorKeyGroup group="power" :disabled="props.disabled" @keyevent="emit('keyevent', $event)" />
  </Toolbar>
</template>
