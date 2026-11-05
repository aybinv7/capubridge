<script setup lang="ts">
import { computed } from "vue";
import { Download, ExternalLink, FolderOpen, Trash2, View } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import CopyAction from "../shared/CopyAction.vue";
import FileGlyph from "./FileGlyph.vue";
import { modifiedCell } from "./fileCells";
import { entryKindLabel, formatFileEntrySize } from "./fileKinds";
import { isFolderEntry, type DeviceFileListEntry } from "./filePaths";

const props = defineProps<{
  entry: DeviceFileListEntry | null;
  sizesKnown: boolean;
}>();

const emit = defineEmits<{
  open: [];
  openOnComputer: [];
  download: [];
  delete: [];
}>();

const folder = computed(() => (props.entry ? isFolderEntry(props.entry) : false));
const facts = computed(() => {
  const entry = props.entry;
  if (!entry) return [];
  return [
    { label: "Kind", value: entryKindLabel(entry), mono: false, raw: null },
    {
      label: "Size",
      value: entry.noAccess
        ? "Unknown"
        : formatFileEntrySize(entry, props.sizesKnown ? "0 B" : "Unknown"),
      mono: true,
      raw: null,
    },
    { label: "Modified", value: modifiedCell(entry), mono: false, raw: entry.modified || null },
    {
      label: "Permissions",
      value: entry.noAccess ? "No access for the shell user" : entry.permissions,
      mono: !entry.noAccess,
      raw: null,
    },
  ];
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
    <template v-if="props.entry">
      <header class="flex flex-col items-start gap-2">
        <span
          class="grid size-12 place-items-center rounded-well bg-surface-cut shadow-cut"
          aria-hidden="true"
        >
          <FileGlyph :entry="props.entry" :size="24" />
        </span>
        <h2 class="text-sm font-medium break-all text-foreground">{{ props.entry.name }}</h2>
        <span class="flex w-full min-w-0 items-center gap-1">
          <span class="min-w-0 flex-1 font-mono text-2xs break-all text-[var(--fg-subtle)]">
            {{ props.entry.path }}
          </span>
          <CopyAction :value="props.entry.path" label="Copy path" class="shrink-0" />
        </span>
      </header>

      <dl class="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-xs">
        <template v-for="fact in facts" :key="fact.label">
          <dt class="text-muted-foreground">{{ fact.label }}</dt>
          <dd
            class="min-w-0 truncate text-foreground"
            :class="fact.mono && 'font-mono text-2xs'"
            :title="fact.raw ?? undefined"
          >
            {{ fact.value }}
          </dd>
        </template>
      </dl>

      <div class="flex flex-col gap-1">
        <Button
          size="sm"
          variant="transparent"
          content-class-name="w-full justify-start gap-2 [&>svg]:size-3.5"
          @click="emit('open')"
        >
          <FolderOpen v-if="folder" :stroke-width="1.8" />
          <View v-else :stroke-width="1.8" />
          {{ folder ? "Open folder" : "Preview" }}
        </Button>
        <template v-if="!folder">
          <Button
            size="sm"
            variant="transparent"
            :outline="false"
            content-class-name="w-full justify-start gap-2 [&>svg]:size-3.5"
            @click="emit('openOnComputer')"
          >
            <ExternalLink :stroke-width="1.8" />
            Open on this computer
          </Button>
          <Button
            size="sm"
            variant="transparent"
            :outline="false"
            content-class-name="w-full justify-start gap-2 [&>svg]:size-3.5"
            @click="emit('download')"
          >
            <Download :stroke-width="1.8" />
            Download
          </Button>
        </template>
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
          color="red"
          content-class-name="w-full justify-start gap-2 [&>svg]:size-3.5"
          @click="emit('delete')"
        >
          <Trash2 :stroke-width="1.8" />
          Delete
        </Button>
      </div>
    </template>
    <p v-else class="m-auto max-w-48 text-center text-xs text-muted-foreground">
      Select a file or folder to see its details.
    </p>
  </div>
</template>
