<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FolderOpen,
  Lock,
  TableProperties,
  Trash2,
  X,
} from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import ViewerBody from "@/shared/file-viewer/ViewerBody.vue";
import ViewerStatus from "@/shared/file-viewer/ViewerStatus.vue";
import type { ViewerActions } from "@/shared/file-viewer/viewerActions";
import type { ViewerState } from "@/shared/file-viewer/viewerContent";
import { useMinuteClock } from "@/shared/composables/useMinuteClock";
import { formatExactTime, formatStampWords } from "@/shared/format/dates";
import { formatBytes } from "@/shared/format/numbers";
import type { OpfsRow } from "./opfsModel";

/**
 * One file or folder beside the list: what it is, a preview through the shared file viewer, and
 * its actions. A file the app holds open is not read; a folder offers to open it.
 */
const props = defineProps<{
  row: OpfsRow;
  state: ViewerState;
  position: string | null;
  /** Why the phone cannot answer now (reads wait, deletes are held), or `null`. */
  away: string | null;
  blockedReason: string | null;
  busy: boolean;
  saving: boolean;
  canPrev: boolean;
  canNext: boolean;
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
  close: [];
  delete: [];
  download: [];
  retry: [];
  openDatabase: [];
  openFolder: [];
}>();

const findSignal = ref(0);

const isFolder = computed(() => props.row.kind === "directory");
const clock = useMinuteClock();
const exactTime = computed(() =>
  props.row.lastModified === null ? undefined : formatExactTime(props.row.lastModified),
);
const subtitle = computed(() =>
  [
    props.position,
    props.row.kindLabel,
    isFolder.value || props.row.size === null ? null : formatBytes(props.row.size),
    props.row.lastModified === null ? null : formatStampWords(props.row.lastModified, clock.value),
  ]
    .filter(Boolean)
    .join(" · "),
);
const downloadReason = computed(() => {
  if (props.row.locked) return "The app has this file open, so it cannot be read now.";
  return props.away;
});
const actions = computed<ViewerActions>(() => ({
  openOnComputer: false,
  chooseApp: false,
  download: downloadReason.value === null,
  database: { canOpen: true },
}));
const waiting = computed(() => props.away !== null && props.state.status === "loading");

function onKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.altKey) return;
  if (event.key.toLowerCase() === "f" && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    findSignal.value += 1;
  } else if (event.key === "ArrowUp" && props.canPrev) {
    event.preventDefault();
    emit("prev");
  } else if (event.key === "ArrowDown" && props.canNext) {
    event.preventDefault();
    emit("next");
  }
}
</script>

<template>
  <section
    data-record-pane
    class="flex h-full min-h-0 flex-col"
    :aria-label="`${row.kindLabel} ${row.name}`"
    @keydown="onKeydown"
  >
    <header class="flex shrink-0 items-start gap-2 border-b border-border-subtle py-2 pr-2 pl-3">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <p class="truncate font-mono text-xs font-medium text-foreground select-text">
          {{ row.name }}
        </p>
        <HintTooltip :text="`/${row.path}`">
          <p class="truncate font-mono text-2xs text-[var(--fg-subtle)] select-text">
            /{{ row.path }}
          </p>
        </HintTooltip>
        <span
          v-if="subtitle"
          class="text-2xs text-[var(--fg-subtle)] tabular-nums"
          :title="exactTime"
        >
          {{ subtitle }}
        </span>
      </div>
      <IconAction
        label="Previous item"
        keys="mod+arrowup"
        size="sm"
        :disabled="!canPrev"
        @click="emit('prev')"
      >
        <ChevronUp :stroke-width="1.8" />
      </IconAction>
      <IconAction
        label="Next item"
        keys="mod+arrowdown"
        size="sm"
        :disabled="!canNext"
        @click="emit('next')"
      >
        <ChevronDown :stroke-width="1.8" />
      </IconAction>
      <CopyAction :value="`/${row.path}`" label="Copy the path" />
      <IconAction label="Close" keys="Escape" size="sm" @click="emit('close')">
        <X :stroke-width="1.8" />
      </IconAction>
    </header>

    <div v-if="isFolder || row.locked || waiting" class="min-h-0 flex-1">
      <ViewerStatus
        v-if="isFolder"
        title="A folder"
        detail="Open it to see what it holds. Deleting it deletes everything inside."
      >
        <template #icon><FolderOpen :size="18" :stroke-width="1.6" /></template>
        <Button size="sm" variant="solid-fill" color="brand" @click="emit('openFolder')">
          Open the folder
        </Button>
      </ViewerStatus>
      <ViewerStatus
        v-else-if="row.locked"
        title="The app has this file open"
        detail="A SQLite database the app is using keeps its file locked, so it cannot be read while the app runs. Close the app, or the database in it, then read the folder again."
        :raw="row.unreadable ?? undefined"
      >
        <template #icon><Lock :size="18" :stroke-width="1.6" /></template>
      </ViewerStatus>
      <ViewerStatus v-else-if="waiting" title="Waiting for the app" :detail="away ?? undefined" />
    </div>
    <ViewerBody
      v-else
      :name="row.name"
      :path="row.path"
      :state="state"
      :find-signal="findSignal"
      :actions="actions"
      @retry="emit('retry')"
      @download="emit('download')"
      @open-database="emit('openDatabase')"
    />

    <footer class="flex shrink-0 items-center gap-1 border-t border-border-subtle px-3 py-2">
      <HintTooltip :text="blockedReason">
        <Button
          size="sm"
          variant="transparent"
          content-class-name="gap-1.5"
          :disabled="blockedReason !== null"
          :loading="busy"
          @click="emit('delete')"
        >
          <Trash2 :size="12" aria-hidden="true" />
          {{ isFolder ? "Delete folder…" : "Delete file…" }}
        </Button>
      </HintTooltip>
      <span class="flex-1" />
      <Button
        v-if="row.role === 'pool-slot'"
        size="sm"
        variant="transparent"
        content-class-name="gap-1.5"
        @click="emit('openDatabase')"
      >
        <TableProperties :size="12" aria-hidden="true" />
        Open in Data › SQLite
      </Button>
      <HintTooltip v-if="!isFolder" :text="downloadReason">
        <Button
          size="sm"
          variant="transparent"
          content-class-name="gap-1.5"
          :disabled="downloadReason !== null"
          :loading="saving"
          @click="emit('download')"
        >
          <Download :size="12" aria-hidden="true" />
          Download…
        </Button>
      </HintTooltip>
    </footer>
  </section>
</template>
