<script setup lang="ts">
import { computed } from "vue";
import { AppWindow, ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import FileGlyph from "../FileGlyph.vue";
import { formatSize } from "../fileKinds";
import { parentPath, type DeviceFileListEntry } from "../filePaths";
import type { GalleryPosition } from "./gallery";
import { isKnownSize } from "./readPlan";
import type { ViewerState } from "./viewerContent";
import { kindFromName, kindWord } from "./viewerKinds";

const props = defineProps<{
  entry: DeviceFileListEntry;
  state: ViewerState;
  position: GalleryPosition;
}>();

const emit = defineEmits<{
  step: [direction: "prev" | "next"];
  download: [];
  openOnComputer: [];
  chooseApp: [];
  close: [];
}>();

const canStep = computed(() => props.position.total > 1 && props.position.index >= 0);
const folder = computed(() => parentPath(props.entry.path));

const kindLabel = computed(() => {
  const state = props.state;
  if (state.status === "ready") {
    const content = state.content;
    return kindWord(content.kind, content.kind === "text" ? content.language : "plain");
  }
  if (state.status === "too-large") return kindWord(state.kind);
  const guess = kindFromName(props.entry.name);
  return guess === "unknown" ? "File" : kindWord(guess);
});

const sizeLabel = computed(() => {
  if (isKnownSize(props.entry.size)) return formatSize(props.entry.size, false);
  const state = props.state;
  if (state.status === "ready" && state.content.size !== null) {
    return formatSize(state.content.size, false);
  }
  return null;
});
</script>

<template>
  <header class="flex shrink-0 items-center gap-3 border-b border-border-subtle py-2 pr-2 pl-4">
    <span
      class="grid size-8 shrink-0 place-items-center rounded-control bg-surface-cut shadow-cut"
      aria-hidden="true"
    >
      <FileGlyph :entry="props.entry" :size="16" />
    </span>
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="flex min-w-0 items-baseline gap-2">
        <h2 class="truncate text-sm font-medium text-foreground" :title="props.entry.name">
          {{ props.entry.name }}
        </h2>
        <span class="shrink-0 text-xs text-muted-foreground">
          {{ kindLabel
          }}<template v-if="sizeLabel">
            · <span class="font-mono text-2xs tabular-nums">{{ sizeLabel }}</span></template
          >
        </span>
      </span>
      <span class="flex min-w-0 items-center gap-0.5">
        <span class="truncate font-mono text-2xs text-[var(--fg-subtle)]" :title="props.entry.path">
          {{ folder }}
        </span>
        <CopyAction :value="props.entry.path" label="Copy path" class="shrink-0" />
      </span>
    </div>

    <nav
      v-if="canStep"
      class="flex shrink-0 items-center gap-0.5"
      aria-label="Files in this folder"
    >
      <IconAction label="Previous file" keys="left" @click="emit('step', 'prev')">
        <ChevronLeft :stroke-width="1.8" />
      </IconAction>
      <span class="min-w-14 text-center font-mono text-2xs text-muted-foreground tabular-nums">
        {{ props.position.index + 1 }} of {{ props.position.total }}
      </span>
      <IconAction label="Next file" keys="right" @click="emit('step', 'next')">
        <ChevronRight :stroke-width="1.8" />
      </IconAction>
    </nav>
    <span v-if="canStep" class="h-4 w-px shrink-0 bg-border-subtle" aria-hidden="true" />

    <div class="flex shrink-0 items-center gap-0.5">
      <IconAction label="Download" hint="Save a copy on this computer" @click="emit('download')">
        <Download :stroke-width="1.8" />
      </IconAction>
      <IconAction
        label="Open on this computer"
        hint="With the default app for this kind of file"
        @click="emit('openOnComputer')"
      >
        <ExternalLink :stroke-width="1.8" />
      </IconAction>
      <IconAction label="Choose an app on this computer" @click="emit('chooseApp')">
        <AppWindow :stroke-width="1.8" />
      </IconAction>
    </div>
    <span class="h-4 w-px shrink-0 bg-border-subtle" aria-hidden="true" />
    <IconAction label="Close" keys="esc" @click="emit('close')">
      <X :stroke-width="1.8" />
    </IconAction>
  </header>
</template>
