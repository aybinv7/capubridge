<script setup lang="ts">
import JsonEditor from "@/shared/components/data/JsonEditor.vue";

const body = defineModel<string>({ required: true });

const props = defineProps<{ json: boolean; label: string }>();
</script>

<template>
  <div class="h-full min-h-0 overflow-hidden rounded-control bg-surface-cut shadow-cut">
    <JsonEditor v-if="props.json" :value="body" class="h-full" @update:value="body = $event" />
    <textarea
      v-else
      v-model="body"
      class="h-full w-full resize-none bg-transparent px-3 py-2 font-mono text-xs leading-5 text-foreground outline-none placeholder:text-[var(--fg-subtle)]"
      placeholder="The text the rule answers with"
      spellcheck="false"
      :aria-label="props.label"
    />
  </div>
</template>
