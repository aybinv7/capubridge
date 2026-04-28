<script setup lang="ts">
import { computed } from "vue";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import JsonViewer from "@/modules/storage/localstorage/JsonViewer.vue";
import {
  fileIcon,
  fileIconClass,
  formatFileEntrySize,
  type DeviceFileListEntry,
  type DeviceFileViewerContent,
} from "./deviceFiles.utils";

const props = defineProps<{
  open: boolean;
  entry: DeviceFileListEntry | null;
  content: DeviceFileViewerContent | null;
  loading: boolean;
  error: string;
  galleryIndex: number;
  galleryTotal: number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  openExternal: [entry: DeviceFileListEntry];
  download: [entry: DeviceFileListEntry];
  navigate: [direction: "prev" | "next"];
}>();

const canNavigate = computed(() => props.galleryTotal > 1);
const viewerLabel = computed(() => {
  const kind = props.content?.kind;
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  if (kind === "json") return "JSON";
  if (kind === "text") return "Text";
  return "Preview";
});

function openExternal() {
  if (props.entry) emit("openExternal", props.entry);
}

function download() {
  if (props.entry) emit("download", props.entry);
}

function navigate(direction: "prev" | "next") {
  if (canNavigate.value) emit("navigate", direction);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    navigate("prev");
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    navigate("next");
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="h-[100vh] w-[100vw] max-w-[100vw] overflow-hidden rounded-none border-0 bg-black p-0 text-white shadow-none"
      @keydown="handleKeydown"
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-5 py-4"
      >
        <div class="pointer-events-auto flex min-w-0 items-center gap-3 pr-10">
          <component
            v-if="entry"
            :is="fileIcon(entry)"
            class="h-4 w-4 shrink-0"
            :class="fileIconClass(entry)"
          />
          <DialogTitle class="min-w-0 truncate text-base">
            {{ entry?.name ?? "File preview" }}
          </DialogTitle>
          <span
            class="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-mono text-muted-foreground/60"
          >
            {{ viewerLabel }}
          </span>
          <span v-if="entry" class="shrink-0 text-xs text-muted-foreground/45">
            {{ formatFileEntrySize(entry) }}
          </span>
          <span
            v-if="canNavigate"
            class="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white/60"
          >
            {{ galleryIndex + 1 }} / {{ galleryTotal }}
          </span>
          <Button
            v-if="entry"
            variant="ghost"
            size="sm"
            class="ml-auto h-7 gap-1.5 px-2 text-xs"
            @click="openExternal()"
          >
            <ExternalLink class="h-3.5 w-3.5" />External
          </Button>
          <Button
            v-if="entry"
            variant="ghost"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs"
            @click="download()"
          >
            <Download class="h-3.5 w-3.5" />Download
          </Button>
        </div>
        <div
          v-if="entry"
          class="pointer-events-auto mt-1 truncate pr-10 text-[11px] text-white/40"
          :title="entry.path"
        >
          {{ entry.path }}
        </div>
      </div>

      <button
        v-if="canNavigate"
        class="absolute left-5 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/80 backdrop-blur transition hover:bg-white/12 hover:text-white"
        @click="navigate('prev')"
      >
        <ChevronLeft class="h-6 w-6" />
      </button>
      <button
        v-if="canNavigate"
        class="absolute right-5 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/80 backdrop-blur transition hover:bg-white/12 hover:text-white"
        @click="navigate('next')"
      >
        <ChevronRight class="h-6 w-6" />
      </button>

      <div class="h-full w-full overflow-hidden bg-black">
        <div
          v-if="loading"
          class="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground/60"
        >
          <Loader2 class="h-4 w-4 animate-spin" />Loading preview
        </div>
        <div
          v-else-if="error"
          class="flex h-full items-center justify-center px-8 text-sm text-error/80"
        >
          <AlertCircle class="mr-2 h-5 w-5 shrink-0" />{{ error }}
        </div>
        <template v-else-if="content">
          <div v-if="content.kind === 'image'" class="flex h-full items-center justify-center p-4">
            <img
              :src="content.dataUrl"
              :alt="content.entry.name"
              class="max-h-full max-w-full object-contain"
            />
          </div>
          <div
            v-else-if="content.kind === 'video'"
            class="flex h-full items-center justify-center p-4"
          >
            <video :src="content.dataUrl" controls class="max-h-full max-w-full" />
          </div>
          <div v-else-if="content.kind === 'json'" class="h-full overflow-hidden bg-[#101012]">
            <JsonViewer :value="content.jsonValue" />
          </div>
          <pre
            v-else
            class="h-full overflow-auto whitespace-pre-wrap break-words bg-background p-5 pt-24 font-mono text-xs leading-5 text-foreground/85"
            >{{ content.text }}</pre
          >
        </template>
      </div>

      <div
        v-if="canNavigate"
        class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-black/75 via-black/25 to-transparent px-5 py-4"
      >
        <div
          class="pointer-events-auto flex max-w-[70vw] items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/55 backdrop-blur"
        >
          <span class="font-mono text-white/80">Gallery</span>
          <span class="h-3 w-px bg-white/15" />
          <span class="truncate">{{ entry?.name }}</span>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
