<script setup lang="ts">
import { computed } from "vue";
import JsonEditor from "@/shared/components/data/JsonEditor.vue";
import { exceedsEditorLimit } from "./bodyLimits";

const body = defineModel<string>({ required: true });

const props = defineProps<{ json: boolean; label: string }>();

const large = computed(() => exceedsEditorLimit(body.value));
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col overflow-hidden rounded-control bg-surface-cut shadow-cut"
  >
    <p
      v-if="props.json && large"
      class="shrink-0 border-b border-border-subtle px-3 py-1.5 text-2xs text-muted-foreground"
      role="note"
    >
      This body is large, so it is edited as plain text without colours or folding.
    </p>
    <JsonEditor
      v-if="props.json && !large"
      :value="body"
      class="h-full"
      @update:value="body = $event"
    />
    <textarea
      v-else
      v-model="body"
      class="min-h-0 w-full flex-1 resize-none bg-transparent px-3 py-2 font-mono text-xs leading-5 text-foreground outline-none placeholder:text-[var(--fg-subtle)]"
      placeholder="The text the rule answers with"
      spellcheck="false"
      :aria-label="props.label"
    />
  </div>
</template>
