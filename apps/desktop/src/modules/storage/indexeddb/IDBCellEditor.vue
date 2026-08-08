<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { getLocalTimeZone, parseDate } from "@internationalized/date";
import type { DateValue } from "reka-ui";
import { CalendarDays, Minus, Plus } from "lucide-vue-next";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const props = defineProps<{
  value: unknown;
  isDate: boolean;
  isNumber: boolean;
}>();

const emit = defineEmits<{
  commit: [value: unknown];
  cancel: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const text = ref(toEditorText(props.value));
const isCalendarOpen = ref(props.isDate);
const isDateTypingEnabled = ref(false);
const numberStep = computed(() =>
  typeof props.value === "number" && !Number.isInteger(props.value) ? 0.1 : 1,
);

const calendarValue = computed<DateValue | undefined>(() => {
  if (!props.isDate || !text.value) return undefined;
  try {
    return parseDate(toDateInput(text.value));
  } catch {
    return undefined;
  }
});

onMounted(async () => {
  if (props.isDate) return;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
});

function toEditorText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toDateInput(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    return new Date(milliseconds).toISOString().slice(0, 10);
  }
  return value;
}

function fromDateInput(dateInput: string): unknown {
  if (!dateInput) return null;
  if (typeof props.value === "number") {
    const milliseconds = new Date(`${dateInput}T00:00:00.000Z`).getTime();
    return props.value > 10_000_000_000 ? milliseconds : Math.floor(milliseconds / 1000);
  }
  if (typeof props.value === "string" && props.value.includes("T")) {
    const previous = new Date(props.value);
    const next = new Date(`${dateInput}T00:00:00.000Z`);
    if (!Number.isNaN(previous.getTime())) {
      next.setUTCHours(
        previous.getUTCHours(),
        previous.getUTCMinutes(),
        previous.getUTCSeconds(),
        previous.getUTCMilliseconds(),
      );
    }
    return props.value.includes(".")
      ? next.toISOString()
      : next.toISOString().replace(/\.\d+Z$/, "Z");
  }
  return dateInput;
}

function commit() {
  if (props.isDate) {
    emit("commit", fromDateInput(text.value));
    return;
  }
  try {
    emit("commit", JSON.parse(text.value));
  } catch {
    emit("commit", text.value);
  }
}

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

function nudgeNumber(direction: 1 | -1) {
  const current = Number(text.value);
  const base = Number.isFinite(current) ? current : 0;
  const next = base + direction * numberStep.value;
  text.value = numberStep.value < 1 ? next.toFixed(1) : String(next);
  inputRef.value?.focus();
}

function onBlur() {
  if (props.isDate && isCalendarOpen.value) return;
  commit();
}
</script>

<template>
  <div v-if="isDate" class="flex items-center gap-1" @click.stop>
    <input
      ref="inputRef"
      v-model="text"
      :readonly="!isDateTypingEnabled"
      placeholder="YYYY-MM-DD"
      class="-mx-1 w-full min-w-0 rounded border border-primary/50 bg-transparent px-1 font-mono text-foreground text-xs outline-none"
      @keydown.enter.prevent="commit"
      @keydown.escape.prevent="emit('cancel')"
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

  <div v-else-if="isNumber" class="flex items-center gap-0.5" @click.stop>
    <button
      class="shrink-0 rounded text-muted-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground"
      title="Decrease"
      @mousedown.prevent
      @click="nudgeNumber(-1)"
    >
      <Minus :size="11" />
    </button>
    <input
      ref="inputRef"
      v-model="text"
      inputmode="decimal"
      class="w-full min-w-0 rounded border border-primary/50 bg-transparent px-1 text-center font-mono text-foreground text-xs outline-none"
      @keydown.enter.prevent="commit"
      @keydown.escape.prevent="emit('cancel')"
      @keydown.up.prevent="nudgeNumber(1)"
      @keydown.down.prevent="nudgeNumber(-1)"
      @blur="onBlur"
    />
    <button
      class="shrink-0 rounded text-muted-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground"
      title="Increase"
      @mousedown.prevent
      @click="nudgeNumber(1)"
    >
      <Plus :size="11" />
    </button>
  </div>

  <input
    v-else
    ref="inputRef"
    v-model="text"
    class="-mx-1 w-full rounded border border-primary/50 bg-transparent px-1 font-mono text-foreground text-xs outline-none"
    @click.stop
    @keydown.enter.prevent="commit"
    @keydown.escape.prevent="emit('cancel')"
    @blur="onBlur"
  />
</template>
