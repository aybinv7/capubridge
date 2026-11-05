<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-vue-next";
import { Chip, Dialog, Spinner } from "@capubridge/cladd";
import JsonViewer from "@/shared/components/data/JsonViewer.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import FileGlyph from "./FileGlyph.vue";
import { formatFileEntrySize, type DeviceFileViewerContent } from "./fileKinds";
import type { DeviceFileListEntry } from "./filePaths";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  entry: DeviceFileListEntry | null;
  content: DeviceFileViewerContent | null;
  loading: boolean;
  error: string;
  galleryIndex: number;
  galleryTotal: number;
}>();

const emit = defineEmits<{
  openOnComputer: [entry: DeviceFileListEntry];
  download: [entry: DeviceFileListEntry];
  step: [direction: "prev" | "next"];
}>();

const KIND_LABELS = { image: "Image", video: "Video", json: "JSON", text: "Text" } as const;

const canStep = computed(() => props.galleryTotal > 1 && props.galleryIndex >= 0);
const kindLabel = computed(() => (props.content ? KIND_LABELS[props.content.kind] : null));

function onKeydown(event: KeyboardEvent) {
  if (!canStep.value) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    emit("step", event.key === "ArrowLeft" ? "prev" : "next");
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :aria-label="props.entry ? `Preview of ${props.entry.name}` : 'File preview'"
    class="h-[calc(100vh-64px)] w-[calc(100vw-64px)] max-w-none"
    content-class-name="flex h-full flex-col gap-0 p-0"
    @keydown="onKeydown"
  >
    <header class="flex shrink-0 items-center gap-2 border-b border-border-subtle py-2 pr-2 pl-4">
      <FileGlyph v-if="props.entry" :entry="props.entry" />
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="flex min-w-0 items-center gap-2">
          <span class="truncate text-sm font-medium text-foreground">
            {{ props.entry?.name ?? "File preview" }}
          </span>
          <Chip v-if="kindLabel" size="xs">{{ kindLabel }}</Chip>
          <span v-if="props.entry" class="shrink-0 font-mono text-2xs text-muted-foreground">
            {{ formatFileEntrySize(props.entry) }}
          </span>
        </span>
        <span
          v-if="props.entry"
          class="truncate font-mono text-2xs text-[var(--fg-subtle)]"
          :title="props.entry.path"
        >
          {{ props.entry.path }}
        </span>
      </div>
      <template v-if="canStep">
        <IconAction label="Previous" keys="ArrowLeft" @click="emit('step', 'prev')">
          <ChevronLeft :stroke-width="1.8" />
        </IconAction>
        <span class="font-mono text-2xs text-muted-foreground tabular-nums">
          {{ props.galleryIndex + 1 }} / {{ props.galleryTotal }}
        </span>
        <IconAction label="Next" keys="ArrowRight" @click="emit('step', 'next')">
          <ChevronRight :stroke-width="1.8" />
        </IconAction>
        <span class="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />
      </template>
      <template v-if="props.entry">
        <IconAction label="Open on this computer" @click="emit('openOnComputer', props.entry)">
          <ExternalLink :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Download" @click="emit('download', props.entry)">
          <Download :stroke-width="1.8" />
        </IconAction>
      </template>
      <IconAction label="Close" keys="Escape" @click="open = false">
        <X :stroke-width="1.8" />
      </IconAction>
    </header>

    <div class="min-h-0 flex-1 overflow-hidden bg-surface-cut">
      <div
        v-if="props.loading"
        class="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground"
      >
        <Spinner size="xs" />
        Reading the file from the phone
      </div>
      <div
        v-else-if="props.error"
        class="flex h-full flex-col items-center justify-center gap-1 px-8 text-center"
        role="alert"
      >
        <p class="text-sm text-foreground">The file could not be read.</p>
        <p class="max-w-lg font-mono text-2xs break-all text-error">{{ props.error }}</p>
      </div>
      <template v-else-if="props.content">
        <div
          v-if="props.content.kind === 'image'"
          class="flex h-full items-center justify-center p-6"
        >
          <img
            :src="props.content.dataUrl"
            :alt="props.content.entry.name"
            class="max-h-full max-w-full object-contain"
          />
        </div>
        <div
          v-else-if="props.content.kind === 'video'"
          class="flex h-full items-center justify-center p-6"
        >
          <video :src="props.content.dataUrl" controls class="max-h-full max-w-full" />
        </div>
        <div v-else-if="props.content.kind === 'json'" class="h-full overflow-hidden">
          <JsonViewer :value="props.content.jsonValue" />
        </div>
        <pre
          v-else
          class="h-full overflow-auto p-5 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-foreground"
          >{{ props.content.text }}</pre
        >
      </template>
    </div>
  </Dialog>
</template>
