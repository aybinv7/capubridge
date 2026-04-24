<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { invoke } from "@tauri-apps/api/core";

const props = withDefaults(
  defineProps<{
    serial: string;
    apkPath: string;
    packageName: string;
    iconPath?: string | null;
    resolve?: boolean;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    resolve: true,
  },
);

const { data: iconUrl, isFetching } = useQuery({
  queryKey: computed(() => [
    "app-icon",
    props.serial,
    props.packageName,
    props.apkPath,
    props.iconPath ?? "",
  ]),
  queryFn: () =>
    invoke<string>("adb_get_app_icon", {
      serial: props.serial,
      apkPath: props.apkPath,
      packageName: props.packageName,
      iconPath: props.iconPath,
    }),
  staleTime: Infinity,
  gcTime: 1000 * 60 * 60,
  enabled: computed(() => props.resolve !== false && !!props.serial && !!props.packageName),
  retry: false,
});

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

// Deterministic color from package name
const bgColor = computed(() => {
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
  for (let i = 0; i < props.packageName.length; i++) {
    hash = props.packageName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
});

const letter = computed(() => {
  const parts = props.packageName.split(".");
  const last = parts[parts.length - 1] ?? props.packageName;
  return last.charAt(0).toUpperCase();
});
</script>

<template>
  <!-- Skeleton while loading -->
  <div
    v-if="props.resolve !== false && isFetching"
    :class="sizeClasses"
    class="shrink-0 animate-pulse bg-surface-3"
  />

  <!-- Real icon -->
  <img
    v-else-if="iconUrl"
    :src="iconUrl"
    :class="sizeClasses"
    class="shrink-0 object-cover"
    loading="lazy"
  />

  <!-- Fallback: colored letter -->
  <div
    v-else
    :class="sizeClasses"
    class="shrink-0 flex items-center justify-center font-bold text-white"
    :style="{ backgroundColor: bgColor }"
  >
    {{ letter }}
  </div>
</template>
