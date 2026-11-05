<script setup lang="ts">
import type { Component } from "vue";
import { Switch } from "@capubridge/cladd";

const props = withDefaults(
  defineProps<{
    icon?: Component;
    title: string;
    hint: string;
    checked: boolean;
    disabled?: boolean;
    nested?: boolean;
  }>(),
  { icon: undefined, disabled: false, nested: false },
);

const emit = defineEmits<{ "update:checked": [value: boolean] }>();
</script>

<template>
  <label
    class="flex min-h-11 items-center gap-3 rounded-control px-2.5 py-1.5 transition-colors"
    :class="[
      props.disabled
        ? 'cursor-not-allowed opacity-45'
        : 'cursor-pointer hover:bg-cladd-surface-hover',
      props.nested ? 'min-h-9 pl-11' : '',
    ]"
  >
    <span
      v-if="props.icon && !props.nested"
      class="grid size-7 shrink-0 place-items-center rounded-control bg-surface-cut shadow-cut"
    >
      <component :is="props.icon" :size="14" :stroke-width="1.8" class="text-muted-foreground" />
    </span>
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-xs text-foreground">{{ props.title }}</span>
      <span class="truncate text-2xs text-muted-foreground">{{ props.hint }}</span>
    </span>
    <slot name="trailing" />
    <Switch
      size="sm"
      :model-value="props.checked"
      :disabled="props.disabled"
      :aria-label="props.title"
      @update:model-value="emit('update:checked', $event === true)"
    />
  </label>
</template>
