<script setup lang="ts">
import { computed } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { Database, Download, ExternalLink, TableProperties } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { formatSize } from "../fileKinds";
import type { SqliteContent } from "./viewerContent";

const props = defineProps<{ content: SqliteContent; route: RouteLocationRaw | null }>();

const emit = defineEmits<{ openOnComputer: []; download: []; navigated: [] }>();

const router = useRouter();

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

async function openInData() {
  if (!props.route) return;
  emit("navigated");
  await router.push(props.route);
}

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
          <p class="text-xs text-muted-foreground">
            <template v-if="props.route">Its tables open in Data › SQLite.</template>
            <template v-else>
              To browse its tables, select the app that owns it, then open Data › SQLite. That
              screen lists the databases in the app's own folder.
            </template>
          </p>
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

      <div class="flex flex-wrap items-center gap-1">
        <Button
          v-if="props.route"
          size="sm"
          variant="solid-fill"
          color="brand"
          :content-class-name="actionContent"
          @click="openInData"
        >
          <TableProperties :stroke-width="1.8" />
          Open in Data › SQLite
        </Button>
        <Button
          size="sm"
          :variant="props.route ? 'transparent' : 'solid-fill'"
          :content-class-name="actionContent"
          @click="emit('download')"
        >
          <Download :stroke-width="1.8" />
          Download
        </Button>
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
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
