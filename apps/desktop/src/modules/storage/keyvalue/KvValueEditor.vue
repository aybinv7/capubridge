<script setup lang="ts">
import { computed, ref } from "vue";
import { refDebounced } from "@vueuse/core";
import { Button, Segmented, SegmentedButton } from "@capubridge/cladd";
import JsonEditor from "@/shared/components/data/JsonEditor.vue";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import { formatJson, modeNote, switchDraft, type KvEditorMode } from "./kvEdit";
import type { KvSourceKind } from "./kvModel";
import KvTextEditor from "./KvTextEditor.vue";

/**
 * The value editor: Text saves exactly what is typed; JSON checks it first and can indent it
 * on request ("Format JSON"), never on its own.
 */
const props = defineProps<{
  kind: KvSourceKind;
  keyLabel: string;
  /** What Save does with the value's line breaks, when that needs saying. */
  lineNote?: string | null;
}>();

const mode = defineModel<KvEditorMode>("mode", { required: true });
const draft = defineModel<string>("draft", { required: true });

const json = ref<InstanceType<typeof JsonEditor> | null>(null);
const text = ref<InstanceType<typeof KvTextEditor> | null>(null);

const settled = refDebounced(draft, 200);
const formatted = computed(() => (mode.value === "json" ? formatJson(settled.value) : null));
const canFormat = computed(() => formatted.value !== null && formatted.value !== settled.value);

function setMode(next: KvEditorMode) {
  if (next === mode.value) return;
  draft.value = switchDraft(props.kind, next, draft.value);
  mode.value = next;
}

function format() {
  const next = formatJson(draft.value);
  if (next !== null) draft.value = next;
}

defineExpose({
  focus: () => (mode.value === "json" ? json.value?.textareaRef?.focus() : text.value?.focus()),
  focusFind: () =>
    mode.value === "json" ? json.value?.focusFilter() : void text.value?.openFind(),
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-1.5">
    <div class="flex shrink-0 items-center gap-2">
      <Segmented size="xs" active-variant="solid" aria-label="Edit the value as">
        <SegmentedButton :active="mode === 'text'" :class="SEGMENT_TEXT" @click="setMode('text')">
          Text
        </SegmentedButton>
        <SegmentedButton :active="mode === 'json'" :class="SEGMENT_TEXT" @click="setMode('json')">
          JSON
        </SegmentedButton>
      </Segmented>
      <span class="min-w-0 flex-1 truncate text-2xs text-[var(--fg-subtle)]">
        {{ modeNote(kind, mode) }}
      </span>
      <Button
        v-if="mode === 'json'"
        size="2xs"
        variant="transparent"
        :disabled="!canFormat"
        @click="format"
      >
        Format JSON
      </Button>
    </div>
    <p v-if="lineNote" class="shrink-0 text-2xs text-muted-foreground">{{ lineNote }}</p>
    <div class="min-h-0 flex-1">
      <JsonEditor v-if="mode === 'json'" ref="json" v-model:value="draft" />
      <KvTextEditor v-else ref="text" v-model="draft" :label="`Value of ${keyLabel}`" />
    </div>
  </div>
</template>
