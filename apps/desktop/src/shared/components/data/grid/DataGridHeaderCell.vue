<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpNarrowWide,
  Binary,
  Braces,
  Calendar,
  CircleDashed,
  Copy,
  EyeOff,
  Filter,
  Group,
  Hash,
  KeyRound,
  Link2,
  MoreHorizontal,
  MoveHorizontal,
  Pin,
  PinOff,
  ToggleLeft,
  Type,
  X,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GridColumn, GridColumnMenuAction, GridColumnType } from "./types";

const props = defineProps<{
  column: GridColumn;
  width: number;
  sort: "asc" | "desc" | null;
  sortable: boolean;
  /** Feature switches the host supports (grouping, filtering, display override). */
  features: { filter: boolean; group: boolean; showAs: boolean };
  grouped: boolean;
  pinned: "left" | "right" | null;
  /** Display override chosen for this column, `null` when auto-detected. */
  showAs: GridColumnType | null;
  stick?: { side: "left" | "right"; offset: number };
}>();

const emit = defineEmits<{
  sort: [];
  /** Ctrl+click picks the column, Shift+click extends the pick to it. */
  select: [extend: boolean];
  action: [action: GridColumnMenuAction];
  resizeStart: [event: PointerEvent];
  autosize: [];
}>();

const TYPE_ICONS: Record<GridColumnType, typeof Hash> = {
  integer: Hash,
  real: Hash,
  text: Type,
  boolean: ToggleLeft,
  json: Braces,
  date: Calendar,
  blob: Binary,
  key: KeyRound,
  unknown: CircleDashed,
};

const SHOW_AS: Array<{ value: GridColumnType | "auto"; label: string }> = [
  { value: "auto", label: "Detected type" },
  { value: "text", label: "Text" },
  { value: "real", label: "Number" },
  { value: "boolean", label: "Boolean (0 / 1)" },
  { value: "json", label: "JSON" },
  { value: "date", label: "Date (ISO or epoch)" },
];

const icon = computed(() => TYPE_ICONS[props.column.type ?? "unknown"]);

const tooltip = computed(() => {
  const parts = [props.column.title];
  if (props.column.typeLabel) parts.push(props.column.typeLabel);
  if (props.column.primaryKey) parts.push("primary key");
  if (props.column.foreignKey) parts.push(`→ ${props.column.foreignKey}`);
  if (props.column.notNull) parts.push("not null");
  return parts.join(" · ");
});

const ariaSort = computed(() => {
  if (props.sort === "asc") return "ascending";
  if (props.sort === "desc") return "descending";
  return "none";
});

const showAsModel = computed({
  get: () => props.showAs ?? "auto",
  set: (value: string) =>
    emit("action", { kind: "showAs", type: value === "auto" ? null : (value as GridColumnType) }),
});

const style = computed(() => {
  const value: Record<string, string> = { width: `${props.width}px` };
  if (props.stick) value[props.stick.side] = `${props.stick.offset}px`;
  return value;
});

const menuOpen = ref(false);

/** A right-click anywhere on the header opens the column's menu, the same as its ⋯ button. */
function onContextMenu(event: MouseEvent) {
  event.preventDefault();
  menuOpen.value = true;
}

function onHeaderClick(event: MouseEvent) {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    emit("select", event.shiftKey);
    return;
  }
  if (props.sortable) emit("sort");
}
</script>

