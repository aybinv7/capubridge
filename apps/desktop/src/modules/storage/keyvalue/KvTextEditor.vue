<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { refDebounced } from "@vueuse/core";
import TextFindBar from "@/shared/code-viewer/TextFindBar.vue";

const LINE_HEIGHT = 20;
const MATCH_LIMIT = 10_000;

/**
 * Plain text editing for a stored value: no checks, no reformatting, what is typed is what
 * is saved. A native textarea keeps the text exactly (a rich editor rewrites spaces). Ctrl+F
 * opens a find bar that selects each match in the text.
 */
defineProps<{ label: string }>();

const text = defineModel<string>({ required: true });
const area = ref<HTMLTextAreaElement | null>(null);
const finding = ref(false);
const query = ref("");
const settledQuery = refDebounced(query, 120);
const current = ref(-1);

const matches = computed(() => {
  const needle = settledQuery.value.toLowerCase();
  if (!finding.value || !needle) return [];
  const haystack = text.value.toLowerCase();
  const found: number[] = [];
  let from = haystack.indexOf(needle);
  while (from >= 0 && found.length < MATCH_LIMIT) {
    found.push(from);
    from = haystack.indexOf(needle, from + needle.length);
  }
  return found;
});

const findLabel = computed(() => {
  if (matches.value.length === 0) return "No match";
  const count = matches.value.length.toLocaleString("en-US");
  return current.value < 0 ? `${count} found` : `${current.value + 1} of ${count}`;
});

function select(index: number) {
  const element = area.value;
  const start = matches.value[index];
  if (!element || start === undefined) return;
  current.value = index;
  element.setSelectionRange(start, start + settledQuery.value.length);
  const line = text.value.slice(0, start).split("\n").length - 1;
  element.scrollTop = Math.max(0, line * LINE_HEIGHT - element.clientHeight / 2);
}

function step(direction: 1 | -1) {
  const count = matches.value.length;
  if (count === 0) return;
  select((current.value + direction + count) % count);
}

async function openFind() {
  const element = area.value;
  if (element && element.selectionEnd > element.selectionStart) {
    query.value = text.value.slice(element.selectionStart, element.selectionEnd);
  }
  current.value = -1;
  finding.value = true;
  await nextTick();
  findBar.value?.focus();
}

function closeFind() {
  finding.value = false;
  current.value = -1;
  area.value?.focus();
}

const findBar = ref<InstanceType<typeof TextFindBar> | null>(null);

defineExpose({ focus: () => area.value?.focus(), openFind });
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-1">
    <TextFindBar
      v-if="finding"
      ref="findBar"
      v-model:query="query"
      class="rounded-inner"
      placeholder="Find in this value"
      :label="findLabel"
      :has-matches="matches.length > 0"
      @step="step"
      @close="closeFind"
    />
    <textarea
      ref="area"
      v-model="text"
      :aria-label="label"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      class="min-h-0 w-full flex-1 resize-none rounded-inner bg-surface-cut px-2.5 py-2 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-foreground shadow-cut outline-none placeholder:text-[var(--fg-subtle)] focus-visible:ring-1 focus-visible:ring-ring"
      placeholder="Empty"
    />
  </div>
</template>
