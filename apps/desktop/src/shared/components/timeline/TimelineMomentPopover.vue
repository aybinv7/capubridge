<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button, Popover } from "@capubridge/cladd";
import { useTimelineStore } from "@/stores/timeline.store";
import {
  hasReveal,
  isMarkerKept,
  retentionOf,
  revealMarker,
} from "@/shared/timeline/revealRegistry";
import { openRecordingAt } from "@/shared/timeline/openRecordingAt";
import type { TimelineLane, TimelineMarker, TimelineOverlay } from "@/types/timeline.types";
import { buildMoment, type MomentItem } from "./momentItems";
import { formatClock } from "./stripFormat";
import TimelineMomentList from "./TimelineMomentList.vue";

/**
 * The preview of one second, next to the strip, which highlights that second while it is open:
 * up to 20 items in time order with "Go to". Items read live from the reveal registry, so
 * aged-out ones say so.
 */
const props = defineProps<{
  second: number | null;
  anchorRect: DOMRectReadOnly | undefined;
  muted: ReadonlySet<TimelineLane>;
  position: "top" | "bottom";
}>();

const open = defineModel<boolean>("open", { required: true });

const router = useRouter();
const timeline = useTimelineStore();
const markers = shallowRef<TimelineMarker[]>([]);
const busyKey = shallowRef<string | null>(null);

watch(
  () => [open.value, props.second] as const,
  ([isOpen, second]) => {
    markers.value =
      isOpen && second !== null ? timeline.ring.inRange(second * 1000, second * 1000 + 1000) : [];
  },
  { immediate: true },
);

const moment = computed(() =>
  buildMoment(markers.value, {
    isMuted: (lane) => props.muted.has(lane),
    hasReveal,
    isKept: isMarkerKept,
    retentionOf,
  }),
);

const recording = computed<TimelineOverlay | null>(() => {
  const second = props.second;
  if (second === null) return null;
  const from = second * 1000;
  return (
    timeline.overlays.find(
      (overlay) =>
        overlay.kind === "recording" &&
        overlay.start < from + 1000 &&
        (overlay.end === null || overlay.end >= from),
    ) ?? null
  );
});

const title = computed(() => (props.second === null ? "" : formatClock(props.second * 1000)));

async function goTo(item: MomentItem) {
  busyKey.value = item.key;
  try {
    const outcome = await revealMarker(item.ref);
    if (outcome === "revealed") {
      open.value = false;
      return;
    }
    toast.info(outcome === "aged-out" ? "No longer kept" : "This section cannot show it yet", {
      description: retentionOf(item.ref.kind) ?? undefined,
    });
  } catch (error) {
    toast.error("Could not open it", { description: String(error) });
  } finally {
    busyKey.value = null;
  }
}

async function openRecording() {
  const overlay = recording.value;
  const second = props.second;
  if (!overlay?.ref || second === null) return;
  try {
    const opened = await openRecordingAt(router, overlay.ref.id, second * 1000);
    if (opened) open.value = false;
    else toast.info("This recording is not saved yet");
  } catch (error) {
    toast.error("Could not open the recording", { description: String(error) });
  }
}
</script>

<template>
  <Popover
    v-model:open="open"
    :anchor-rect="props.anchorRect"
    :position="props.position"
    :offset="8"
    class="w-[min(40rem,calc(100vw-2rem))]"
    content-class-name="flex w-full flex-col gap-2 p-2.5"
    :aria-label="`What happened at ${title}`"
  >
    <header class="flex items-baseline justify-between gap-2 px-1">
      <span class="font-mono text-xs text-foreground tabular-nums">{{ title }}</span>
      <span class="text-2xs text-[var(--fg-subtle)]">
        {{ moment.total === 0 ? "Nothing in this second" : `${moment.total} in this second` }}
      </span>
    </header>

    <TimelineMomentList
      v-if="moment.items.length"
      :items="moment.items"
      :more="moment.total - moment.items.length"
      :busy-key="busyKey"
      @goto="goTo"
    />

    <div
      v-if="recording"
      class="flex items-center gap-2 border-t border-border-subtle px-1 pt-2 text-2xs text-muted-foreground"
    >
      <span class="size-1.5 shrink-0 rounded-[1px] bg-signal-rec" aria-hidden="true" />
      <span class="flex-1">{{
        recording.end === null ? "Being recorded now" : "Inside a recording"
      }}</span>
      <Button size="2xs" variant="solid" :disabled="recording.end === null" @click="openRecording">
        Open the recording at this moment
      </Button>
    </div>
  </Popover>
</template>
