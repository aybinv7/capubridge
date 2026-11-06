<script setup lang="ts">
import { computed } from "vue";
import { SurfaceCut } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { formatBytes } from "@/shared/format/numbers";
import type { SqliteDatabaseFacts, SqliteDbFile } from "@/types/sqlite.types";
import SqliteSourceBadge from "../SqliteSourceBadge.vue";
import { freeShare } from "./sqliteHealth";

/**
 * The file at a glance, in small wells: its size and pages, free pages (with what VACUUM would
 * give back, wording only: a copy is never changed here), how SQLite keeps it (journal, WAL),
 * the schema version apps bump on migrations, the encoding, and where it lives.
 */
const props = defineProps<{ facts: SqliteDatabaseFacts | null; db: SqliteDbFile }>();

const count = (value: number) => value.toLocaleString("en-US");

const cells = computed(() => {
  const facts = props.facts;
  if (!facts) return [];
  const free = freeShare(facts);
  return [
    {
      id: "file",
      text: `${formatBytes(facts.fileBytes)} file`,
      detail: `${count(facts.pageCount)} pages × ${formatBytes(facts.pageSize)}`,
      hint: null,
    },
    {
      id: "free",
      text: `${free < 0.01 && free > 0 ? "<1" : Math.round(free * 100)} % free`,
      detail: `${count(facts.freelistCount)} pages`,
      hint:
        facts.freelistCount > 0
          ? `VACUUM would give back ${formatBytes(facts.freelistCount * facts.pageSize)}.`
          : "No free pages: the file holds nothing it could give back.",
    },
    {
      id: "journal",
      text: `journal: ${facts.journalMode}`,
      detail: facts.walBytes !== null ? `WAL ${formatBytes(facts.walBytes)}` : "no WAL",
      hint:
        facts.walBytes !== null
          ? "A write-ahead log sits beside the copy; its rows are read with the file."
          : null,
    },
    {
      id: "version",
      text: `schema v ${facts.userVersion}`,
      detail: facts.encoding,
      hint: "user_version: the number an app's migrations usually raise.",
    },
  ];
});
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" aria-label="About the file">
    <template v-for="cell in cells" :key="cell.id">
      <HintTooltip :text="cell.hint">
        <SurfaceCut
          class="rounded-control"
          content-class-name="flex items-baseline gap-2 px-2.5 py-1.5"
          tabindex="0"
        >
          <span class="text-xs text-foreground tabular-nums">{{ cell.text }}</span>
          <span class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
            {{ cell.detail }}
          </span>
        </SurfaceCut>
      </HintTooltip>
    </template>
    <SqliteSourceBadge :db="db" />
  </div>
</template>
