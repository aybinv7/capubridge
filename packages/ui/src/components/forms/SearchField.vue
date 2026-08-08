<script setup lang="ts">
import { computed, useAttrs } from "vue";

import type { UiAccent } from "../../foundations/contracts.ts";
import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { cn } from "../../shared/cn.ts";
import type { FieldSize } from "./form.contracts.ts";
import Input from "./Input.vue";
import SearchIcon from "./SearchIcon.vue";
import {
  searchFieldClasses,
  searchFieldIconClasses,
  type SearchFieldProps,
} from "./searchField.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SearchFieldProps>(), {
  accent: undefined,
  clearButton: undefined,
  color: undefined,
  placeholder: undefined,
  rounded: undefined,
  size: undefined,
});

const d = useComponentDefaults("SearchField", props, {
  clearButton: true,
  placeholder: "Search",
  rounded: true,
  size: "lg" as FieldSize,
});

defineSlots<{
  icon?: () => unknown;
}>();

const emit = defineEmits<{
  change: [value: string, event: Event];
  clear: [];
  keydown: [event: KeyboardEvent];
}>();

const model = defineModel<string>({ default: "" });
const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() => cn(searchFieldClasses, attrs.class));

function clear(): void {
  model.value = "";
  emit("clear");
}

// Escape clears the field; only swallow it when there's something to clear so an empty field
// still lets Escape bubble (e.g. to close a Popover).
function onKeydown(event: KeyboardEvent): void {
  emit("keydown", event);
  if (event.defaultPrevented || event.key !== "Escape" || !model.value) return;
  event.preventDefault();
  event.stopPropagation();
  clear();
}
</script>

<template>
  <Input
    v-bind="rootAttrs"
    v-model="model"
    :accent="d.accent"
    :class="rootClass"
    :clear-button="d.clearButton"
    :color="d.color"
    :placeholder="d.placeholder"
    :rounded="d.rounded"
    :size="d.size"
    @change="(value, event) => emit('change', value, event)"
    @clear="clear"
    @keydown="onKeydown"
  >
    <template #icon>
      <slot name="icon">
        <SearchIcon :class="searchFieldIconClasses" />
      </slot>
    </template>
  </Input>
</template>
