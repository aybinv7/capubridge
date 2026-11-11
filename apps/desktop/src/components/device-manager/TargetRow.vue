<script setup lang="ts">
import { computed } from "vue";
import { Bug, ExternalLink, Unlink } from "lucide-vue-next";
import type { CDPTarget } from "@/types/cdp.types";
import type { LinkPresentation } from "@/lib/gates/link";
import { LINK_TONE_TEXT } from "@/components/gate/linkTone";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { describeTargetLines, isUnansweredSocket, targetKindHint } from "./targetGroups";
import PageIcon from "./PageIcon.vue";

const props = defineProps<{
  target: CDPTarget;
  active: boolean;
  link: LinkPresentation | null;
  icon?: string | null;
  appLabel?: string | null;
}>();

const emit = defineEmits<{ select: []; inspect: []; openApp: []; detach: [] }>();

const unanswered = computed(() => isUnansweredSocket(props.target));
const lines = computed(() => describeTargetLines(props.target, props.appLabel ?? null));
const kind = computed(() => targetKindHint(props.target));
const openLabel = computed(() => `Open ${props.appLabel || "the app"} on the phone`);
</script>

<template>
  <div
    v-if="unanswered"
    class="flex items-center justify-between gap-2 rounded-control py-1.5 pr-1.5 pl-3"
  >
    <slot name="app-icon" />
    <IconAction
      v-if="props.target.packageName"
      :label="openLabel"
      hint="No page is open in it yet"
      size="sm"
      position="top"
      @click="emit('openApp')"
    >
      <ExternalLink :stroke-width="1.8" />
    </IconAction>
  </div>

  <div
    v-else
    class="group/target relative flex items-center gap-1 rounded-control pr-1.5 transition-colors duration-120"
    :class="props.active ? 'bg-cladd-surface-next shadow-bevel' : 'hover:bg-cladd-surface-hover'"
  >
    <button
      type="button"
      data-roving-item
      :data-current="props.active || undefined"
      :aria-current="props.active ? 'true' : undefined"
      class="flex min-w-0 flex-1 items-center gap-2.5 rounded-control py-2 pr-1 pl-3 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
      :title="props.active ? props.link?.description : 'Attach DevTools to this page'"
      @click="emit('select')"
    >
      <PageIcon v-if="props.icon !== undefined" :icon="props.icon" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm text-foreground">{{ lines.title }}</span>
        <span v-if="lines.detail" class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
          {{ lines.detail }}
        </span>
      </span>
      <span
        v-if="props.active && props.link"
        class="shrink-0 text-xs"
        :class="props.link.tone === 'live' ? 'text-signal-live' : LINK_TONE_TEXT[props.link.tone]"
      >
        {{ props.link.label }}
      </span>
      <span v-else-if="kind" class="shrink-0 text-2xs text-[var(--fg-subtle)]">
        {{ kind }}
      </span>
    </button>

    <div
      class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-120 group-focus-within/target:opacity-100 group-hover/target:opacity-100"
      :class="props.active && 'opacity-100'"
    >
      <IconAction
        label="Open in Chrome DevTools"
        hint="The full DevTools of this page, docked"
        size="sm"
        position="top"
        @click="emit('inspect')"
      >
        <Bug :stroke-width="1.8" />
      </IconAction>
      <IconAction
        v-if="props.active"
        label="Detach DevTools"
        hint="Keeps the app running; closes this session"
        size="sm"
        position="top"
        @click="emit('detach')"
      >
        <Unlink :stroke-width="1.8" />
      </IconAction>
    </div>
  </div>
</template>
