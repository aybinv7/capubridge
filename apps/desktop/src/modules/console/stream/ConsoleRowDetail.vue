<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "@/lib/toast";
import { Braces, ChevronsDownUp, ChevronsUpDown } from "lucide-vue-next";
import {
  hasObjectArgs,
  previewJson,
  primitiveTone,
  type TreeCommand,
} from "@/lib/console/consolePreview";
import type { ConsoleStreamRow } from "@/lib/console/consoleStream";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useConsoleStore } from "@/stores/console.store";
import type { ConsoleArg } from "@/types/console.types";
import { findJson } from "@/lib/stream-rows/jsonInText";
import { formatClockMs } from "@/shared/components/timeline/stripFormat";
import JsonBlock from "../list/JsonBlock.vue";
import { copyText } from "../list/copyText";
import RowActions from "../list/RowActions.vue";
import type { RowAction } from "../list/streamView.types";
import StackLines from "../list/StackLines.vue";
import { jsStackLines } from "./consoleFrames";
import ConsoleValueNode from "./ConsoleValueNode.vue";
import { consoleLocation, consoleTone } from "./consoleTone";

/**
 * An opened Console row: the arguments as an open value tree (open all, close all, copy as
 * JSON), the call stack folded after the app's own frames, JSON laid out, and where it came
 * from.
 */
const props = defineProps<{
  row: ConsoleStreamRow;
  appOrigin: string | null;
  actions: readonly RowAction[];
}>();

const emit = defineEmits<{ action: [id: string] }>();

const store = useConsoleStore();
const item = computed(() => props.row.item);
const args = computed<readonly ConsoleArg[]>(() =>
  item.value.kind === "entry" ? item.value.entry.args : [],
);
const showTree = computed(() => hasObjectArgs(args.value));
const objects = computed(() => args.value.filter((arg) => arg.kind === "object"));
const JSON_GAP = "\n\n";
const command = ref<TreeCommand>({ token: 0, open: false });

function openAll(open: boolean) {
  command.value = { token: command.value.token + 1, open };
}

function isText(arg: ConsoleArg): boolean {
  return arg.kind === "primitive" && primitiveTone(arg) === "string";
}

async function copyJson() {
  try {
    const parts = await Promise.all(
      objects.value.map((arg) =>
        arg.kind === "object" && arg.objectId
          ? store.objectJson(arg.objectId).catch(() => previewJson(arg))
          : Promise.resolve(previewJson(arg)),
      ),
    );
    await copyText(parts.join(JSON_GAP), parts.length > 1 ? "the objects as JSON" : "as JSON");
  } catch (error) {
    toast.error("Could not copy as JSON", { description: String(error) });
  }
}
const tone = computed(() => consoleTone(item.value));
const location = computed(() => consoleLocation(item.value));
const frames = computed(() => {
  const current = item.value;
  if (current.kind === "entry") return current.entry.frames ?? [];
  if (current.kind === "exception") return current.exception.frames ?? [];
  return [];
});
const stack = computed(() => jsStackLines(frames.value, props.appOrigin));
const plainText = computed(() => {
  const current = item.value;
  if (current.kind === "exception") return current.exception.message;
  if (current.kind === "input") return current.repl.expression;
  if (current.kind === "result") return current.repl.result;
  return current.entry.args.every((arg) => arg.kind === "primitive") ? current.entry.message : null;
});
const json = computed(() =>
  plainText.value !== null && item.value.kind !== "input" ? findJson(plainText.value) : null,
);
const repeats = computed(() =>
  props.row.count > 1
    ? `${props.row.count} times, ${formatClockMs(props.row.firstTime)} to ${formatClockMs(item.value.time)}`
    : null,
);
</script>

<template>
  <div
    class="flex flex-col gap-2 border-y border-border-subtle bg-surface-cut px-3 py-2 shadow-cut"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-[var(--fg-subtle)]">
      <span>{{ tone.name }}</span>
      <span class="font-mono tabular-nums">{{ formatClockMs(item.time) }}</span>
      <span v-if="location" class="min-w-0 truncate font-mono" :title="location">{{
        location
      }}</span>
      <span v-if="repeats" class="tabular-nums">{{ repeats }}</span>
      <span v-if="showTree" class="ml-auto flex items-center gap-0.5">
        <IconAction label="Open every level" size="sm" @click="openAll(true)">
          <ChevronsUpDown :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Close every level" size="sm" @click="openAll(false)">
          <ChevronsDownUp :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Copy as JSON" size="sm" @click="copyJson">
          <Braces :stroke-width="1.8" />
        </IconAction>
      </span>
    </div>
    <div
      v-if="showTree"
      role="tree"
      aria-label="Values of this message"
      class="flex max-h-[60vh] flex-col overflow-auto font-mono text-xs"
    >
      <template v-for="(arg, index) in args" :key="index">
        <p
          v-if="isText(arg)"
          class="py-0.5 pl-[18px] leading-5 break-words whitespace-pre-wrap"
          :class="tone.textClass"
        >
          {{ arg.kind === "primitive" ? arg.text.replace(/%c/g, "") : "" }}
        </p>
        <ConsoleValueNode
          v-else
          :arg="arg"
          :default-open="arg.kind === 'object'"
          :command="command"
        />
      </template>
    </div>
    <template v-else-if="json">
      <p
        v-if="json.before.trim()"
        class="font-mono text-xs whitespace-pre-wrap break-all"
        :class="tone.textClass"
      >
        {{ json.before.trim() }}
      </p>
      <JsonBlock :json="json" />
      <p
        v-if="json.after.trim()"
        class="font-mono text-xs whitespace-pre-wrap break-all text-foreground"
      >
        {{ json.after.trim() }}
      </p>
    </template>
    <pre
      v-else
      class="font-mono text-xs leading-5 whitespace-pre-wrap break-all"
      :class="tone.textClass"
      >{{ plainText }}</pre
    >
    <StackLines v-if="stack.length > 0" :lines="stack" />
    <RowActions :actions="props.actions" @action="emit('action', $event)" />
  </div>
</template>
