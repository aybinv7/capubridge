<script setup lang="ts">
import { computed } from "vue";
import { Eye } from "lucide-vue-next";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useBindingHint } from "@/composables/useBindingHint";
import { STRIP_WINDOWS } from "@/lib/timeline/stripWindows";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import { useDrawerStore } from "@/stores/drawer.store";
import { shellIcons } from "@/shared/icons/shell-icons";
import { formatClock } from "./stripFormat";

const props = defineProps<{ now: number }>();

const strip = useTimelineStripStore();
const drawer = useDrawerStore();
const { keysOf } = useBindingHint();

const clockText = computed(() => formatClock(props.now));
const drawerIcon = computed(() =>
  drawer.isOpen ? shellIcons.panelBottom.filled : shellIcons.panelBottom.regular,
);
</script>

<template>
  <div class="flex h-7 shrink-0 items-center gap-2 pr-1 pl-2">
    <Segmented size="2xs" active-color="neutral" aria-label="How far back the timeline shows">
      <SegmentedButton
        v-for="option in STRIP_WINDOWS"
        :key="option"
        :active="strip.span === option"
        class="min-w-8 font-mono tabular-nums"
        @click="strip.setWindow(option)"
      >
        {{ option }}
      </SegmentedButton>
    </Segmented>
    <time
      class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
      :datetime="new Date(props.now).toISOString()"
    >
      {{ clockText }}
    </time>
    <IconAction
      :label="drawer.isOpen ? 'Hide the console' : 'Show the console'"
      hint="Logs and Console, grown out of this strip"
      :keys="keysOf('view.toggle-dock') ?? undefined"
      size="sm"
      position="top"
      toggle
      :pressed="drawer.isOpen"
      @click="drawer.toggle()"
    >
      <component :is="drawerIcon" />
    </IconAction>
    <IconAction
      label="Hide the timeline"
      hint="Bring it back from the title bar"
      :keys="keysOf('view.toggle-timeline') ?? undefined"
      size="sm"
      position="top"
      @click="strip.setHidden(true)"
    >
      <Eye />
    </IconAction>
  </div>
</template>
