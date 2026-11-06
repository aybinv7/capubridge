<script setup lang="ts">
import { ref } from "vue";

/**
 * Plain text editing for a stored value: no checks, no reformatting, what is typed is what
 * is saved. A native textarea keeps the text exactly (a rich editor rewrites spaces).
 */
defineProps<{ label: string }>();

const text = defineModel<string>({ required: true });
const area = ref<HTMLTextAreaElement | null>(null);

defineExpose({ focus: () => area.value?.focus() });
</script>

<template>
  <textarea
    ref="area"
    v-model="text"
    :aria-label="label"
    spellcheck="false"
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    class="h-full min-h-0 w-full resize-none rounded-inner bg-surface-cut px-2.5 py-2 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-foreground shadow-cut outline-none placeholder:text-[var(--fg-subtle)] focus-visible:ring-1 focus-visible:ring-ring"
    placeholder="Empty"
  />
</template>
