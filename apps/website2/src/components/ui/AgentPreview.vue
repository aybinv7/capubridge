<script setup lang="ts">
const steps = [
  { call: "launch_emulator", args: "pixel_8 · api 35", result: "booted · 21s" },
  { call: "launch_app", args: "com.example.app", result: "foreground" },
  { call: "list_targets", args: "", result: "1 webview · localhost" },
  { call: "read_storage", args: "indexeddb", result: "12 stores · 1 840 rows" },
  { call: "tap / input_text", args: "sync now", result: "42 rows changed" },
  { call: "take_screenshot", args: "", result: "1080 × 2400" },
];
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-[var(--rule-strong)] bg-[var(--surface-0)]">
    <div
      class="flex items-center justify-between border-b border-[var(--rule)] bg-[var(--surface-2)] px-3 py-2"
    >
      <span class="font-mono text-[10px] tracking-[0.1em] text-[var(--ink-3)]">mcp · session</span>
      <span class="font-mono text-[10px] text-[var(--ink-3)]">agent driven</span>
    </div>

    <ul class="divide-y divide-[var(--rule)] font-mono text-[11px]">
      <li v-for="step in steps" :key="step.call" class="flex items-baseline gap-2 px-3 py-2">
        <span class="text-[var(--accent)]">→</span>
        <span class="text-[var(--ink-0)]">{{ step.call }}</span>
        <span v-if="step.args" class="truncate text-[var(--ink-3)]">{{ step.args }}</span>
        <span class="ml-auto shrink-0 text-[#5ad39a]">{{ step.result }}</span>
      </li>
    </ul>
  </div>
</template>
