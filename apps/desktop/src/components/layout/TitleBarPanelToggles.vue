<script setup lang="ts">
import { computed } from "vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useDockStore } from "@/stores/dock.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import { useBindingHint } from "@/composables/useBindingHint";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { shellIcons } from "@/shared/icons/shell-icons";

const context = useActiveContextStore();
const dockStore = useDockStore();
const mirrorStore = useMirrorStore();
const timelineStrip = useTimelineStripStore();
const { keysOf } = useBindingHint();

const mirrorEnabled = computed(
  () => context.device?.status === "online" || context.target !== null,
);

const screenLabel = computed(() => (mirrorStore.isOpen ? "Hide the screen" : "Show the screen"));

const screenHint = computed(() =>
  mirrorEnabled.value
    ? "The device screen, beside your work"
    : "Connect a device or choose a WebView to show its screen",
);

const screenIcon = computed(() => {
  const pair = mirrorStore.side === "left" ? shellIcons.panelLeft : shellIcons.panelRight;
  return mirrorStore.isOpen ? pair.filled : pair.regular;
});
const consoleIcon = computed(() =>
  dockStore.isOpen ? shellIcons.panelBottom.filled : shellIcons.panelBottom.regular,
);

const consoleLabel = computed(() => (dockStore.isOpen ? "Hide the console" : "Show the console"));
const consoleHint = computed(() =>
  dockStore.hasUnread && !dockStore.isOpen ? "New messages since you last looked" : undefined,
);
const timelineShown = computed(() => !timelineStrip.hidden);
const timelineIcon = computed(() =>
  timelineShown.value ? shellIcons.timeline.filled : shellIcons.timeline.regular,
);
const timelineLabel = computed(() =>
  timelineShown.value ? "Hide the timeline" : "Show the timeline",
);
const showUnread = computed(() => dockStore.hasUnread && !dockStore.isOpen);
</script>

<template>
  <div class="flex items-center gap-1">
    <IconAction
      :label="timelineLabel"
      hint="Every second of the session, at the foot of the window"
      :keys="keysOf('view.toggle-timeline') ?? undefined"
      toggle
      :pressed="timelineShown"
      @click="timelineStrip.toggleHidden()"
    >
      <component :is="timelineIcon" />
    </IconAction>

    <IconAction
      :label="consoleLabel"
      :hint="consoleHint"
      :keys="keysOf('view.toggle-dock') ?? undefined"
      toggle
      :pressed="dockStore.isOpen"
      class="relative"
      @click="dockStore.toggleDock()"
    >
      <component :is="consoleIcon" />
      <span
        v-if="showUnread"
        class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-signal-select"
        aria-hidden="true"
      />
    </IconAction>

    <IconAction
      :label="screenLabel"
      :hint="screenHint"
      :keys="keysOf('view.toggle-device-pane') ?? undefined"
      toggle
      :pressed="mirrorStore.isOpen"
      :disabled="!mirrorEnabled"
      @click="mirrorStore.toggle()"
    >
      <component :is="screenIcon" />
    </IconAction>
  </div>
</template>
