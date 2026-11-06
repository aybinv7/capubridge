<script setup lang="ts">
import { computed } from "vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { formatBytes } from "@/shared/format/numbers";
import type { SqliteDatabaseFacts, SqliteDbFile } from "@/types/sqlite.types";
import SqliteSourceBadge from "../SqliteSourceBadge.vue";
import { freeShare } from "./sqliteHealth";
import SqliteOverviewCard from "./SqliteOverviewCard.vue";

/**
 * How SQLite keeps this file: the pragmas a developer checks first (journal, page size, schema
 * version, encoding), the WAL beside it, free pages with what VACUUM would give back (wording
 * only: a copy is never changed here), and where the file lives.
 */
const props = defineProps<{ facts: SqliteDatabaseFacts | null; db: SqliteDbFile }>();

const count = (value: number) => value.toLocaleString("en-US");

interface ConfigRow {
  label: string;
  value: string;
  hint?: string;
}

const rows = computed<ConfigRow[]>(() => {
  const facts = props.facts;
  if (!facts) return [];
  const free = freeShare(facts);
  return [
    {
      label: "Journal mode",
      value: facts.journalMode,
      hint:
        facts.journalMode.toLowerCase() === "wal"
          ? "Writes go to a write-ahead log first; readers never wait for writers."
          : "Writes go straight to the file, with a rollback journal.",
    },
    {
      label: "WAL file",
      value: facts.walBytes === null ? "none" : formatBytes(facts.walBytes),
      hint:
        facts.walBytes === null
          ? undefined
          : "Its rows are read with the file, so what you see includes them.",
    },
    { label: "Schema version", value: `v ${facts.userVersion}`, hint: "PRAGMA user_version" },
    { label: "Page size", value: formatBytes(facts.pageSize) },
    { label: "Pages", value: count(facts.pageCount) },
    {
      label: "Free pages",
      value: `${count(facts.freelistCount)} · ${free > 0 && free < 0.01 ? "<1" : Math.round(free * 100)} %`,
      hint:
        facts.freelistCount > 0
          ? `VACUUM would give back ${formatBytes(facts.freelistCount * facts.pageSize)}.`
          : "Nothing to give back.",
    },
    { label: "Encoding", value: facts.encoding },
  ];
});
</script>

<template>
  <SqliteOverviewCard title="Configuration">
    <template #aside>
      <SqliteSourceBadge :db="props.db" />
    </template>
    <p v-if="rows.length === 0" class="text-xs text-muted-foreground">Reading the file…</p>
    <dl v-else class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
      <template v-for="row in rows" :key="row.label">
        <dt class="text-muted-foreground">{{ row.label }}</dt>
        <dd class="min-w-0 text-right">
          <HintTooltip :text="row.hint ?? null">
            <span class="font-mono text-foreground tabular-nums">{{ row.value }}</span>
          </HintTooltip>
        </dd>
      </template>
    </dl>
  </SqliteOverviewCard>
</template>
