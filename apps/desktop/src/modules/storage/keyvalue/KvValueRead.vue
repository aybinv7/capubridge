<script setup lang="ts">
import { computed } from "vue";
import JsonView from "@/shared/code-viewer/JsonView.vue";
import TextView from "@/shared/code-viewer/TextView.vue";
import { formatCell } from "@/shared/components/data/grid";
import type { KvEntry } from "./kvModel";

const WRAP_KEY = "capubridge:data-keyvalue-wrap";

/**
 * A stored value to read: JSON as text or a tree (Raw shows it exactly as stored), text as
 * text, and a value JSON cannot carry (a date, a blob) in words first.
 */
const props = defineProps<{ entry: KvEntry; findSignal: number }>();

const isJson = computed(() => props.entry.type === "object" || props.entry.type === "array");

const jsonText = computed(() => {
  if (!isJson.value) return null;
  const stored = typeof props.entry.value === "string" ? props.entry.value : props.entry.stored;
  const parsed: unknown =
    typeof props.entry.value === "string" ? props.entry.cell : props.entry.value;
  return {
    text: stored,
    pretty: JSON.stringify(parsed, null, 2) ?? stored,
    parse: { ok: true as const, value: parsed },
  };
});

const special = computed(() =>
  props.entry.type === "special" ? formatCell(props.entry.value) : null,
);

const plainText = computed(() => {
  const value = props.entry.value;
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? "";
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="special" class="shrink-0 px-3 pb-2 text-xs">
      <p class="text-foreground select-text">{{ special.text }}</p>
      <p v-if="special.detail" class="font-mono text-2xs text-[var(--fg-subtle)] select-text">
        {{ special.detail }}
      </p>
    </div>
    <div class="min-h-0 flex-1 border-t border-border-subtle">
      <JsonView
        v-if="jsonText"
        :text="jsonText.text"
        :pretty="jsonText.pretty"
        :parse="jsonText.parse"
        :find-signal="findSignal"
        allow-raw
        :wrap-storage-key="WRAP_KEY"
        find-label="Find in the value"
      />
      <TextView
        v-else
        :text="plainText"
        language="plain"
        :find-signal="findSignal"
        :wrap-storage-key="WRAP_KEY"
        find-label="Find in the value"
      />
    </div>
  </div>
</template>
