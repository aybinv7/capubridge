<script setup lang="ts">
import { computed } from "vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useDrawerStore } from "@/stores/drawer.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import { useBindingHint } from "@/composables/useBindingHint";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { shellIcons } from "@/shared/icons/shell-icons";

const context = useActiveContextStore();
const drawer = useDrawerStore();
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
  drawer.isOpen ? shellIcons.panelBottom.filled : shellIcons.panelBottom.regular,
);

const unread = computed(() => (drawer.isOpen ? 0 : drawer.unreadTotal));
const consoleLabel = computed(() => (drawer.isOpen ? "Hide the console" : "Show the console"));
const consoleHint = computed(() =>
  unread.value > 0
    ? `${unread.value.toLocaleString()} new ${unread.value === 1 ? "warning or error" : "warnings or errors"} since you last looked`
    : "Logs and Console, joined to the timeline",
);
const timelineShown = computed(() => !timelineStrip.hidden);
const timelineIcon = computed(() =>
  timelineShown.value ? shellIcons.timeline.filled : shellIcons.timeline.regular,
);
const timelineLabel = computed(() =>
  timelineShown.value ? "Hide the timeline" : "Show the timeline",
);
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
      :pressed="drawer.isOpen"
      @click="drawer.toggle()"
    >
      <component :is="consoleIcon" />
    </IconAction>
    <span
      v-if="unread > 0"
      class="-ml-1.5 rounded-full bg-surface-2 px-1.5 font-mono text-2xs leading-4 text-foreground tabular-nums shadow-bevel"
      aria-hidden="true"
    >
      {{ unread > 999 ? "999+" : unread }}
    </span>

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
