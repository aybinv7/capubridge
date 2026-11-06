<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { Spinner, Textarea } from "@capubridge/cladd";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { useConsoleStore } from "@/stores/console.store";
import { caretOffset, placeCaret } from "./editableCaret";
import { usePromptCompletion } from "./usePromptCompletion";
import { usePromptHistory } from "./usePromptHistory";

/**
 * The prompt under the Console stream. Enter runs, Shift+Enter adds a line, ↑ and ↓ walk the
 * history from the first and last line, Tab or Ctrl+Space completes. Results land in the
 * stream between the messages they caused.
 */
const props = defineProps<{ targetLabel: string }>();

const store = useConsoleStore();
const history = usePromptHistory();
const completion = usePromptCompletion();
const text = ref("");
const running = ref(false);
const host = ref<HTMLElement | null>(null);
const activeIndex = ref(0);

const placeholder = computed(
  () => `Run JavaScript in ${props.targetLabel}  ·  Enter to run, Shift+Enter for a new line`,
);
const completing = computed(() => completion.items.value.length > 0);

function control(): HTMLElement | null {
  return host.value?.querySelector<HTMLElement>('[data-part="control"]') ?? null;
}

async function setText(value: string, caret = value.length) {
  text.value = value;
  await nextTick();
  const element = control();
  if (!element) return;
  element.focus();
  placeCaret(element, caret);
}

async function run() {
  const expression = text.value;
  if (!expression.trim() || running.value) return;
  history.remember(expression);
  completion.close();
  running.value = true;
  await setText("");
  try {
    await store.evaluate(expression);
  } catch (error) {
    if (!store.boundTargetId) store.error = `Nothing ran: ${String(error)}`;
  } finally {
    running.value = false;
  }
}

function lineOfCaret(): { first: boolean; last: boolean } {
  const element = control();
  const value = text.value;
  const caret = element ? caretOffset(element) : value.length;
  return { first: !value.slice(0, caret).includes("\n"), last: !value.slice(caret).includes("\n") };
}

async function pickCompletion(name: string) {
  const context = completion.context.value;
  const element = control();
  if (!context || !element) return;
  const caret = caretOffset(element);
  const next = text.value.slice(0, context.from) + name + text.value.slice(caret);
  completion.close();
  await setText(next, context.from + name.length);
}

function requestCompletion() {
  const element = control();
  if (!element) return;
  activeIndex.value = 0;
  void completion.update(text.value, caretOffset(element));
}

function onKeydown(event: KeyboardEvent) {
  if (completing.value) {
    const size = completion.items.value.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex.value = (activeIndex.value + (event.key === "ArrowDown" ? 1 : -1) + size) % size;
      return;
    }
    if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
      const name = completion.items.value[activeIndex.value];
      if (name) {
        event.preventDefault();
        void pickCompletion(name);
        return;
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      completion.close();
      return;
    }
  }
  if ((event.ctrlKey && event.code === "Space") || event.key === "Tab") {
    event.preventDefault();
    requestCompletion();
    return;
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void run();
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const { first, last } = lineOfCaret();
    const up = event.key === "ArrowUp";
    if ((up && !first) || (!up && !last)) return;
    const next = history.step(up ? -1 : 1, text.value);
    if (next === null) return;
    event.preventDefault();
    void setText(next);
  }
}

function onInput(value: string) {
  text.value = value;
  history.reset();
  if (completing.value || value.endsWith(".")) requestCompletion();
}

defineExpose({
  fill(expression: string) {
    void setText(expression);
  },
  focus() {
    control()?.focus();
  },
});
</script>

<template>
  <div
    ref="host"
    class="relative flex shrink-0 items-start gap-1.5 border-t border-border-subtle px-2 py-1"
  >
    <ChevronRight class="mt-1.5 size-3.5 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
    <Textarea
      :model-value="text"
      size="sm"
      :outline="false"
      bg-class-name="bg-transparent"
      update-content-on-change
      class="min-w-0 flex-1"
      input-class-name="max-h-32 overflow-y-auto font-mono text-xs leading-5"
      :placeholder="placeholder"
      aria-label="Run JavaScript"
      @update:model-value="onInput"
      @keydown="onKeydown"
      @blur="completion.close()"
    />
    <span class="mt-1 flex h-5 shrink-0 items-center gap-1.5 text-2xs text-[var(--fg-subtle)]">
      <template v-if="running">
        <Spinner size="xs" />
        <span>Running</span>
      </template>
      <KeyCaps v-else keys="enter" quiet />
    </span>
    <ul
      v-if="completing"
      role="listbox"
      aria-label="Completions"
      class="absolute bottom-full left-6 z-50 mb-1 flex max-h-56 w-72 flex-col overflow-y-auto rounded-control bg-popover p-1 shadow-float ring-1 ring-border-subtle"
    >
      <li
        v-for="(name, index) in completion.items.value"
        :key="name"
        role="option"
        :aria-selected="index === activeIndex"
        class="flex h-6 shrink-0 cursor-default items-center rounded-inner px-2 font-mono text-xs"
        :class="
          index === activeIndex ? 'bg-cladd-surface-hover text-foreground' : 'text-muted-foreground'
        "
        @pointerdown.prevent="pickCompletion(name)"
        @pointermove="activeIndex = index"
      >
        {{ name }}
      </li>
    </ul>
  </div>
</template>
