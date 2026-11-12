<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { ChevronRight, LoaderCircle } from "lucide-vue-next";
import {
  PREVIEW_TONE_CLASS,
  oneLinePreview,
  primitiveTone,
  valuePreview,
  type PreviewTone,
  type TreeCommand,
} from "@/lib/console/consolePreview";
import { useConsoleStore } from "@/stores/console.store";
import type { ConsoleArg, ConsoleProp } from "@/types/console.types";
import PreviewText from "./PreviewText.vue";

defineOptions({ name: "ConsoleValueNode" });

const CHILD_PAGE = 100;
const OPEN_ALL_DEPTH = 4;

/**
 * One value of a console call as a tree line: name, then the value's preview, with its own
 * properties one level down when opened. Properties come live from the page when the value
 * still has a handle there, else from the preview the message carried.
 */
const props = withDefaults(
  defineProps<{
    name?: string | null;
    arg: ConsoleArg;
    depth?: number;
    defaultOpen?: boolean;
    command?: TreeCommand;
  }>(),
  { name: null, depth: 0, defaultOpen: false, command: () => ({ token: 0, open: false }) },
);

const store = useConsoleStore();
const open = ref(false);
const fetched = shallowRef<ConsoleProp[] | null>(null);
const loading = ref(false);
const failed = ref<string | null>(null);
const shown = ref(CHILD_PAGE);

const object = computed(() => (props.arg.kind === "object" ? props.arg : null));
const expandable = computed(
  () => object.value !== null && (object.value.properties.length > 0 || !!object.value.objectId),
);
const children = computed(() => fetched.value ?? object.value?.properties ?? []);
const visibleChildren = computed(() => children.value.slice(0, shown.value));
const partial = computed(() => fetched.value === null && object.value?.overflow === true);
const nameTone = computed<PreviewTone>(() => (/^\d+$/.test(props.name ?? "") ? "index" : "key"));
const preview = computed(() => oneLinePreview(valuePreview(props.arg, false)));
const leafTone = computed<PreviewTone>(() =>
  props.arg.kind === "primitive" ? primitiveTone(props.arg) : "type",
);
const leafText = computed(() => {
  if (props.arg.kind !== "primitive") return "";
  return leafTone.value === "string" && props.name !== null
    ? `'${props.arg.text}'`
    : props.arg.text;
});

async function load() {
  const id = object.value?.objectId;
  if (!id || fetched.value !== null || loading.value) return;
  loading.value = true;
  failed.value = null;
  try {
    const fresh = await store.fetchObjectProperties(id);
    if (fresh.length > 0 || (object.value?.properties.length ?? 0) === 0) fetched.value = fresh;
  } catch (error) {
    failed.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function setOpen(next: boolean) {
  if (!expandable.value) return;
  open.value = next;
  if (next) void load();
}

function toggle() {
  setOpen(!open.value);
}

setOpen(
  props.defaultOpen ||
    (props.command.token > 0 && props.command.open && props.depth < OPEN_ALL_DEPTH),
);

watch(
  () => props.command.token,
  () => setOpen(props.command.open ? props.depth < OPEN_ALL_DEPTH : props.defaultOpen),
);
</script>

<template>
  <div role="treeitem" :aria-expanded="expandable ? open : undefined">
    <div
      class="flex min-h-5 items-start gap-1 rounded-inner pr-2 leading-5"
      :class="expandable ? 'cursor-pointer hover:bg-cladd-surface-hover' : ''"
      @click.stop="toggle"
    >
      <span class="flex h-5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
        <ChevronRight
          v-if="expandable"
          class="size-3 text-[var(--fg-subtle)] transition-transform duration-150 ease-cladd-settle motion-reduce:transition-none"
          :class="open ? 'rotate-90' : ''"
        />
      </span>
      <span class="min-w-0 flex-1" :class="object ? 'truncate' : 'break-all whitespace-pre-wrap'">
        <template v-if="props.name !== null">
          <span :class="PREVIEW_TONE_CLASS[nameTone]">{{ props.name }}</span>
          <span class="text-[var(--fg-subtle)]">: </span>
        </template>
        <PreviewText v-if="object" :segments="preview" />
        <span v-else :class="PREVIEW_TONE_CLASS[leafTone]">{{ leafText }}</span>
      </span>
      <LoaderCircle
        v-if="loading"
        class="mt-1 size-3 shrink-0 animate-spin text-[var(--fg-subtle)]"
        aria-label="Reading from the page"
      />
    </div>
    <div v-if="open" role="group" class="ml-[7px] border-l border-border-subtle pl-2">
      <ConsoleValueNode
        v-for="child in visibleChildren"
        :key="child.name"
        :name="child.name"
        :arg="child.value"
        :depth="props.depth + 1"
        :command="props.command"
      />
      <button
        v-if="children.length > shown"
        type="button"
        class="ml-4 py-0.5 text-2xs text-muted-foreground hover:text-foreground"
        @click.stop="shown += CHILD_PAGE"
      >
        Show {{ Math.min(CHILD_PAGE, children.length - shown) }} more of
        {{ children.length.toLocaleString() }}
      </button>
      <p v-if="partial" class="ml-4 text-2xs text-[var(--fg-subtle)]">
        More properties exist; the page no longer holds this value, so only the preview is left.
      </p>
      <p v-if="failed" class="ml-4 text-2xs text-error">Could not read it: {{ failed }}</p>
      <p
        v-if="!loading && !failed && children.length === 0"
        class="ml-4 text-2xs text-[var(--fg-subtle)]"
      >
        No properties
      </p>
    </div>
  </div>
</template>
