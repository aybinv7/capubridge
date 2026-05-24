<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { ChevronDown } from "lucide-vue-next";
import type { CSSProperty } from "utils";
import StyleProperty from "./StyleProperty.vue";
import { parseShorthandInput } from "./styleSerialize";

const props = defineProps<{
  selector: string | null;
  origin?: string;
  source?: string | null;
  properties: CSSProperty[];
  editable?: boolean;
  inheritedFrom?: string | null;
  showAddRow?: boolean;
}>();

const emit = defineEmits<{
  change: [
    index: number,
    next: { name: string; value: string; disabled: boolean; important: boolean },
  ];
  remove: [index: number];
  add: [next: { name: string; value: string; important?: boolean }];
}>();

const collapsed = ref(false);
const newDraft = ref("");
const newInput = ref<HTMLInputElement | null>(null);
const isAdding = ref(false);

const isUserAgent = computed(() => props.origin === "user-agent");
const canEdit = computed(() => props.editable !== false && !isUserAgent.value);

function toggleCollapsed() {
  collapsed.value = !collapsed.value;
}

function startAdd() {
  if (!canEdit.value) return;
  isAdding.value = true;
  newDraft.value = "";
  nextTick(() => newInput.value?.focus());
}

function commitAdd() {
  const parsed = parseShorthandInput(newDraft.value);
  isAdding.value = false;
  newDraft.value = "";
  if (!parsed) return;
  emit("add", { name: parsed.name, value: parsed.value, important: parsed.important });
}

function cancelAdd() {
  isAdding.value = false;
  newDraft.value = "";
}
</script>

<template>
  <div class="text-[11px] font-mono">
    <div
      v-if="inheritedFrom"
      class="text-[10px] uppercase tracking-wide text-muted-foreground/40 px-2 pt-2 pb-0.5"
    >
      Inherited from {{ inheritedFrom }}
    </div>

    <div
      class="flex items-center gap-1 px-1 py-0.5 select-none cursor-pointer group/sel hover:bg-surface-2/40"
      @click="toggleCollapsed"
    >
      <button
        class="w-3 h-3 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground"
      >
        <ChevronDown class="w-3 h-3 transition-transform" :class="{ '-rotate-90': collapsed }" />
      </button>
      <span
        class="truncate"
        :class="
          selector === null
            ? 'text-orange-300/90'
            : isUserAgent
              ? 'text-muted-foreground/40'
              : 'text-yellow-300/90'
        "
      >
        {{ selector === null ? "element.style" : selector }}
      </span>
      <span class="text-muted-foreground/50">&nbsp;{</span>
      <span class="ml-auto text-[10px] text-muted-foreground/30 truncate max-w-[40%]">
        {{ source ?? (isUserAgent ? "user agent stylesheet" : "") }}
      </span>
    </div>

    <div v-show="!collapsed" class="pl-0">
      <StyleProperty
        v-for="(prop, i) in properties"
        :key="`${prop.name}-${i}`"
        :property="prop"
        :editable="canEdit"
        :indent="16"
        @change="(next) => emit('change', i, next)"
        @remove="emit('remove', i)"
      />

      <div v-if="canEdit" class="pl-5 pr-1">
        <input
          v-if="isAdding"
          ref="newInput"
          v-model="newDraft"
          placeholder="property: value"
          class="w-full text-[11px] font-mono bg-surface-3 text-foreground/90 outline-none px-0.5 py-[1px] rounded-sm border border-blue-400/40"
          @blur="commitAdd"
          @keydown.enter.prevent="commitAdd"
          @keydown.escape.prevent="cancelAdd"
        />
        <div
          v-else-if="showAddRow || properties.length === 0"
          class="text-muted-foreground/30 italic cursor-text hover:bg-surface-2/40 rounded-sm px-0.5 py-[1px]"
          @click="startAdd"
        >
          + new property
        </div>
        <div v-else class="h-[2px] cursor-text" @click="startAdd" />
      </div>
    </div>

    <div v-show="!collapsed" class="text-muted-foreground/50 px-1 pb-0.5">}</div>
    <div v-show="collapsed" class="text-muted-foreground/40 px-1 pb-0.5 italic">…}</div>
  </div>
</template>
