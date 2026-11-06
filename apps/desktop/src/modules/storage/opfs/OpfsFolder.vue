<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { ArrowUp, RefreshCw, Trash2 } from "lucide-vue-next";
import { Button, Segmented, SegmentedButton } from "@capubridge/cladd";
import {
  OPFSGoneError,
  detectStorageTechs,
  type OPFSEntry,
  type SahPoolDatabase,
} from "@capubridge/cdp-protocol";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import { useWhenRead } from "@/modules/storage/frame/useWhenRead";
import { useOpfsSnapshotCache } from "@/modules/storage/opfsSnapshotCache";
import { useOpenSqliteSource } from "@/modules/storage/useOpenSqliteSource";
import OpfsBreadcrumbs from "./OpfsBreadcrumbs.vue";
import OpfsPoolRows from "./OpfsPoolRows.vue";
import OpfsRows from "./OpfsRows.vue";
import OpfsTechHints from "./OpfsTechHints.vue";
import { toRows, type OpfsRow } from "./opfsModel";
import { folderLabel, hostOf, parentOf } from "./opfsSources";
import { useOpfsDownload } from "./useOpfsDownload";
import { errorText, useOpfsDomains, useOpfsFolder, useOpfsPool } from "./useOpfsQueries";
import { useOpfsWrites } from "./useOpfsWrites";

/**
 * One folder of the page's OPFS: its header, the way back to the root, what stored it, then its
 * entries (or the databases of a SAH-Pool). Mounted per folder, so its reads and deletes can
 * only ever reach that folder.
 */
const props = defineProps<{
  targetId: string;
  origin: string;
  path: string;
  /** Why the phone cannot answer now (the app is away from the screen), or `null`. */
  away: string | null;
  bringing: boolean;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
}>();

const emit = defineEmits<{
  count: [count: number | null];
  bringToFront: [];
  openFolder: [path: string];
  changed: [];
}>();

const rowsView = ref<InstanceType<typeof OpfsRows> | null>(null);
const view = ref<"files" | "pool">("files");
const targetId = computed(() => props.targetId);
const away = computed(() => props.away);
const paused = computed(() => away.value !== null);
const domains = useOpfsDomains(targetId);
const read = useOpfsFolder(
  targetId,
  computed(() => props.origin),
  computed(() => props.path),
  paused,
);
const snapshots = useOpfsSnapshotCache();
const { openOpfsDatabase } = useOpenSqliteSource();
const saver = useOpfsDownload();

const label = computed(() => folderLabel(props.path));
const gone = computed(() => read.error.value instanceof OPFSGoneError);
const error = computed(() => (gone.value ? null : errorText(read.error.value)));
const entries = computed(() => read.listing.value?.entries ?? []);
const hints = computed(() =>
  detectStorageTechs(
    entries.value.map(
      (entry): OPFSEntry => ({
        name: entry.name,
        kind: entry.kind,
        path: entry.path,
        ...(entry.size === null ? {} : { size: entry.size }),
        ...(entry.lastModified === null ? {} : { lastModified: entry.lastModified }),
      }),
    ),
  ).filter((hint) => hint.id !== "unknown"),
);
const rows = computed(() => toRows(entries.value, hints.value));
const total = computed(() => read.listing.value?.total ?? null);
const poolHere = computed(() =>
  hints.value.some((hint) => hint.id === "sqlite-wasm-sah-pool" && hint.inspectable),
);
const pool = useOpfsPool(
  targetId,
  computed(() => props.path),
  computed(() => poolHere.value && view.value === "pool"),
  paused,
);

watch(poolHere, (here) => {
  if (!here) view.value = "files";
});

function forget(removed: readonly OpfsRow[]) {
  for (const row of removed) {
    if (row.kind === "directory") snapshots.forgetUnder(props.targetId, row.path);
    else snapshots.forget(props.targetId, row.path);
  }
}

const writes = useOpfsWrites({
  origin: props.origin,
  folder: props.path ? label.value : "",
  domain: domains.files,
  pending: read.pending,
  away,
  confirm: props.confirm,
  forget,
  after: (removed) => {
    if (removed > 0) emit("changed");
    void read.refetch();
  },
});

const folderWrites = useOpfsWrites({
  origin: props.origin,
  folder: parentOf(props.path) ? folderLabel(parentOf(props.path)) : "",
  domain: domains.files,
  pending: read.pending,
  away,
  confirm: props.confirm,
  forget,
  after: (removed) => {
    emit("changed");
    if (removed > 0) emit("openFolder", parentOf(props.path));
  },
});

watch(
  () => (read.pending.value ? null : total.value),
  (count) => emit("count", count),
  { immediate: true },
);

const sizeText = computed(() => {
  if (read.pending.value || total.value === null) return null;
  return `${total.value.toLocaleString("en-US")} ${total.value === 1 ? "item" : "items"}`;
});

