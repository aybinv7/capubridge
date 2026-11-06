<script setup lang="ts">
import { computed } from "vue";
import { Eye } from "lucide-vue-next";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useBindingHint } from "@/composables/useBindingHint";
import { STRIP_WINDOWS } from "@/lib/timeline/stripWindows";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import { formatClock } from "./stripFormat";

const props = defineProps<{ now: number }>();

const strip = useTimelineStripStore();
const { keysOf } = useBindingHint();

const clockText = computed(() => formatClock(props.now));
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
