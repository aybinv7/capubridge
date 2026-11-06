<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { Search, WrapText, Copy } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { toast } from "@/lib/toast";
import TextFindBar from "./TextFindBar.vue";
import TextLinesPane from "./TextLinesPane.vue";
import ViewerNote from "./ViewerNote.vue";
import ViewerToolbar from "./ViewerToolbar.vue";
import { splitLines } from "./textLines";
import { useHighlightedLines } from "./useHighlightedLines";
import { useTextFind } from "./useTextFind";
import type { TextLanguage } from "./codeLanguage";

const props = withDefaults(
  defineProps<{
    text: string;
    language: TextLanguage;
    truncationNote?: string | null;
    findSignal: number;
    notice?: string;
    /** Where the wrap choice is remembered, so each screen keeps its own. */
    wrapStorageKey?: string;
    /** What the find button says it searches ("Find in this file", "Find in the response"). */
    findLabel?: string;
  }>(),
  {
    truncationNote: null,
    notice: undefined,
    wrapStorageKey: "capubridge.files.viewer.wrap",
    findLabel: "Find in this file",
  },
);

const emit = defineEmits<{ download: [] }>();

const wrap = useLocalStorage(props.wrapStorageKey, false);

async function copyAll() {
  try {
    await navigator.clipboard.writeText(props.text);
    toast.success("Copied");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}
const pane = ref<InstanceType<typeof TextLinesPane> | null>(null);
const findBar = ref<InstanceType<typeof TextFindBar> | null>(null);

const lines = computed(() => splitLines(props.text));
const { tokens, total } = useHighlightedLines(lines, toRef(props, "language"));
const find = useTextFind(lines);

const lineCount = computed(() => {
  const count = lines.value.length;
  return `${count.toLocaleString("en-US")} ${count === 1 ? "line" : "lines"}`;
});
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
        <span class="font-mono text-2xs tabular-nums">{{ lineCount }}</span>
        <span v-if="partlyColoured" class="truncate text-2xs text-[var(--fg-subtle)]">
          Colours shown for the first {{ total.toLocaleString("en-US") }} lines
        </span>
      </template>
      <template #end>
        <IconAction label="Copy all" @click="copyAll">
          <Copy :stroke-width="1.8" />
        </IconAction>
        <IconAction
          :label="wrap ? 'Stop wrapping long lines' : 'Wrap long lines'"
          toggle
          :pressed="wrap"
          @click="wrap = !wrap"
        >
          <WrapText :stroke-width="1.8" />
        </IconAction>
        <IconAction
          :label="props.findLabel"
          keys="ctrl f"
          :pressed="find.open.value"
          @click="openFind"
        >
          <Search :stroke-width="1.8" />
        </IconAction>
      </template>
    </ViewerToolbar>
    <ViewerNote
      v-if="props.truncationNote"
      :text="`${props.truncationNote}. Download the file to see all of it.`"
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
