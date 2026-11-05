<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { ChevronDown, ChevronUp, X } from "lucide-vue-next";
import { SearchField } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";

const query = defineModel<string>("query", { required: true });

const props = defineProps<{ label: string; hasMatches: boolean }>();

const emit = defineEmits<{ step: [direction: 1 | -1]; close: [] }>();

const root = ref<HTMLElement | null>(null);

/** Puts the caret in the field with the query selected, as Ctrl+F does in every editor. */
function focus() {
  const input = root.value?.querySelector("input");
  input?.focus();
  input?.select();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    emit("step", event.shiftKey ? -1 : 1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("close");
  }
}

onMounted(() => void nextTick(focus));

defineExpose({ focus });
</script>

<template>
  <div
    ref="root"
    class="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-surface-0 px-3 py-1.5"
    role="search"
  >
    <SearchField
      v-model="query"
      size="sm"
      class="w-72"
      placeholder="Find in this file"
      aria-label="Find in this file"
      @keydown="onKeydown"
    />
    <span class="min-w-20 font-mono text-2xs text-muted-foreground tabular-nums" aria-live="polite">
      {{ query ? props.label : "" }}
    </span>
    <div class="ml-auto flex items-center gap-0.5">
      <IconAction
        label="Previous match"
        keys="shift enter"
        :disabled="!props.hasMatches"
        @click="emit('step', -1)"
      >
        <ChevronUp :stroke-width="1.8" />
      </IconAction>
      <IconAction
        label="Next match"
        keys="enter"
        :disabled="!props.hasMatches"
        @click="emit('step', 1)"
      >
        <ChevronDown :stroke-width="1.8" />
      </IconAction>
      <IconAction label="Close find" keys="esc" @click="emit('close')">
        <X :stroke-width="1.8" />
      </IconAction>
    </div>
  </div>
</template>
