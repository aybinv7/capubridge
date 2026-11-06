<script setup lang="ts">
import { computed } from "vue";
import { Chip } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import type { SqliteDbFile } from "@/types/sqlite.types";
import { sqliteSourceDescriptor } from "./sqliteSources";

/**
 * Where the database lives (native, opfs, sah-pool, wa-sqlite, jeep, file) as a quiet chip;
 * hovering it says what that means, the package behind it and where it is stored.
 */
const props = defineProps<{ db: SqliteDbFile }>();

const descriptor = computed(() => sqliteSourceDescriptor(props.db));

const explanation = computed(() => {
  const db = props.db;
  const where =
    db.sourceOpfsPath ??
    (db.sourceKind === "jeep-sqlite"
      ? `IndexedDB ${db.sourceIdbName ?? "jeepSQLiteStore"} › ${db.sourceStoreName ?? "databases"}`
      : "");
  return [
    `${descriptor.value.title}. ${descriptor.value.description}`,
    descriptor.value.packageName ? `Package ${descriptor.value.packageName}.` : "",
    where ? `Stored at ${where}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
});
</script>

<template>
  <HintTooltip :text="explanation">
    <Chip size="xs" tabindex="0">{{ descriptor.label }}</Chip>
  </HintTooltip>
</template>
