<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from "vue";
import { parseDate, getLocalTimeZone } from "@internationalized/date";
import type { DateValue } from "reka-ui";
import { Minus, Plus, CalendarDays, Check, X } from "lucide-vue-next";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import JsonEditor from "@/shared/components/data/JsonEditor.vue";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import {
  type SqliteEditorKind,
  toEditorString,
  toDateInputValue,
  fromDateInputValue,
  toBooleanValue,
  fromBooleanValue,
  parseEditorValue,
  numberStep,
} from "./cellEditorTypes";

const props = defineProps<{
  kind: SqliteEditorKind;
  /** The value currently stored in the cell. */
  value: unknown;
  column?: SqliteColumnInfo;
}>();

const emit = defineEmits<{
  /** Commit a new value for the cell. */
  commit: [value: unknown];
  cancel: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const text = ref(
  props.kind === "date" ? toDateInputValue(props.value) : toEditorString(props.value),
);
const jsonText = ref(toEditorString(props.value));

onMounted(async () => {
  await nextTick();
  if (props.kind === "date") {
    isCalendarOpen.value = true;
    return;
  }
  inputRef.value?.focus();
  inputRef.value?.select();
});

// ─── Number ──────────────────────────────────────────────────────────────────
const step = computed(() => numberStep(props.column));

function nudge(direction: 1 | -1) {
  const current = Number(text.value);
  const base = Number.isFinite(current) ? current : 0;
  const next = base + direction * step.value;
  // Re-round to the step so repeated 0.1 nudges don't drift into 0.30000000000000004.
  const decimals = step.value < 1 ? 1 : 0;
  text.value = next.toFixed(decimals);
  inputRef.value?.focus();
}

// ─── Date ────────────────────────────────────────────────────────────────────
const isCalendarOpen = ref(false);
const isDateTypingEnabled = ref(false);

const calendarValue = computed<DateValue | undefined>(() => {
  const iso = text.value;
  if (!iso) return undefined;
  try {
    return parseDate(iso);
  } catch {
    return undefined;
  }
});

function onCalendarSelect(next: DateValue | undefined) {
  if (!next) return;
  text.value = next.toDate(getLocalTimeZone()).toISOString().slice(0, 10);
  isCalendarOpen.value = false;
  commit();
}

function enableDateTyping() {
  if (!isCalendarOpen.value) return;
  isDateTypingEnabled.value = true;
  void nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

// ─── Boolean ─────────────────────────────────────────────────────────────────
const boolValue = ref(toBooleanValue(props.value));

function onBoolChange(next: boolean) {
  boolValue.value = next;
  emit("commit", fromBooleanValue(next, props.value));
}

// ─── Commit / cancel ─────────────────────────────────────────────────────────
function commit() {
  if (props.kind === "date") {
    emit("commit", fromDateInputValue(text.value, props.value));
    return;
  }
  if (props.kind === "json") {
    emit("commit", parseEditorValue("json", jsonText.value));
    return;
  }
  emit("commit", parseEditorValue(props.kind, text.value));
}

function cancel() {
  emit("cancel");
}

/** Blur commits, matching the plain-text editor. The calendar and JSON popovers
 *  manage their own lifecycle, so they opt out. */
function onBlur() {
  if (isCalendarOpen.value) return;
  commit();
}
</script>

<template>
  <!-- Boolean: a switch, committed immediately on toggle -->
  <div v-if="kind === 'boolean'" class="flex items-center gap-2" @click.stop>
    <Switch :model-value="boolValue" @update:model-value="onBoolChange" />
    <span class="font-mono text-[10px] text-muted-foreground/60">
      {{ boolValue ? "true" : "false" }}
    </span>
    <button
      class="text-muted-foreground/40 transition-colors hover:text-foreground"
      title="Done"
      @click="cancel"
    >
      <X :size="11" />
    </button>
  </div>

  <!-- JSON / long text: popover with the full editor -->
  <Popover v-else-if="kind === 'json'" :open="true" @update:open="(o) => !o && cancel()">
    <PopoverTrigger as-child>
      <span class="truncate font-mono text-[11px] text-primary" @click.stop>
        {{ text || "NULL" }}
      </span>
    </PopoverTrigger>
    <PopoverContent class="w-[520px] p-0" align="start" @click.stop>
      <div class="h-[280px] overflow-hidden p-2">
        <JsonEditor :value="jsonText" @update:value="jsonText = $event" />
      </div>
      <div class="flex justify-end gap-1 border-border/30 border-t px-2 py-1.5">
        <button
          class="rounded px-2 py-0.5 text-[11px] text-muted-foreground/60 hover:text-foreground"
          @click="cancel"
        >
          Cancel
        </button>
        <button
          class="flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/25"
          @click="commit"
        >
          <Check :size="10" />
          Save
        </button>
      </div>
    </PopoverContent>
  </Popover>

  <!-- Date: text box with a calendar popover -->
  <div v-else-if="kind === 'date'" class="flex items-center gap-1" @click.stop>
    <input
      ref="inputRef"
      v-model="text"
      :readonly="!isDateTypingEnabled"
      placeholder="YYYY-MM-DD"
      class="-mx-1 w-full min-w-0 rounded border border-primary/50 bg-transparent px-1 font-mono text-foreground text-xs outline-none"
      @keydown.enter.prevent="commit"
      @keydown.escape.prevent="cancel"
      @blur="onBlur"
      @dblclick.stop="enableDateTyping"
    />
    <Popover v-model:open="isCalendarOpen">
      <PopoverTrigger as-child>
        <button
          class="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
          title="Pick a date"
          @mousedown.prevent
        >
          <CalendarDays :size="12" />
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="end">
        <Calendar
          :model-value="calendarValue"
          layout="month-and-year"
          @update:model-value="onCalendarSelect"
        />
      </PopoverContent>
    </Popover>
  </div>

  <!-- Number: stepper -->
  <div v-else-if="kind === 'number'" class="flex items-center gap-0.5" @click.stop>
    <button
      class="shrink-0 rounded text-muted-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground"
      title="Decrease"
      @mousedown.prevent
      @click="nudge(-1)"
    >
      <Minus :size="11" />
    </button>
    <input
      ref="inputRef"
      v-model="text"
      inputmode="decimal"
      class="w-full min-w-0 rounded border border-primary/50 bg-transparent px-1 text-center font-mono text-foreground text-xs outline-none"
      @keydown.enter.prevent="commit"
      @keydown.escape.prevent="cancel"
      @keydown.up.prevent="nudge(1)"
      @keydown.down.prevent="nudge(-1)"
      @blur="onBlur"
    />
    <button
      class="shrink-0 rounded text-muted-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground"
      title="Increase"
      @mousedown.prevent
      @click="nudge(1)"
    >
      <Plus :size="11" />
    </button>
  </div>

  <!-- Text -->
  <input
    v-else
    ref="inputRef"
    v-model="text"
    class="-mx-1 w-full rounded border border-primary/50 bg-transparent px-1 font-mono text-foreground text-xs outline-none"
    @click.stop
    @keydown.enter.prevent="commit"
    @keydown.escape.prevent="cancel"
    @blur="onBlur"
  />
</template>
