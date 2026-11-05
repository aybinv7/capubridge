<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import JsonTreeView from "./JsonTreeView.vue";
import TextView from "./TextView.vue";
import type { JsonContent } from "./viewerContent";

const props = defineProps<{ content: JsonContent; findSignal: number }>();

const emit = defineEmits<{ download: [] }>();

const mode = ref<"text" | "tree">("text");

const parsed = computed(() => (props.content.parse?.ok ? props.content.parse : null));
const notice = computed(() => {
  const parse = props.content.parse;
  if (parse === null) return "The tree needs the whole file, so this part is shown as text.";
  if (!parse.ok) return `This is not valid JSON, so it is shown as text. ${parse.message}`;
  return undefined;
});

const textFindSignal = ref(0);

watch(
  () => props.findSignal,
  async () => {
    mode.value = "text";
    await nextTick();
    textFindSignal.value += 1;
  },
);
</script>

<template>
  <JsonTreeView v-if="mode === 'tree' && parsed" :value="parsed.value">
    <template #lead>
      <Segmented size="sm" aria-label="How to show the JSON">
        <SegmentedButton :active="false" @click="mode = 'text'">Text</SegmentedButton>
        <SegmentedButton :active="true">Tree</SegmentedButton>
      </Segmented>
    </template>
  </JsonTreeView>
  <TextView
    v-else
    :text="parsed ? props.content.pretty : props.content.text"
    language="json"
    :truncation="props.content.truncation"
    :find-signal="textFindSignal"
    :notice="notice"
    @download="emit('download')"
  >
    <template v-if="parsed" #lead>
      <Segmented size="sm" aria-label="How to show the JSON">
        <SegmentedButton :active="true">Text</SegmentedButton>
        <SegmentedButton :active="false" @click="mode = 'tree'">Tree</SegmentedButton>
      </Segmented>
    </template>
  </TextView>
</template>
