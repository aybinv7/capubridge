<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import JsonTreeView from "./JsonTreeView.vue";
import TextView from "./TextView.vue";
import type { JsonParse } from "./textLines";

type JsonMode = "text" | "tree" | "raw";

const props = defineProps<{
  text: string;
  pretty: string;
  parse: JsonParse | null;
  truncationNote?: string | null;
  findSignal: number;
  /** Offers the text exactly as it arrived, beside the formatted text and the tree. */
  allowRaw?: boolean;
  wrapStorageKey?: string;
  findLabel?: string;
}>();

const emit = defineEmits<{ download: [] }>();

const mode = ref<JsonMode>("text");

const parsed = computed(() => (props.parse?.ok ? props.parse : null));
const modes = computed<Array<{ value: JsonMode; label: string }>>(() => [
  { value: "text", label: "Text" },
  { value: "tree", label: "Tree" },
  ...(props.allowRaw && props.text !== props.pretty
    ? [{ value: "raw" as const, label: "Raw" }]
    : []),
]);
const shownText = computed(() => {
  if (!parsed.value || mode.value === "raw") return props.text;
  return props.pretty;
});
const notice = computed(() => {
  const parse = props.parse;
  if (parse === null) return "The tree needs the whole file, so this part is shown as text.";
  if (!parse.ok) return `This is not valid JSON, so it is shown as text. ${parse.message}`;
  return undefined;
});

const textFindSignal = ref(0);

watch(
  () => props.findSignal,
  async () => {
    if (mode.value === "tree") mode.value = "text";
    await nextTick();
    textFindSignal.value += 1;
  },
);
</script>

<template>
  <JsonTreeView v-if="mode === 'tree' && parsed" :value="parsed.value">
    <template #lead>
      <Segmented size="sm" active-variant="solid" aria-label="How to show the JSON">
        <SegmentedButton
          v-for="option in modes"
          :key="option.value"
          :active="mode === option.value"
          :class="SEGMENT_TEXT"
          @click="mode = option.value"
        >
          {{ option.label }}
        </SegmentedButton>
      </Segmented>
    </template>
  </JsonTreeView>
  <TextView
    v-else
    :text="shownText"
    language="json"
    :truncation-note="props.truncationNote"
    :find-signal="textFindSignal"
    :notice="notice"
    :wrap-storage-key="props.wrapStorageKey"
    :find-label="props.findLabel"
    @download="emit('download')"
  >
    <template v-if="parsed" #lead>
      <Segmented size="sm" active-variant="solid" aria-label="How to show the JSON">
        <SegmentedButton
          v-for="option in modes"
          :key="option.value"
          :active="mode === option.value"
          :class="SEGMENT_TEXT"
          @click="mode = option.value"
        >
          {{ option.label }}
        </SegmentedButton>
      </Segmented>
    </template>
  </TextView>
</template>
