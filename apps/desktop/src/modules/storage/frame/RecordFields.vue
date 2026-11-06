<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ArrowUpRight, KeyRound } from "lucide-vue-next";
import { Button, SearchField } from "@capubridge/cladd";
import { toast } from "@/lib/toast";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { cellToText, formatCell } from "@/shared/components/data/grid";
import type { GridColumn } from "@/shared/components/data/grid";
import { jsonInText } from "./jsonInText";

/**
 * Every field of the record, one per line, findable and copyable. Long values wrap; text that
 * holds JSON is shown parsed ("stored as text"), with the raw text one click away. A foreign
 * key offers to open the row it points at. The list is one tab stop: ↑/↓ move between fields
 * and Ctrl+C copies the field in focus. In a wide pane the fields sit in two columns.
 */
const props = defineProps<{
  columns: readonly GridColumn[];
  cells: Readonly<Record<string, unknown>>;
}>();

const emit = defineEmits<{ followForeignKey: [target: string, value: unknown] }>();

const rawText = ref<ReadonlySet<string>>(new Set());

function toggleRaw(columnId: string) {
  const next = new Set(rawText.value);
  if (next.has(columnId)) next.delete(columnId);
  else next.add(columnId);
  rawText.value = next;
}

const query = ref("");
const find = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
const active = ref(0);
const listId = `record-fields-${Math.random().toString(36).slice(2, 8)}`;

const KIND_CLASS: Record<string, string> = {
  null: "italic text-[var(--fg-subtle)]",
  blob: "font-mono text-muted-foreground",
  json: "font-mono text-muted-foreground",
  date: "font-mono tabular-nums",
  number: "font-mono tabular-nums",
  boolean: "font-mono",
  string: "",
};

const parsedText = computed(() => {
  const parsed = new Map<string, string>();
  for (const column of props.columns) {
    const text = jsonInText(props.cells[column.id]);
    if (text !== null) parsed.set(column.id, text);
  }
  return parsed;
});

const fields = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return props.columns
    .filter(
      (column) =>
        !needle ||
        column.title.toLowerCase().includes(needle) ||
        cellToText(props.cells[column.id]).toLowerCase().includes(needle),
    )
    .map((column) => {
      const value = props.cells[column.id];
      const formatted = formatCell(value, column.type);
      const parsed = formatted.kind === "string" ? (parsedText.value.get(column.id) ?? null) : null;
      const showParsed = parsed !== null && !rawText.value.has(column.id);
      const full =
        formatted.kind === "json"
          ? JSON.stringify(value, null, 2)
          : showParsed
            ? parsed
            : formatted.kind === "string"
              ? cellToText(value)
              : formatted.text;
      const kind = showParsed ? "json" : formatted.kind;
      const link =
        column.foreignKey && value !== null && value !== undefined ? column.foreignKey : null;
      return {
        column,
        formatted,
        kind,
        full,
        parsed: parsed !== null,
        showParsed,
        link,
        value,
        copy: cellToText(value),
      };
    });
});

watch(fields, (next) => {
  if (active.value >= next.length) active.value = Math.max(0, next.length - 1);
});

const activeId = computed(() =>
  fields.value[active.value] ? `${listId}-${active.value}` : undefined,
);

function reveal() {
  void nextTick(() => {
    list.value?.querySelector(`#${CSS.escape(`${listId}-${active.value}`)}`)?.scrollIntoView({
      block: "nearest",
    });
  });
}

async function copyActive() {
  const field = fields.value[active.value];
  if (!field) return;
  try {
    await navigator.clipboard.writeText(field.copy);
    toast.success(`Copied ${field.column.title}`);
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

function onListKeydown(event: KeyboardEvent) {
  const last = fields.value.length - 1;
  if (last < 0) return;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && (event.key === "c" || event.key === "C")) {
    if (window.getSelection()?.toString()) return;
    event.preventDefault();
    void copyActive();
    return;
  }
  const next =
    event.key === "ArrowDown"
      ? Math.min(last, active.value + 1)
      : event.key === "ArrowUp"
        ? Math.max(0, active.value - 1)
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? last
            : null;
  if (next === null) return;
  event.preventDefault();
  active.value = next;
  reveal();
}

defineExpose({
  focusFind: () => {
    const input = find.value?.querySelector("input");
    input?.focus();
    input?.select();
  },
});
</script>

<template>
  <div class="@container flex min-h-0 flex-1 flex-col">
    <div ref="find" class="shrink-0 px-3 pt-2 pb-1">
      <SearchField
        v-model="query"
        size="sm"
        class="w-full"
        placeholder="Find a field or value"
        aria-label="Find a field or value"
      />
    </div>
    <dl
      ref="list"
      tabindex="0"
      :aria-activedescendant="activeId"
      aria-label="Fields of the record"
      class="min-h-0 flex-1 content-start overflow-y-auto px-1 pb-2 outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset @3xl:grid @3xl:grid-cols-2 @3xl:gap-x-1"
      @keydown="onListKeydown"
    >
      <div
        v-for="(field, index) in fields"
        :id="`${listId}-${index}`"
        :key="field.column.id"
        class="group/field rounded-control px-2 py-1.5 hover:bg-cladd-surface-hover"
        :class="index === active ? 'bg-cladd-surface-hover' : ''"
        @click="active = index"
      >
        <dt class="flex items-center gap-1.5 text-2xs text-[var(--fg-subtle)]">
          <KeyRound v-if="field.column.primaryKey" :size="11" aria-label="Key" />
          <span class="truncate font-medium text-muted-foreground">{{ field.column.title }}</span>
          <Button
            v-if="field.parsed"
            size="2xs"
            variant="transparent"
            tabindex="-1"
            class="shrink-0 text-[var(--fg-subtle)]"
            @click.stop="toggleRaw(field.column.id)"
          >
            {{ field.showParsed ? "stored as text · show the text" : "show as JSON" }}
          </Button>
          <span class="flex-1" />
          <IconAction
            v-if="field.link"
            :label="`Open the linked row in ${field.link}`"
            size="sm"
            tabindex="-1"
            @click.stop="emit('followForeignKey', field.link, field.value)"
          >
            <ArrowUpRight :stroke-width="1.8" />
          </IconAction>
          <CopyAction
            :value="field.copy"
            :label="`Copy ${field.column.title}`"
            tabindex="-1"
            class="opacity-0 transition-opacity duration-120 group-hover/field:opacity-100 focus-visible:opacity-100"
          />
        </dt>
        <dd
          dir="auto"
          class="mt-0.5 max-h-48 overflow-y-auto text-xs break-words whitespace-pre-wrap text-foreground select-text"
          :class="[KIND_CLASS[field.kind], field.showParsed ? 'max-h-none' : '']"
        >
          {{ field.full }}
        </dd>
        <dd
          v-if="field.formatted.detail"
          class="mt-0.5 font-mono text-2xs text-[var(--fg-subtle)] select-text"
        >
          {{ field.formatted.detail }}
        </dd>
      </div>
      <p v-if="fields.length === 0" class="px-2 py-3 text-xs text-muted-foreground">
        No field or value matches “{{ query }}”.
      </p>
    </dl>
  </div>
</template>
