<script setup lang="ts">
import { computed } from "vue";
import { Circle, Power, Square, Triangle, Volume1, Volume2 } from "lucide-vue-next";
import { Toolbar, ToolbarSeparator } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { AndroidKey, type AndroidKeyCode } from "./useMirrorStream";

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
    <IconAction
      label="Volume down"
      size="sm"
      position="top"
      :disabled="props.disabled"
      @click="emit('keyevent', AndroidKey.VOLUME_DOWN)"
    >
      <Volume1 :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Volume up"
      size="sm"
      position="top"
      :disabled="props.disabled"
      @click="emit('keyevent', AndroidKey.VOLUME_UP)"
    >
      <Volume2 :stroke-width="1.8" />
    </IconAction>

    <ToolbarSeparator :class="separatorClass" />

    <IconAction
      label="Back"
      hint="Right-click on the screen does the same"
      size="sm"
      position="top"
      :disabled="props.disabled"
      @click="emit('keyevent', AndroidKey.BACK)"
    >
      <Triangle :stroke-width="1.8" class="-rotate-90" />
    </IconAction>
    <IconAction
      label="Home"
      hint="Middle-click on the screen does the same"
      size="sm"
      position="top"
      :disabled="props.disabled"
      @click="emit('keyevent', AndroidKey.HOME)"
    >
      <Circle :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Recent apps"
      size="sm"
      position="top"
      :disabled="props.disabled"
      @click="emit('keyevent', AndroidKey.RECENTS)"
    >
      <Square :stroke-width="1.8" />
    </IconAction>

    <ToolbarSeparator :class="separatorClass" />

    <IconAction
      label="Turn the screen off"
      size="sm"
      position="top"
      :disabled="props.disabled"
      @click="emit('keyevent', AndroidKey.SLEEP)"
    >
      <Power :stroke-width="1.8" />
    </IconAction>
  </Toolbar>
</template>
