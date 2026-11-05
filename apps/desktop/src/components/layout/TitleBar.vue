<script setup lang="ts">
import { useRouter } from "vue-router";
import { useBindingHint } from "@/composables/useBindingHint";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { shellIcons } from "@/shared/icons/shell-icons";
import RecordingButton from "@/modules/recording/RecordingButton.vue";
import ContextBar from "./ContextBar.vue";
import TitleBarPanelToggles from "./TitleBarPanelToggles.vue";
import WindowControls from "./WindowControls.vue";

const emit = defineEmits<{ openCommandPalette: [] }>();

const router = useRouter();
const { keysOf } = useBindingHint();
</script>

<template>
  <header
    class="relative grid h-11.5 shrink-0 select-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-background pl-3"
    style="-webkit-app-region: drag"
  >
    <div class="flex items-center gap-0.5 justify-self-start" style="-webkit-app-region: no-drag">
      <IconAction label="Back" @click="router.back()">
        <component :is="shellIcons.back" />
      </IconAction>
      <IconAction label="Forward" @click="router.forward()">
        <component :is="shellIcons.forward" />
      </IconAction>
      <IconAction
        label="Search or run"
        hint="Commands, screens and settings"
        :keys="keysOf('view.palette') ?? undefined"
        class="ml-1.5"
        @click="emit('openCommandPalette')"
      >
        <component :is="shellIcons.search" />
      </IconAction>
    </div>

    <div class="flex min-w-0 items-center justify-center" style="-webkit-app-region: no-drag">
      <ContextBar />
    </div>

    <div class="flex min-w-0 items-center justify-self-end">
      <div class="flex items-center gap-2 pr-2" style="-webkit-app-region: no-drag">
        <RecordingButton />
        <TitleBarPanelToggles />
      </div>
      <WindowControls />
    </div>
  </header>
</template>
