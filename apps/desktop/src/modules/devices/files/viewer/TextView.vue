<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { Search, WrapText } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import TextFindBar from "./TextFindBar.vue";
import TextLinesPane from "./TextLinesPane.vue";
import ViewerNote from "./ViewerNote.vue";
import ViewerToolbar from "./ViewerToolbar.vue";
import { truncationNote, type Truncation } from "./readPlan";
import { splitLines } from "./textLines";
import { useHighlightedLines } from "./useHighlightedLines";
import { useTextFind } from "./useTextFind";
import type { TextLanguage } from "./viewerKinds";

const props = defineProps<{
  text: string;
  language: TextLanguage;
  truncation: Truncation | null;
  findSignal: number;
  notice?: string;
}>();

const emit = defineEmits<{ download: [] }>();

const wrap = useLocalStorage("capubridge.files.viewer.wrap", false);
const pane = ref<InstanceType<typeof TextLinesPane> | null>(null);
const findBar = ref<InstanceType<typeof TextFindBar> | null>(null);

const lines = computed(() => splitLines(props.text));
const { tokens, total } = useHighlightedLines(lines, toRef(props, "language"));
const find = useTextFind(lines);

const lineCount = computed(() => lines.value.length.toLocaleString("en-US"));
const partlyColoured = computed(() => total.value > 0 && total.value < lines.value.length);

async function openFind() {
  find.open.value = true;
  await nextTick();
  findBar.value?.focus();
}

function closeFind() {
  find.close();
  void nextTick(() => pane.value?.focus());
}

watch(
  () => props.findSignal,
  () => void openFind(),
);

watch(find.currentMatch, (match) => {
  if (match) pane.value?.revealLine(match.line);
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <ViewerToolbar>
      <template #start>
        <slot name="lead" />
        <span class="font-mono text-2xs tabular-nums">{{ lineCount }} lines</span>
        <span v-if="partlyColoured" class="truncate text-2xs text-[var(--fg-subtle)]">
          Colours shown for the first {{ total.toLocaleString("en-US") }} lines
        </span>
      </template>
      <template #end>
        <IconAction
          :label="wrap ? 'Stop wrapping long lines' : 'Wrap long lines'"
          toggle
          :pressed="wrap"
          @click="wrap = !wrap"
        >
          <WrapText :stroke-width="1.8" />
        </IconAction>
        <IconAction
          label="Find in this file"
          keys="ctrl f"
          :pressed="find.open.value"
          @click="openFind"
        >
          <Search :stroke-width="1.8" />
        </IconAction>
      </template>
    </ViewerToolbar>
    <ViewerNote
      v-if="props.truncation"
      :text="`${truncationNote(props.truncation)}. Download the file to see all of it.`"
      action-label="Download"
      @action="emit('download')"
    />
    <ViewerNote v-if="props.notice" :text="props.notice" />
    <TextFindBar
      v-if="find.open.value"
      ref="findBar"
      v-model:query="find.query.value"
      :label="find.label.value"
      :has-matches="find.matches.value.length > 0"
      @step="find.step"
      @close="closeFind"
    />
    <div class="min-h-0 flex-1">
      <TextLinesPane
        ref="pane"
        :lines="lines"
        :tokens="tokens"
        :language="props.language"
        :wrap="wrap"
        :ranges-for="find.rangesFor"
      />
    </div>
  </div>
</template>
