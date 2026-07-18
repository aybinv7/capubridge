<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    identifier: string;
    source?: string | null;
    loading?: boolean;
    size?: "sm" | "md" | "lg";
    alt?: string;
  }>(),
  {
    source: null,
    loading: false,
    size: "md",
    alt: "Application icon",
  },
);

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "w-8 h-8 rounded-lg text-sm";
    case "lg":
      return "w-20 h-20 rounded-2xl text-3xl";
    default:
      return "w-12 h-12 rounded-xl text-lg";
  }
});

const backgroundColor = computed(() => {
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#ec4899",
    "#f43f5e",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
    "#0ea5e9",
  ];
  let hash = 0;
  for (let index = 0; index < props.identifier.length; index += 1) {
    hash = props.identifier.charCodeAt(index) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? colors[0];
});

const letter = computed(() => {
  const parts = props.identifier.split(".");
  const value = parts.at(-1) || props.identifier;
  return value.charAt(0).toUpperCase();
});
</script>

<template>
  <div v-if="loading" :class="sizeClasses" class="shrink-0 animate-pulse bg-surface-3" />
  <img
    v-else-if="source"
    :src="source"
    :alt="alt"
    :class="sizeClasses"
    class="shrink-0 object-cover"
    loading="lazy"
  />
  <div
    v-else
    :class="sizeClasses"
    class="flex shrink-0 items-center justify-center font-bold text-white"
    :style="{ backgroundColor }"
  >
    {{ letter }}
  </div>
</template>
