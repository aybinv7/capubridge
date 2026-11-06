<script setup lang="ts">
import { computed } from "vue";
import { Database, Download, ExternalLink, TableProperties } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { formatSize } from "@/shared/format/fileSize";
import type { ViewerActions } from "./viewerActions";
import type { SqliteContent } from "./viewerContent";

const props = defineProps<{ content: SqliteContent; actions: ViewerActions }>();

const emit = defineEmits<{ openOnComputer: []; download: []; openDatabase: [] }>();

const canOpen = computed(() => props.actions.database.canOpen);
const hint = computed(() => props.actions.database.hint);
const primary = computed(() => {
  if (canOpen.value) return "openDatabase";
  if (props.actions.download) return "download";
  return props.actions.openOnComputer ? "openOnComputer" : null;
});

const facts = computed(() => {
  const header = props.content.header;
  const size = props.content.size;
  const rows: Array<{ label: string; value: string }> = [
    { label: "Size", value: size === null ? "Unknown" : formatSize(size, false) },
  ];
  if (!header) return rows;
  rows.push(
    { label: "Page size", value: formatSize(header.pageSize, false) },
    {
      label: "Pages",
      value: header.pageCount === null ? "Unknown" : header.pageCount.toLocaleString("en-US"),
    },
    { label: "Text encoding", value: header.encoding ?? "Unknown" },
    { label: "Journal", value: header.journal },
    { label: "User version", value: String(header.userVersion) },
  );
  return rows;
});

const actionContent = "gap-2 [&>svg]:size-3.5";
</script>

<template>
  <div class="flex h-full min-h-0 items-center justify-center overflow-auto bg-surface-cut p-6">
    <section
      class="flex w-full max-w-md flex-col gap-5 rounded-surface border border-border-subtle bg-surface-0 p-6 shadow-bevel"
      aria-label="Database"
    >
      <header class="flex items-start gap-3">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-well bg-surface-cut text-cat-storage shadow-cut"
          aria-hidden="true"
        >
          <Database :size="20" :stroke-width="1.6" />
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <h3 class="text-sm font-medium text-foreground">SQLite database</h3>
          <p v-if="canOpen" class="text-xs text-muted-foreground">
            Its tables open in Data › SQLite.
          </p>
          <p v-else-if="hint" class="text-xs text-muted-foreground">{{ hint }}</p>
        </div>
      </header>

      <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-xs">
        <template v-for="fact in facts" :key="fact.label">
          <dt class="text-muted-foreground">{{ fact.label }}</dt>
          <dd class="min-w-0 truncate font-mono text-2xs text-foreground tabular-nums">
            {{ fact.value }}
          </dd>
        </template>
      </dl>

      <div v-if="primary" class="flex flex-wrap items-center gap-1">
        <Button
          v-if="canOpen"
          size="sm"
          variant="solid-fill"
          color="brand"
          :content-class-name="actionContent"
          @click="emit('openDatabase')"
        >
          <TableProperties :stroke-width="1.8" />
          Open in Data › SQLite
        </Button>
        <Button
          v-if="props.actions.download"
          size="sm"
          :variant="primary === 'download' ? 'solid-fill' : 'transparent'"
          :color="primary === 'download' ? 'brand' : undefined"
          :content-class-name="actionContent"
          @click="emit('download')"
        >
          <Download :stroke-width="1.8" />
          Download
        </Button>
        <Button
          v-if="props.actions.openOnComputer"
          size="sm"
          :variant="primary === 'openOnComputer' ? 'solid-fill' : 'transparent'"
          :color="primary === 'openOnComputer' ? 'brand' : undefined"
          :outline="primary === 'openOnComputer' ? undefined : false"
          :content-class-name="actionContent"
          @click="emit('openOnComputer')"
        >
          <ExternalLink :stroke-width="1.8" />
          Open on this computer
        </Button>
      </div>
    </section>
  </div>
</template>
