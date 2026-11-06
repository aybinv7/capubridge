<script setup lang="ts">
import { computed, ref } from "vue";
import TimelineStrip from "@/shared/components/timeline/TimelineStrip.vue";
import { useDrawerStore } from "@/stores/drawer.store";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import ConsoleDrawer from "./ConsoleDrawer.vue";
import { useDrawerPopout } from "./useDrawerPopout";

/**
 * The foot of the work column: the console drawer above the timeline tray, each its own card.
 * The strip sits here only while it is set to the bottom edge. Maximised, the drawer takes the
 * whole column. Pop-outs are managed here, so a view can come back even after the drawer closed.
 */
const emit = defineEmits<{ requestMainFocus: [] }>();

const drawer = useDrawerStore();
const strip = useTimelineStripStore();
const { popOut } = useDrawerPopout();
const consoleDrawer = ref<InstanceType<typeof ConsoleDrawer> | null>(null);

const stripShown = computed(() => !strip.hidden && strip.edge === "bottom");
const fills = computed(() => drawer.isOpen && drawer.maximized);

defineExpose({
  focusDrawer() {
    consoleDrawer.value?.focus();
  },
});
</script>

<template>
  <div
    class="flex flex-col"
    :class="[
      fills ? 'min-h-0 flex-1' : 'shrink-0',
      drawer.isOpen || stripShown ? 'gap-1.5 px-1.5 pt-1.5 pb-1.5' : '',
    ]"
  >
    <Transition
      enter-active-class="transition-[clip-path,opacity] duration-300 ease-cladd-spring motion-reduce:transition-none"
      enter-from-class="opacity-0 [clip-path:inset(100%_0_0_0)]"
      enter-to-class="opacity-100 [clip-path:inset(0_0_0_0)]"
      leave-active-class="transition-[clip-path,opacity] duration-200 ease-in-out motion-reduce:transition-none"
      leave-from-class="opacity-100 [clip-path:inset(0_0_0_0)]"
      leave-to-class="opacity-0 [clip-path:inset(100%_0_0_0)]"
    >
      <ConsoleDrawer
        v-if="drawer.isOpen"
        ref="consoleDrawer"
        @popout="popOut"
        @request-main-focus="emit('requestMainFocus')"
      />
    </Transition>
    <Transition
      enter-active-class="transition-[opacity,translate] duration-300 ease-cladd-settle"
      leave-active-class="transition-[opacity,translate] duration-200 ease-in-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-to-class="translate-y-2 opacity-0"
    >
      <TimelineStrip v-if="stripShown" />
    </Transition>
  </div>
</template>
