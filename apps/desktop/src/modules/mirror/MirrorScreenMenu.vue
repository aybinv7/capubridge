<script setup lang="ts">
import { ref } from "vue";
import {
  AppWindow,
  MousePointer2,
  PanelLeft,
  PanelRight,
  RotateCw,
  SlidersHorizontal,
} from "lucide-vue-next";
import { Button, Popover, Switch } from "@capubridge/cladd";
import type { MirrorSide } from "@/stores/mirror.store";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import MirrorSettingsPanel from "./MirrorSettingsPanel.vue";

const props = defineProps<{
  androidMode: boolean;
  isLocal: boolean;
  side: MirrorSide;
  laserMode: boolean;
}>();

const emit = defineEmits<{
  toggleLaser: [];
  toggleSide: [];
  launchScrcpy: [];
  refresh: [];
}>();

const open = ref(false);
const anchor = ref<HTMLElement | null>(null);

function run(action: () => void) {
  open.value = false;
  action();
}

const rowClass = "h-7 w-full justify-start text-xs font-normal";
const rowContentClass = "w-full justify-start gap-2.5 px-2 [&>svg]:size-3.5";
</script>

<template>
  <span ref="anchor" class="inline-flex">
    <IconAction
      label="Screen settings"
      hint="Quality, pointer, side and more"
      :pressed="open"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = !open"
    >
      <SlidersHorizontal :stroke-width="1.8" />
    </IconAction>
  </span>

  <Popover
    v-model:open="open"
    :anchor-element="anchor ?? undefined"
    position="bottom-end"
    :offset="6"
    class="w-64"
    content-class-name="w-full p-0"
    aria-label="Screen settings"
  >
    <MirrorSettingsPanel :android-mode="props.androidMode" :is-local="props.isLocal" />

    <div
      class="flex flex-col gap-px p-1.5"
      :class="!props.isLocal || props.androidMode ? 'border-t border-border-subtle' : ''"
    >
      <label
        v-if="!props.isLocal"
        class="flex h-7 cursor-pointer items-center gap-2.5 rounded-cladd-md px-2 text-xs text-foreground hover:bg-cladd-surface-hover"
      >
        <MousePointer2 :size="14" :stroke-width="1.8" class="text-muted-foreground" />
        <span class="flex-1">Laser pointer</span>
        <Switch
          size="sm"
          :model-value="props.laserMode"
          aria-label="Laser pointer"
          @update:model-value="emit('toggleLaser')"
        />
      </label>

      <Button
        variant="transparent"
        :outline="false"
        :class="rowClass"
        :content-class-name="rowContentClass"
        @click="run(() => emit('refresh'))"
      >
        <RotateCw :stroke-width="1.8" class="text-muted-foreground" />
        {{ props.isLocal ? "Reload the page" : "Restart the stream" }}
      </Button>

      <Button
        v-if="props.androidMode"
        variant="transparent"
        :outline="false"
        :class="rowClass"
        :content-class-name="rowContentClass"
        @click="run(() => emit('launchScrcpy'))"
      >
        <AppWindow :stroke-width="1.8" class="text-muted-foreground" />
        Open in a scrcpy window
      </Button>

      <Button
        variant="transparent"
        :outline="false"
        :class="rowClass"
        :content-class-name="rowContentClass"
        @click="run(() => emit('toggleSide'))"
      >
        <PanelLeft
          v-if="props.side === 'right'"
          :stroke-width="1.8"
          class="text-muted-foreground"
        />
        <PanelRight v-else :stroke-width="1.8" class="text-muted-foreground" />
        {{ props.side === "right" ? "Move to the left side" : "Move to the right side" }}
      </Button>
    </div>
  </Popover>
</template>
