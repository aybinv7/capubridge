<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  ListboxContent,
  ListboxFilter,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
  ListboxRoot,
} from "reka-ui";
import { Columns3, Database, Eye, Hash, Search, Table2 } from "lucide-vue-next";
import { Popup, PopupContent } from "@capubridge/cladd";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { bindingTokens } from "@/lib/commands/keymap";
import type { SqliteTableInfo } from "@/types/sqlite.types";
import { quickOpenGroups, type QuickOpenItem } from "./sqliteQuickOpenModel";

export type QuickOpenMode = "open" | "structure" | "sql";

/**
 * Go to a table (Ctrl+P): this database's recent and pinned tables when nothing is typed, then
 * tables, columns and other databases ranked as you type, and `table:key` to land on a row.
 * Enter opens, Ctrl+Enter opens the structure, Alt+Enter the SQL of the table.
 */
const props = defineProps<{
  tables: readonly SqliteTableInfo[];
  columns: readonly { table: string; column: string }[] | null;
  recents: readonly string[];
  pinned: readonly string[];
  databases: readonly { sourceId: string; name: string; detail: string }[];
  databaseName: string;
}>();

const open = defineModel<boolean>("open", { required: true });

const emit = defineEmits<{
  choose: [item: QuickOpenItem, mode: QuickOpenMode];
  /** Asked once per opening, so the columns are read only when someone looks. */
  wantColumns: [];
}>();

const query = ref("");
const highlighted = ref<string | undefined>(undefined);

const groups = computed(() =>
  quickOpenGroups({
    query: query.value,
    tables: props.tables,
    columns: props.columns,
    recents: props.recents,
    pinned: props.pinned,
    databases: props.databases,
  }),
);
const byId = computed(() => {
  const map = new Map<string, QuickOpenItem>();
  for (const group of groups.value) for (const item of group.items) map.set(item.id, item);
  return map;
});

watch(open, async (isOpen) => {
  if (!isOpen) return;
  query.value = "";
  emit("wantColumns");
  await nextTick();
  requestAnimationFrame(() =>
    document.querySelector<HTMLInputElement>("[data-sqlite-quick-input]")?.focus(),
  );
});

function choose(id: unknown, mode: QuickOpenMode = "open") {
  const item = typeof id === "string" ? byId.value.get(id) : undefined;
  if (!item) return;
  open.value = false;
  emit("choose", item, mode);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey || event.altKey)) return;
  event.preventDefault();
  event.stopPropagation();
  choose(highlighted.value, event.altKey ? "sql" : "structure");
}

function iconOf(item: QuickOpenItem) {
  if (item.kind === "database") return Database;
  if (item.kind === "column") return Columns3;
  if (item.kind === "row") return Hash;
  return item.view ? Eye : Table2;
}

function titleOf(item: QuickOpenItem): string {
  if (item.kind === "database") return item.name;
  if (item.kind === "row") return `${item.table} · row ${item.key}`;
  if (item.kind === "column") return item.column;
  return item.table;
}

function detailOf(item: QuickOpenItem): string {
  if (item.kind === "database") return item.detail;
  if (item.kind === "column") return item.table;
  if (item.kind === "row") return "Go to the row";
  return `${item.rows.toLocaleString("en-US")} rows${item.view ? " · view" : ""}`;
}
</script>

<template>
  <Popup v-model:open="open" :header="false" :close-button="false" aria-label="Go to a table">
    <PopupContent content-class-name="!p-0">
      <ListboxRoot
        v-model:highlighted="highlighted"
        highlight-on-hover
        class="flex min-h-0 flex-col"
        @update:model-value="choose"
        @keydown.capture="onKeydown"
      >
        <div class="flex h-12 items-center gap-3 px-4">
          <Search :size="15" :stroke-width="1.8" class="shrink-0 text-muted-foreground" />
          <ListboxFilter
            v-model="query"
            data-sqlite-quick-input
            auto-focus
            :placeholder="`Go to a table in ${databaseName}, a column, or table:key`"
            class="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-[var(--fg-subtle)]"
          />
          <KeyCaps keys="esc" />
        </div>
        <div class="h-px bg-border-subtle" />
        <ListboxContent class="max-h-[420px] overflow-y-auto overscroll-contain p-2">
          <ListboxGroup v-for="group in groups" :key="group.label" class="mb-1.5 last:mb-0">
            <ListboxGroupLabel class="px-2.5 pt-1.5 pb-1 text-2xs text-[var(--fg-subtle)]">
              {{ group.label }}
            </ListboxGroupLabel>
            <ListboxItem
              v-for="item in group.items"
              :key="item.id"
              :value="item.id"
              class="group flex h-9 cursor-default items-center gap-3 rounded-control px-2 text-sm text-muted-foreground outline-none data-[highlighted]:bg-cladd-surface-hover data-[highlighted]:text-foreground"
            >
              <component :is="iconOf(item)" :size="14" :stroke-width="1.8" class="shrink-0" />
              <span class="truncate font-mono text-xs text-foreground">{{ titleOf(item) }}</span>
              <span class="min-w-0 flex-1 truncate text-2xs text-[var(--fg-subtle)]">
                {{ detailOf(item) }}
              </span>
            </ListboxItem>
          </ListboxGroup>
          <p v-if="groups.length === 0" class="px-4 py-10 text-center text-sm text-foreground">
            Nothing matches “{{ query }}”
          </p>
        </ListboxContent>
        <div
          class="flex h-9 items-center gap-4 border-t border-border-subtle px-4 text-2xs text-muted-foreground"
        >
          <span class="flex items-center gap-1.5"><KeyCaps keys="enter" /> open</span>
          <span class="flex items-center gap-1.5"
            ><KeyCaps :keys="bindingTokens('mod+enter')" /> structure</span
          >
          <span class="flex items-center gap-1.5"
            ><KeyCaps :keys="bindingTokens('alt+enter')" /> SQL</span
          >
          <span class="flex-1" />
          <span> <span class="font-mono text-foreground">table:key</span> goes to a row </span>
        </div>
      </ListboxRoot>
    </PopupContent>
  </Popup>
</template>