function selfRow(): OpfsRow {
  return {
    id: props.path,
    name: label.value,
    path: props.path,
    kind: "directory",
    role: "folder",
    kindLabel: "Folder",
    size: null,
    lastModified: null,
    locked: false,
    unreadable: null,
    search: "",
  };
}

const whenRead = useWhenRead(read.pending, read.error, () =>
  toast.info("Nothing was deleted", {
    description: `The folder “${label.value}” could not be read, so it was not deleted.`,
  }),
);

function deleteFolder() {
  if (!props.path) return;
  whenRead.run(() => void folderWrites.confirmAndRemove([selfRow()]));
}

function openDatabase(row: OpfsRow) {
  void openOpfsDatabase({
    path: row.path,
    label: row.name,
    stripSahPool: row.role === "pool-slot",
  });
}

function openPoolDatabase(database: SahPoolDatabase) {
  void openOpfsDatabase({
    path: database.opaquePath,
    label: database.logicalPath,
    stripSahPool: true,
  });
}

function refresh() {
  void read.refetch();
  if (view.value === "pool") void pool.refetch();
}

defineExpose({
  refresh,
  focusFind: () => rowsView.value?.focusFind(),
  deleteFolder,
});
</script>

<template>
  <DataCollectionHeader
    :title="path ? label : 'OPFS'"
    :identity="`Origin private file system of ${hostOf(origin)}`"
    provenance="live"
    :read-at="read.readAt.value"
    :busy="read.fetching.value && !read.loading.value"
  >
    <span v-if="sizeText" class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
      {{ sizeText }}
    </span>
    <template #actions>
      <Segmented v-if="poolHere" size="sm" active-variant="solid" aria-label="Show the folder as">
        <SegmentedButton :active="view === 'files'" class="text-xs" @click="view = 'files'">
          Files
        </SegmentedButton>
        <SegmentedButton :active="view === 'pool'" class="text-xs" @click="view = 'pool'">
          Databases in the pool
        </SegmentedButton>
      </Segmented>
      <Button
        v-if="path"
        size="sm"
        variant="transparent"
        content-class-name="gap-1.5"
        :disabled="folderWrites.blockedReason.value !== null || folderWrites.busy.value"
        @click="deleteFolder"
      >
        <Trash2 :size="12" aria-hidden="true" />
        Delete folder…
      </Button>
      <IconAction
        label="Read again"
        hint="Reads this folder from the phone again"
        :disabled="away !== null"
        @click="refresh"
      >
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
    </template>
  </DataCollectionHeader>

  <div
    class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle px-3 py-1.5"
  >
    <IconAction
      label="Open the folder above"
      size="sm"
      :disabled="!path"
      @click="emit('openFolder', parentOf(path))"
    >
      <ArrowUp :stroke-width="1.8" />
    </IconAction>
    <OpfsBreadcrumbs :path="path" class="min-w-0 flex-1" @open="emit('openFolder', $event)" />
    <OpfsTechHints :hints="hints" />
  </div>

  <DataState
    v-if="gone"
    kind="empty"
    title="This folder is not in OPFS any more"
    text="The app deleted or moved it after it was listed."
  >
    <Button size="sm" variant="transparent" @click="emit('openFolder', parentOf(path))">
      Open the folder above
    </Button>
  </DataState>
  <DataState
    v-else-if="away && read.pending.value"
    kind="waiting"
    title="Waiting for the app"
    :text="away"
  >
    <Button
      size="sm"
      variant="solid-fill"
      color="brand"
      :loading="bringing"
      @click="emit('bringToFront')"
    >
      Bring to front
    </Button>
  </DataState>
  <DataState
    v-else-if="error && read.pending.value"
    kind="error"
    :title="`Could not read the folder “${label}”`"
    :detail="error"
    @retry="read.refetch()"
  />
  <template v-else>
    <DataState
      v-if="error && !away"
      compact
      kind="error"
      title="Could not read this folder again; the entries below are from the last read"
      :detail="error"
      class="shrink-0 border-b border-border-subtle"
      @retry="read.refetch()"
    />
    <DataState
      v-if="away"
      compact
      kind="waiting"
      title="Waiting for the app; the entries below are from the last read"
      :text="away"
      class="shrink-0 border-b border-border-subtle"
    >
      <Button size="sm" variant="transparent" :loading="bringing" @click="emit('bringToFront')">
        Bring to front
      </Button>
    </DataState>
    <OpfsPoolRows
      v-if="view === 'pool'"
      :databases="pool.databases.value"
      :loading="pool.loading.value"
      :error="pool.error.value"
      @open="openPoolDatabase"
      @retry="pool.refetch()"
    />
    <OpfsRows
      v-else
      ref="rowsView"
      :folder-label="path ? label : 'OPFS'"
      :rows="rows"
      :loading="read.loading.value"
      :total="total"
      :away="away"
      :writes="writes"
      :saving="saver.saving.value"
      :bytes="domains.bytes"
      @open-folder="emit('openFolder', $event)"
      @open-database="openDatabase"
      @download="saver.download"
    />
  </template>
</template>
