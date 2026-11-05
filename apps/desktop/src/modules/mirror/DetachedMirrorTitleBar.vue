<script setup lang="ts">
import { Pin, PinOff } from "lucide-vue-next";
import WindowControls from "@/components/layout/WindowControls.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";

defineProps<{
  deviceLabel: string;
  alwaysOnTop: boolean;
}>();

const emit = defineEmits<{
  toggleAlwaysOnTop: [];
  closeWindow: [];
}>();
</script>

<template>
  <div
    class="relative flex h-9 shrink-0 items-center bg-background pl-1.5"
    style="-webkit-app-region: drag"
  >
    <div class="z-10 flex items-center" style="-webkit-app-region: no-drag">
      <IconAction
        :label="alwaysOnTop ? 'Unpin from the top' : 'Keep on top of other windows'"
        size="md"
        toggle
        :pressed="alwaysOnTop"
        @click="emit('toggleAlwaysOnTop')"
      >
        <Pin v-if="alwaysOnTop" :stroke-width="1.8" />
        <PinOff v-else :stroke-width="1.8" />
      </IconAction>
    </div>

    <div class="pointer-events-none absolute inset-0 flex items-center justify-center px-36">
      <span class="truncate text-xs font-medium text-foreground">{{ deviceLabel }}</span>
    </div>

    <div class="z-10 ml-auto self-start">
      <WindowControls size="sm" :close="() => emit('closeWindow')" />
    </div>
  </div>
</template>
