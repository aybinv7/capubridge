<script setup lang="ts">
import { ref, watch } from "vue";
import { CircleAlert, X } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";

const props = defineProps<{
  /** The applied WHERE clause. */
  where: string;
  error: string | null;
}>();

const emit = defineEmits<{ apply: [where: string] }>();

const draft = ref(props.where);
watch(
  () => props.where,
  (where) => {
    draft.value = where;
  },
);

function apply() {
  emit("apply", draft.value.trim());
}

function revert(event: KeyboardEvent) {
  if (draft.value === props.where) return;
  draft.value = props.where;
  event.stopPropagation();
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <div
      class="flex h-7 min-w-0 items-center gap-2 rounded-md bg-[var(--bg-surface-cut)] pl-2 shadow-cut focus-within:ring-1 focus-within:ring-[var(--ring)]"
      :class="error && 'ring-1 ring-error'"
    >
      <span class="font-mono text-2xs font-medium text-[var(--fg-subtle)] select-none">WHERE</span>
      <input
        v-model="draft"
        type="text"
        spellcheck="false"
        autocomplete="off"
        aria-label="Filter rows with a SQL WHERE clause"
        placeholder="Filter rows with SQL — e.g. name LIKE '%kg%'"
        class="h-full min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-[var(--fg-subtle)]"
        @keydown.enter.prevent="apply"
        @keydown.esc="revert"
      />
      <span
        v-if="draft !== where"
        class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)]"
        aria-hidden="true"
        >↵ apply</span
      >
      <Button
        v-if="where || draft"
        size="2xs"
        square
        variant="transparent"
        :outline="false"
        aria-label="Clear filter"
        class="mr-1"
        @click="
          draft = '';
          emit('apply', '');
        "
      >
        <X :size="11" aria-hidden="true" />
      </Button>
    </div>
    <p v-if="error" class="mt-1 flex items-center gap-1.5 text-2xs text-error" role="alert">
      <CircleAlert :size="11" class="shrink-0" />
      <span class="truncate" :title="error">{{ error }}</span>
    </p>
  </div>
</template>