<template>
  <div
    role="columnheader"
    :aria-sort="ariaSort"
    @contextmenu.stop="onContextMenu"
    class="group/header relative flex h-full shrink-0 items-center bg-cladd-surface"
    :class="[
      stick ? 'sticky z-20' : '',
      stick?.side === 'left' ? 'border-r border-cladd-outline' : '',
      stick?.side === 'right' ? 'border-l border-cladd-outline' : '',
    ]"
    :style="style"
    :title="tooltip"
  >
    <button
      type="button"
      tabindex="-1"
      class="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-2 text-left text-cladd-2xs font-semibold tracking-wide text-cladd-fg-soft uppercase transition-colors duration-200"
      :class="sortable ? 'cursor-pointer hover:text-cladd-fg' : 'cursor-default'"
      @click="onHeaderClick"
    >
      <component
        v-if="column.primaryKey || column.glyph !== false"
        :is="column.primaryKey ? KeyRound : icon"
        :size="11"
        class="shrink-0"
        :class="column.primaryKey ? 'text-signal-mark' : 'text-cladd-fg-softer'"
        aria-hidden="true"
      />
      <span class="truncate normal-case">{{ column.title }}</span>
      <Link2
        v-if="column.foreignKey"
        :size="10"
        class="shrink-0 text-signal-select"
        aria-label="foreign key"
      />
      <Pin v-if="pinned" :size="10" class="shrink-0 text-cladd-fg-softer" aria-label="pinned" />
      <Group v-if="grouped" :size="10" class="shrink-0 text-signal-select" aria-label="grouped" />
      <span class="flex-1" />
      <ArrowUp v-if="sort === 'asc'" :size="11" class="shrink-0 text-cladd-fg" />
      <ArrowDown v-else-if="sort === 'desc'" :size="11" class="shrink-0 text-cladd-fg" />
    </button>

    <DropdownMenu v-model:open="menuOpen">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          tabindex="-1"
          :aria-label="`${column.title} column options`"
          class="mr-1 flex size-5 shrink-0 items-center justify-center rounded-cladd-3xs text-cladd-fg-softer opacity-0 transition-opacity duration-200 group-hover/header:opacity-100 hover:bg-cladd-surface-hover hover:text-cladd-fg focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal :size="12" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-56">
        <DropdownMenuLabel class="normal-case">{{ column.title }}</DropdownMenuLabel>
        <template v-if="sortable">
          <DropdownMenuItem @select="emit('action', { kind: 'sort', direction: 'asc' })">
            <ArrowUpNarrowWide /> Sort ascending
          </DropdownMenuItem>
          <DropdownMenuItem @select="emit('action', { kind: 'sort', direction: 'desc' })">
            <ArrowDownWideNarrow /> Sort descending
          </DropdownMenuItem>
          <DropdownMenuItem v-if="sort" @select="emit('action', { kind: 'sort', direction: null })">
            <X /> Clear sort
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>
        <DropdownMenuItem v-if="features.filter" @select="emit('action', { kind: 'filter' })">
          <Filter /> Filter this column…
        </DropdownMenuItem>
        <DropdownMenuItem v-if="features.group" @select="emit('action', { kind: 'group' })">
          <Group /> {{ grouped ? "Ungroup" : "Group by this column" }}
        </DropdownMenuItem>
        <DropdownMenuSub v-if="features.showAs">
          <DropdownMenuSubTrigger><Braces /> Show values as</DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-48">
            <DropdownMenuRadioGroup v-model="showAsModel">
              <DropdownMenuRadioItem
                v-for="option in SHOW_AS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator v-if="features.filter || features.group || features.showAs" />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Pin /> Pin column</DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-40">
            <DropdownMenuItem
              :disabled="pinned === 'left'"
              @select="emit('action', { kind: 'pin', side: 'left' })"
            >
              Pin to left
            </DropdownMenuItem>
            <DropdownMenuItem
              :disabled="pinned === 'right'"
              @select="emit('action', { kind: 'pin', side: 'right' })"
            >
              Pin to right
            </DropdownMenuItem>
            <DropdownMenuItem v-if="pinned" @select="emit('action', { kind: 'pin', side: null })">
              <PinOff /> Unpin
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem @select="emit('action', { kind: 'hide' })"
          ><EyeOff /> Hide column</DropdownMenuItem
        >
        <DropdownMenuItem @select="emit('autosize')"
          ><MoveHorizontal /> Fit to content</DropdownMenuItem
        >
        <DropdownMenuItem @select="emit('action', { kind: 'autosizeAll' })">
          <MoveHorizontal /> Fit all columns
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="emit('action', { kind: 'copyName' })"
          ><Copy /> Copy column name</DropdownMenuItem
        >
      </DropdownMenuContent>
    </DropdownMenu>

    <span
      role="separator"
      aria-orientation="vertical"
      :aria-label="`Resize ${column.title}`"
      class="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize after:absolute after:inset-y-2 after:left-1/2 after:w-px after:bg-cladd-outline hover:after:bg-cladd-primary"
      @pointerdown.stop.prevent="emit('resizeStart', $event)"
      @dblclick.stop="emit('autosize')"
    />
  </div>
</template>
