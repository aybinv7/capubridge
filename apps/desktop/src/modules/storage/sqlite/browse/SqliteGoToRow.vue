<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { Hash } from "lucide-vue-next";
import { Button, FieldError, Input, Popover } from "@capubridge/cladd";
import { bindingTokens } from "@/lib/commands/keymap";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { keyValueOf, type RowTarget } from "../quick/sqliteKeyInput";

/**
 * Go to a row (Ctrl+G): one field per key column, or `#40` in the first for a row number. The
 * row is found under the current order and filters and opened in the record pane.
 */
const props = defineProps<{
  keyColumns: readonly string[];
  /** Why no row can be reached here (grouped rows), or `null`. */
  blocked: string | null;
}>();

const emit = defineEmits<{ go: [target: RowTarget] }>();

const open = ref(false);
const values = ref<string[]>([]);
const form = ref<HTMLElement | null>(null);
const fields = computed(() => (props.keyColumns.length ? props.keyColumns : ["row number"]));

const target = computed<RowTarget | null>(() => {
  const first = (values.value[0] ?? "").trim();
  const numbered = /^#?\s*(\d+)$/.exec(first);
  if (first.startsWith("#") || props.keyColumns.length === 0) {
    const row = numbered ? Number(numbered[1]) : 0;
    return row >= 1 ? { kind: "number", row } : null;
  }
  const typed = props.keyColumns.map((_, index) => (values.value[index] ?? "").trim());
  if (typed.some((value) => value === "")) return null;
  return { kind: "key", values: typed.map(keyValueOf) };
});

function show() {
  if (props.blocked) return;
  values.value = fields.value.map(() => "");
  open.value = true;
  void nextTick(() =>
    requestAnimationFrame(() => form.value?.querySelector<HTMLInputElement>("input")?.focus()),
  );
}

function go() {
  if (!target.value) return;
  emit("go", target.value);
  open.value = false;
}

function setValue(index: number, value: string) {
  const next = [...values.value];
  next[index] = value;
  values.value = next;
}

defineExpose({ open: show });
</script>

<template>
  <Popover v-model:open="open" position="top-end" content-class-name="w-80 p-3">
    <template #trigger>
      <IconAction
        label="Go to a row"
        :hint="blocked ?? 'By its key, or # and a row number'"
        :keys="bindingTokens('mod+g')"
        size="sm"
        :disabled="blocked !== null"
        @click.stop="show"
      >
        <Hash :stroke-width="1.8" />
      </IconAction>
    </template>
    <form ref="form" class="flex flex-col gap-2.5" @submit.prevent="go">
      <p class="text-cladd-xs text-cladd-fg-soft">
        {{
          keyColumns.length
            ? "Go to the row with this key, or type # and a row number."
            : "This table has no key: go to a row by its number."
        }}
      </p>
      <label
        v-for="(field, index) in fields"
        :key="field"
        class="flex items-center gap-2 text-cladd-xs text-cladd-fg-soft"
      >
        <span class="w-24 shrink-0 truncate font-mono">{{ field }}</span>
        <Input
          :model-value="values[index] ?? ''"
          size="sm"
          class="min-w-0 flex-1 font-mono"
          :placeholder="index === 0 ? (keyColumns.length ? '4182 or #40' : '40') : ''"
          :disabled="index > 0 && (values[0] ?? '').trim().startsWith('#')"
          @update:model-value="setValue(index, String($event ?? ''))"
        />
      </label>
      <FieldError v-if="values.some((value) => value.trim() !== '') && !target">
        Fill in every key column, or type # and a row number.
      </FieldError>
      <div class="flex justify-end">
        <Button size="sm" variant="solid-fill" color="brand" type="submit" :disabled="!target">
          Go
        </Button>
      </div>
    </form>
  </Popover>
</template>
