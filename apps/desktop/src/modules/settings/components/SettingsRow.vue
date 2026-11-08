<script setup lang="ts">
/** A setting: what it is on the left, its control or value on the right. */
const props = withDefaults(defineProps<{ label: string; description?: string; mono?: boolean }>(), {
  description: undefined,
  mono: false,
});

defineSlots<{ default?: () => unknown; description?: () => unknown }>();
</script>

<template>
  <div class="flex min-h-12 items-center justify-between gap-4 px-3.5 py-2.5">
    <div class="flex min-w-0 flex-col gap-0.5">
      <span class="text-xs text-foreground" :class="props.mono && 'font-mono'">{{
        props.label
      }}</span>
      <p
        v-if="props.description || $slots.description"
        class="text-2xs leading-relaxed text-muted-foreground"
      >
        <slot name="description">{{ props.description }}</slot>
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <slot />
    </div>
  </div>
</template>
