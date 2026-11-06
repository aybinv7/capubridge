<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, Maximize2, Minimize2, SquareArrowOutUpRight } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useBindingHint } from "@/composables/useBindingHint";
import { useDrawerStore } from "@/stores/drawer.store";
import { DRAWER_VIEW_META } from "./drawerViews";

/** Pop the view out, fill the work column, or hide the drawer. */
const emit = defineEmits<{ popout: []; hide: [] }>();

const drawer = useDrawerStore();
const { keysOf } = useBindingHint();
const label = computed(() => DRAWER_VIEW_META[drawer.currentView].label);
</script>

<template>
  <span class="flex shrink-0 items-center gap-0.5">
    <IconAction
      :label="`Open ${label} in its own window`"
      hint="Capture stays in this window"
      @click="emit('popout')"
    >
      <SquareArrowOutUpRight :stroke-width="1.8" />
    </IconAction>
    <IconAction
      :label="drawer.maximized ? 'Back to the drawer height' : 'Fill the work column'"
      toggle
      :pressed="drawer.maximized"
      @click="drawer.toggleMaximized()"
    >
      <Minimize2 v-if="drawer.maximized" :stroke-width="1.8" />
      <Maximize2 v-else :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Hide the console"
      :keys="keysOf('view.toggle-dock') ?? undefined"
      @click="emit('hide')"
    >
      <ChevronDown :stroke-width="1.8" />
    </IconAction>
  </span>
</template>
