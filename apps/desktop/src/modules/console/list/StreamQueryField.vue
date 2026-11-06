<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from "vue";
import { TriangleAlert } from "lucide-vue-next";
import { SearchField, Tooltip } from "@capubridge/cladd";
import KeyCaps from "@/components/command/KeyCaps.vue";
import {
  applySuggestion,
  suggestQuery,
  type QuerySuggestion,
  type SuggestResult,
  type SuggestSource,
} from "@/lib/stream-query/querySuggest";
import type { QueryProblem } from "@/lib/stream-query/streamQuery.types";

/**
 * One query field in the Logcat grammar. Ctrl+Space lists keys, values and earlier queries for
 * the word under the caret; Enter keeps the query in the history; problems the query has are
 * named in a quiet mark at the end, never by emptying the list.
 */
const props = defineProps<{
  label: string;
  placeholder: string;
  suggest: SuggestSource;
  problems: readonly QueryProblem[];
}>();

const emit = defineEmits<{ commit: [query: string] }>();

const model = defineModel<string>({ required: true });
const root = ref<HTMLElement | null>(null);
const result = shallowRef<SuggestResult | null>(null);
const activeIndex = ref(0);

const items = computed<QuerySuggestion[]>(() => result.value?.items ?? []);
const open = computed(() => items.value.length > 0);
const problemText = computed(() => props.problems.map((problem) => problem.message).join(" · "));

function input(): HTMLInputElement | null {
  return root.value?.querySelector("input") ?? null;
}

function refresh() {
  const element = input();
  const caret = element?.selectionStart ?? model.value.length;
  result.value = suggestQuery(model.value, caret, props.suggest);
  activeIndex.value = 0;
}

function close() {
  result.value = null;
}

async function pick(suggestion: QuerySuggestion) {
  const current = result.value;
  if (!current) return;
  const applied = applySuggestion(model.value, current, suggestion);
  model.value = applied.text;
  close();
  await nextTick();
  const element = input();
  element?.focus();
  element?.setSelectionRange(applied.caret, applied.caret);
  if (applied.text.endsWith(":")) refresh();
}

function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey && (event.code === "Space" || event.key === " ")) {
    event.preventDefault();
    refresh();
    return;
  }
  if (open.value) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const size = items.value.length;
      activeIndex.value = (activeIndex.value + (event.key === "ArrowDown" ? 1 : -1) + size) % size;
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      const choice = items.value[activeIndex.value];
      if (choice) {
        event.preventDefault();
        void pick(choice);
        return;
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
  }
  if (event.key === "Enter") {
    emit("commit", model.value);
    return;
  }
  if (event.key === "Escape" && model.value) {
    emit("commit", model.value);
  }
}

function onInput() {
  if (open.value) refresh();
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget;
  if (next instanceof Node && root.value?.contains(next)) return;
  close();
  emit("commit", model.value);
}

defineExpose({
  focus() {
    input()?.focus();
  },
});
</script>

<template>
  <div ref="root" class="relative min-w-0" @focusout="onFocusOut" @input="onInput">
    <SearchField
      v-model="model"
      size="sm"
      :placeholder="props.placeholder"
      :aria-label="props.label"
      input-class-name="font-mono"
      aria-autocomplete="list"
      :aria-expanded="open"
      @keydown="onKeydown"
    >
      <template v-if="props.problems.length > 0" #suffix>
        <Tooltip position="bottom" :offset="6" content-class-name="max-w-80 px-2 py-1 text-xs">
          <template #trigger>
            <span class="flex items-center text-warning" :aria-label="problemText">
              <TriangleAlert class="size-3.5" />
            </span>
          </template>
          {{ problemText }}
        </Tooltip>
      </template>
    </SearchField>
    <ul
      v-if="open"
      role="listbox"
      :aria-label="`Suggestions for ${props.label}`"
      class="absolute top-full left-0 z-50 mt-1 flex w-full max-w-md min-w-64 flex-col rounded-control bg-popover p-1 shadow-float ring-1 ring-border-subtle"
    >
      <li
        v-for="(item, index) in items"
        :key="`${item.insert}:${index}`"
        role="option"
        :aria-selected="index === activeIndex"
        class="flex h-6 cursor-default items-center gap-3 rounded-inner px-2 text-xs"
        :class="
          index === activeIndex ? 'bg-cladd-surface-hover text-foreground' : 'text-muted-foreground'
        "
        @pointerdown.prevent="pick(item)"
        @pointermove="activeIndex = index"
      >
        <span class="min-w-0 truncate font-mono text-foreground">{{ item.label }}</span>
        <span v-if="item.detail" class="ml-auto shrink-0 truncate text-2xs">{{ item.detail }}</span>
      </li>
      <li class="flex items-center gap-1.5 px-2 pt-1 text-2xs text-[var(--fg-subtle)]">
        <KeyCaps keys="up down" quiet /> to move, <KeyCaps keys="enter" quiet /> to pick
      </li>
    </ul>
  </div>
</template>
