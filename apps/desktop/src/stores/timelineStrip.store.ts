import { computed, ref } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";
import {
  DEFAULT_STRIP_WINDOW,
  STRIP_WINDOW_MS,
  isStripWindow,
  type StripWindow,
} from "@/lib/timeline/stripWindows";
import { TIMELINE_LANES, type TimelineLane } from "@/types/timeline.types";

const LS_STRIP = "capubridge:timeline-strip";

interface PersistedStrip {
  hidden: boolean;
  window: StripWindow;
  mutedLanes: TimelineLane[];
}

const DEFAULTS: PersistedStrip = { hidden: false, window: DEFAULT_STRIP_WINDOW, mutedLanes: [] };

function isLane(value: unknown): value is TimelineLane {
  return typeof value === "string" && (TIMELINE_LANES as readonly string[]).includes(value);
}

function isPersistedStrip(value: unknown): value is PersistedStrip {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.hidden === "boolean" &&
    isStripWindow(candidate.window) &&
    Array.isArray(candidate.mutedLanes) &&
    candidate.mutedLanes.every(isLane)
  );
}

/**
 * The global strip's view choices: whether it is hidden, which window it shows, and which lanes
 * are muted. A muted lane is never removed: it is drawn dim and leaves the counts and the
 * moment preview. Every choice persists.
 */
export const useTimelineStripStore = defineStore("timelineStrip", () => {
  const saved = readPersisted<PersistedStrip>(LS_STRIP, DEFAULTS, isPersistedStrip);
  const hidden = ref(saved.hidden);
  const span = ref<StripWindow>(saved.window);
  const mutedLanes = ref<TimelineLane[]>([...new Set(saved.mutedLanes)]);

  const windowMs = computed(() => STRIP_WINDOW_MS[span.value]);
  const mutedSet = computed(() => new Set(mutedLanes.value));

  function persist() {
    writePersisted(LS_STRIP, {
      hidden: hidden.value,
      window: span.value,
      mutedLanes: mutedLanes.value,
    } satisfies PersistedStrip);
  }

  function isLaneMuted(lane: TimelineLane): boolean {
    return mutedSet.value.has(lane);
  }

  function toggleLane(lane: TimelineLane) {
    mutedLanes.value = isLaneMuted(lane)
      ? mutedLanes.value.filter((entry) => entry !== lane)
      : TIMELINE_LANES.filter((entry) => entry === lane || mutedSet.value.has(entry));
    persist();
  }

  function setWindow(next: StripWindow) {
    if (span.value === next) return;
    span.value = next;
    persist();
  }

  function setHidden(next: boolean) {
    if (hidden.value === next) return;
    hidden.value = next;
    persist();
  }

  function toggleHidden() {
    setHidden(!hidden.value);
  }

  return {
    hidden,
    span,
    windowMs,
    mutedLanes,
    isLaneMuted,
    toggleLane,
    setWindow,
    setHidden,
    toggleHidden,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTimelineStripStore, import.meta.hot));
}
