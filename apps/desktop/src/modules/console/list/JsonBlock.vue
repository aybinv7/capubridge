<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";
import type { JsonInText } from "@/lib/stream-rows/jsonInText";

const JsonView = defineAsyncComponent(() => import("@/shared/code-viewer/JsonView.vue"));

/**
 * JSON found in a row, shown through the shared code viewer (text with colours, or a tree)
 * in a bounded well. The viewer loads only when a row with JSON is opened.
 */
const props = defineProps<{ json: JsonInText }>();

const findSignal = ref(0);
const text = computed(() => JSON.stringify(props.json.value));
const parse = computed(() => ({ ok: true as const, value: props.json.value }));
const lines = computed(() => props.json.pretty.split("\n").length);
const height = computed(() => Math.min(288, 40 + lines.value * 18));
</script>

<template>
  <div
    class="overflow-hidden rounded-inner bg-surface-cut shadow-cut"
    :style="{ height: `${height}px` }"
  >
    <JsonView
      :text="text"
      :pretty="props.json.pretty"
      :parse="parse"
      :find-signal="findSignal"
      wrap-storage-key="capubridge.drawer.json.wrap"
      find-label="Find in this JSON"
    />
  </div>
</template>
