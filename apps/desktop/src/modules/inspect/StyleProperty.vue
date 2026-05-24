<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue";
import type { CSSProperty } from "utils";

const props = defineProps<{
  property: CSSProperty;
  editable: boolean;
  indent?: number;
}>();

const emit = defineEmits<{
  change: [next: { name: string; value: string; disabled: boolean; important: boolean }];
  remove: [];
}>();

const editingName = ref(false);
const editingValue = ref(false);
const nameDraft = ref(props.property.name);
const valueDraft = ref(props.property.value);
const nameInput = ref<HTMLInputElement | null>(null);
const valueInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.property,
  (p) => {
    if (!editingName.value) nameDraft.value = p.name;
    if (!editingValue.value) valueDraft.value = p.value;
  },
);

const disabled = computed(() => !!props.property.disabled);
const important = computed(() => !!props.property.important);

function startEditName() {
  if (!props.editable) return;
  editingName.value = true;
  nameDraft.value = props.property.name;
  nextTick(() => nameInput.value?.focus());
}

function startEditValue() {
  if (!props.editable) return;
  editingValue.value = true;
  valueDraft.value = props.property.value;
  nextTick(() => {
    valueInput.value?.focus();
    valueInput.value?.select();
  });
}

function commitName() {
  if (!editingName.value) return;
  editingName.value = false;
  const next = nameDraft.value.trim();
  if (next === props.property.name) return;
  if (!next) {
    emit("remove");
    return;
  }
  emit("change", {
    name: next,
    value: props.property.value,
    disabled: disabled.value,
    important: important.value,
  });
}

function commitValue() {
  if (!editingValue.value) return;
  editingValue.value = false;
  const next = valueDraft.value.trim();
  if (next === props.property.value) return;
  if (!next) {
    emit("remove");
    return;
  }
  emit("change", {
    name: props.property.name,
    value: next,
    disabled: disabled.value,
    important: important.value,
  });
}

function cancelName() {
  editingName.value = false;
  nameDraft.value = props.property.name;
}

function cancelValue() {
  editingValue.value = false;
  valueDraft.value = props.property.value;
}

function toggleDisabled() {
  if (!props.editable) return;
  emit("change", {
    name: props.property.name,
    value: props.property.value,
    disabled: !disabled.value,
    important: important.value,
  });
}
</script>

<template>
  <div
    class="group flex items-baseline gap-0 py-[1px] pr-1 hover:bg-surface-2/40 rounded-sm"
    :style="{ paddingLeft: `${(indent ?? 0) + 4}px` }"
  >
    <button
      v-if="editable"
      type="button"
      class="w-3 h-3 mr-1 shrink-0 self-center border rounded-[2px] flex items-center justify-center transition-opacity"
      :class="
        disabled
          ? 'opacity-100 border-blue-400/60 bg-blue-500/20'
          : 'opacity-0 group-hover:opacity-100 border-muted-foreground/40 bg-transparent hover:border-muted-foreground/70'
      "
      :title="disabled ? 'Enable property' : 'Disable property'"
      @click.stop="toggleDisabled"
    >
      <svg
        v-if="!disabled"
        class="w-2.5 h-2.5 text-blue-400"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M2 6l3 3 5-6" />
      </svg>
    </button>
    <div v-else class="w-4 shrink-0" />

    <input
      v-if="editingName"
      ref="nameInput"
      v-model="nameDraft"
      class="text-[11px] font-mono bg-surface-3 text-blue-300 outline-none px-0.5 rounded-sm border border-blue-400/40 min-w-0"
      :style="{ width: `${Math.max(nameDraft.length, 4) + 1}ch` }"
      @blur="commitName"
      @keydown.enter.prevent="commitName"
      @keydown.tab.prevent="
        commitName();
        startEditValue();
      "
      @keydown.escape.prevent="cancelName"
    />
    <span
      v-else
      class="text-[11px] font-mono cursor-text shrink-0"
      :class="[
        disabled ? 'text-muted-foreground/40 line-through' : 'text-blue-400',
        editable ? 'hover:bg-surface-3 rounded-sm px-0.5' : 'px-0.5',
      ]"
      @click.stop="startEditName"
      >{{ property.name }}</span
    >

    <span class="text-muted-foreground" :class="{ 'line-through opacity-40': disabled }"
      >:&nbsp;</span
    >

    <input
      v-if="editingValue"
      ref="valueInput"
      v-model="valueDraft"
      class="text-[11px] font-mono bg-surface-3 text-foreground/90 outline-none px-0.5 rounded-sm border border-blue-400/40 flex-1 min-w-0"
      @blur="commitValue"
      @keydown.enter.prevent="commitValue"
      @keydown.escape.prevent="cancelValue"
    />
    <span
      v-else
      class="text-[11px] font-mono break-all cursor-text"
      :class="[
        disabled ? 'text-muted-foreground/40 line-through' : 'text-foreground/85',
        editable ? 'hover:bg-surface-3 rounded-sm px-0.5' : 'px-0.5',
      ]"
      @click.stop="startEditValue"
    >
      {{ property.value }}<span v-if="important" class="text-red-400">&nbsp;!important</span>
    </span>

    <span class="text-muted-foreground" :class="{ 'opacity-40': disabled }">;</span>
  </div>
</template>
