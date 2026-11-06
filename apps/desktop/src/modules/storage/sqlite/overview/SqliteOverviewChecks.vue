<script setup lang="ts">
import { ref } from "vue";
import { Button, StatusDot } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import type { SqliteAddress } from "../sqliteAddress";
import { runQuery } from "../sqliteReads";
import type { HealthCheck } from "./sqliteHealth";

import SqliteOverviewCard from "./SqliteOverviewCard.vue";

/**
 * Schema checks: the cheap ones from the facts, each with "Show" to narrow the table grid, and
 * the two that read the whole file (`quick_check`, `foreign_key_check`), run only when asked.
 */
const props = defineProps<{ checks: readonly HealthCheck[]; address: SqliteAddress | null }>();

const emit = defineEmits<{ show: [check: HealthCheck] }>();

type Deep = "quick_check" | "foreign_key_check";
const results = ref<Partial<Record<Deep, { ok: boolean; text: string }>>>({});
const running = ref<Deep | null>(null);
const LIMIT = 100;

function words(kind: Deep, rows: unknown[][]): { ok: boolean; text: string } {
  if (kind === "quick_check") {
    const ok = rows.length === 1 && rows[0]?.[0] === "ok";
    return {
      ok,
      text: ok
        ? "The file is sound"
        : `${rows.length} problems found: ${String(rows[0]?.[0] ?? "")}`,
    };
  }
  if (rows.length === 0) return { ok: true, text: "Every link points at a row" };
  const tables = new Set(rows.map((row) => String(row[0])));
  return {
    ok: false,
    text: `${rows.length >= LIMIT ? `${LIMIT}+` : rows.length} rows point at nothing, in ${[...tables].join(", ")}`,
  };
}

async function run(kind: Deep) {
  const address = props.address;
  if (!address || running.value) return;
  running.value = kind;
  try {
    const result = await runQuery(address, `PRAGMA ${kind}`, false, LIMIT);
    results.value = { ...results.value, [kind]: words(kind, result.rows) };
  } catch (error) {
    results.value = {
      ...results.value,
      [kind]: { ok: false, text: error instanceof Error ? error.message : String(error) },
    };
  } finally {
    running.value = null;
  }
}

const DEEP: Array<{ id: Deep; label: string; hint: string }> = [
  {
    id: "quick_check",
    label: "Check the file",
    hint: "PRAGMA quick_check: reads every page once.",
  },
  {
    id: "foreign_key_check",
    label: "Check the links",
    hint: "PRAGMA foreign_key_check: finds rows whose link points at no row.",
  },
];
</script>

<template>
  <SqliteOverviewCard title="Health">
    <p v-if="checks.length === 0" class="flex items-center gap-2 text-xs text-muted-foreground">
      <StatusDot variant="hollow" size="xs" /> Nothing stands out
    </p>
    <div v-for="check in checks" :key="check.id" class="flex items-start gap-2 text-xs">
      <StatusDot
        :color="check.level === 'warn' ? 'yellow' : undefined"
        :variant="check.level === 'warn' ? 'solid' : 'hollow'"
        size="xs"
        class="mt-1 shrink-0"
      />
      <HintTooltip :text="check.detail ?? null">
        <span class="min-w-0 flex-1 text-foreground" tabindex="0">{{ check.text }}</span>
      </HintTooltip>
      <Button
        v-if="check.tables.length"
        size="2xs"
        variant="transparent"
        class="ml-auto shrink-0"
        @click="emit('show', check)"
      >
        Show
      </Button>
    </div>
    <div v-for="deep in DEEP" :key="deep.id" class="flex items-start gap-2 text-xs">
      <StatusDot
        :color="results[deep.id] ? (results[deep.id]?.ok ? 'green' : 'red') : undefined"
        :variant="results[deep.id] ? 'solid' : 'hollow'"
        size="xs"
        class="mt-1 shrink-0"
      />
      <span class="min-w-0 flex-1 text-muted-foreground">
        {{ results[deep.id]?.text ?? deep.hint }}
      </span>
      <Button
        size="2xs"
        variant="solid"
        class="ml-auto shrink-0"
        :loading="running === deep.id"
        :disabled="running !== null || !address"
        @click="run(deep.id)"
      >
        {{ deep.label }}
      </Button>
    </div>
  </SqliteOverviewCard>
</template>
