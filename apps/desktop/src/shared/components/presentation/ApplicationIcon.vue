<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    identifier: string;
    source?: string | null;
    loading?: boolean;
    size?: "xs" | "sm" | "md" | "lg";
    alt?: string;
    /** The app's name; its first letter stands in while there is no icon. */
    label?: string | null;
  }>(),
  {
    source: null,
    loading: false,
    size: "md",
    alt: "Application icon",
    label: null,
  },
);

const sizeClasses = computed(() => {
  switch (props.size) {
    case "xs":
      return "w-5 h-5 rounded-md text-2xs";
    case "sm":
      return "w-8 h-8 rounded-lg text-sm";
    case "lg":
      return "w-20 h-20 rounded-2xl text-3xl";
    default:
      return "w-12 h-12 rounded-xl text-lg";
  }
});

const letter = computed(() => {
  const label = props.label?.trim();
  if (label) return label.charAt(0).toUpperCase();
  const parts = props.identifier.split(".");
  const value = parts.at(-1) || props.identifier;
  return value.charAt(0).toUpperCase();
});
</script>

<template>
  <img
    v-if="source"
    :src="source"
    :alt="alt"
    :class="sizeClasses"
    class="shrink-0 object-cover"
    loading="lazy"
  />
  <div
    v-else
    :class="[sizeClasses, loading && 'opacity-60']"
    class="flex shrink-0 items-center justify-center bg-surface-2 font-medium text-muted-foreground shadow-bevel transition-opacity duration-200 ease-in-out"
    aria-hidden="true"
  >
    {{ letter }}
  </div>
</template>
