<script setup lang="ts">
const rows = [
  { mark: " ", field: "_ruid", value: "40020858-413b-41ae-bf3a-3f…", tone: "muted" },
  { mark: "-", field: "_sync_status", value: '"need-update"', tone: "removed" },
  { mark: "+", field: "_sync_status", value: '"synced"', tone: "added" },
  { mark: "-", field: "_write_date", value: "2026-04-20T09:02:38.000Z", tone: "removed" },
  { mark: "+", field: "_write_date", value: "2026-04-22T11:18:47.000Z", tone: "added" },
  { mark: "+", field: "sequence", value: "2", tone: "added" },
];
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-[var(--rule-strong)] bg-[var(--surface-0)]">
    <div
      class="flex items-center justify-between border-b border-[var(--rule)] bg-[var(--surface-2)] px-3 py-2"
    >
      <span class="font-mono text-[10px] tracking-[0.1em] text-[var(--ink-3)]">
        indexeddb · calendar.event
      </span>
      <span class="font-mono text-[10px] text-[var(--accent)]">live</span>
    </div>

    <ul class="divide-y divide-[var(--rule)] font-mono text-[11px] leading-[1.5]">
      <li
        v-for="(row, index) in rows"
        :key="index"
        class="diff-row flex gap-3 px-3 py-1.5"
        :class="`is-${row.tone}`"
      >
        <span class="w-2 shrink-0 text-center">{{ row.mark }}</span>
        <span class="w-[8.5rem] shrink-0 text-[var(--ink-3)]">{{ row.field }}</span>
        <span class="truncate">{{ row.value }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.diff-row.is-muted {
  color: var(--ink-2);
}

.diff-row.is-removed {
  color: #f0836b;
  background: rgba(240, 131, 107, 0.07);
}

.diff-row.is-added {
  color: #5ad39a;
  background: rgba(90, 211, 154, 0.07);
}
</style>
