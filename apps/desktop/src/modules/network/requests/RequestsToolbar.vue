<script setup lang="ts">
import { computed, ref } from "vue";
import { Pause, Pin, Play, RotateCw, Trash2 } from "lucide-vue-next";
import { SearchField, Select } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useNetworkStore } from "../stores/useNetworkStore";
import CaptureStatus from "./CaptureStatus.vue";
import MockingNotice from "./MockingNotice.vue";
import type { CaptureWord } from "./captureState";
import { METHOD_OPTIONS, SCOPE_OPTIONS } from "./requestFilters";

const props = defineProps<{ word: CaptureWord; reloading: boolean; canReload: boolean }>();

const emit = defineEmits<{ reload: [] }>();

const store = useNetworkStore();
const searchBox = ref<HTMLElement | null>(null);

const searching = computed(() => store.filterText.trim() !== "");
const methodLabel = computed(() =>
  store.methodFilter === "All" ? "Any method" : store.methodFilter,
);
const scopeLabel = computed(
  () => SCOPE_OPTIONS.find((option) => option.value === store.searchScope)?.label ?? "",
);
const methodModel = computed({
  get: () => store.methodFilter,
  set: (value: unknown) => {
    store.methodFilter = typeof value === "string" ? value : "All";
  },
});
const scopeModel = computed({
  get: () => store.searchScope,
  set: (value: unknown) => {
    store.searchScope = value === "all" ? "all" : "url";
  },
});

/** Focuses the filter field and selects its text, for Ctrl+F and the palette. */
function focusFilter() {
  const input = searchBox.value?.querySelector("input");
  input?.focus();
  input?.select();
}

defineExpose({ focusFilter });
</script>

<template>
  <div class="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2">
    <IconAction
      :label="store.isRecording ? 'Pause capture' : 'Resume capture'"
      :hint="store.isRecording ? 'Requests made while paused are not kept' : undefined"
      @click="store.isRecording = !store.isRecording"
    >
      <Pause v-if="store.isRecording" :stroke-width="1.8" />
      <Play v-else :stroke-width="1.8" />
    </IconAction>
    <CaptureStatus :word="props.word" />

    <span class="mx-0.5 h-4 w-px shrink-0 bg-border-subtle" aria-hidden="true" />

    <span ref="searchBox" class="contents">
      <SearchField
        v-model="store.filterText"
        size="sm"
        class="w-64 min-w-40 shrink"
        placeholder="Filter requests"
        aria-label="Filter requests"
      />
    </span>
    <Select
      v-if="searching"
      v-model="scopeModel"
      :options="SCOPE_OPTIONS"
      size="sm"
      variant="transparent"
      :outline="false"
      :keyboard-hints="false"
      aria-label="What the filter searches"
      class="w-auto shrink-0 text-muted-foreground"
    >
      {{ scopeLabel }}
    </Select>
    <Select
      v-model="methodModel"
      :options="METHOD_OPTIONS"
      size="sm"
      variant="transparent"
      :outline="false"
      :keyboard-hints="false"
      aria-label="Show requests with this method"
      class="w-auto shrink-0 text-muted-foreground"
    >
      {{ methodLabel }}
    </Select>

    <span class="flex-1" />

    <MockingNotice />
    <IconAction
      label="Keep requests when the page reloads"
      hint="Otherwise the list starts over on every navigation"
      toggle
      :pressed="store.preserveLog"
      @click="store.preserveLog = !store.preserveLog"
    >
      <Pin :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Reload the page"
      hint="Loads the page again so every request is captured from the start"
      :loading="props.reloading"
      :disabled="!props.canReload"
      @click="emit('reload')"
    >
      <RotateCw :stroke-width="1.8" />
    </IconAction>
    <IconAction label="Clear requests" :disabled="store.requestCount === 0" @click="store.clear()">
      <Trash2 :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
