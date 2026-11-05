<script setup lang="ts">
import { computed } from "vue";
import type { AdbPackageDetails } from "@/types/adb.types";
import { formatBytes } from "../shared/format";
import { totalAppSize } from "./appsModel";

const props = defineProps<{ details: AdbPackageDetails | undefined }>();

const total = computed(() => totalAppSize(props.details));
const parts = computed(() => {
  const sum = total.value ?? 0;
  return [
    { key: "app", label: "App", value: props.details?.appSize ?? null, tone: "bg-foreground/70" },
    { key: "data", label: "Data", value: props.details?.dataSize ?? null, tone: "bg-cat-device" },
    {
      key: "cache",
      label: "Cache",
      value: props.details?.cacheSize ?? null,
      tone: "bg-muted-foreground/50",
    },
  ].map((part) => ({ ...part, width: sum > 0 && part.value ? (part.value / sum) * 100 : 0 }));
});
</script>

<template>
  <div v-if="total === null" class="flex items-baseline justify-between gap-3">
    <span class="text-xs text-muted-foreground">Space used</span>
    <span class="text-xs text-[var(--fg-subtle)]">Not reported by this phone</span>
  </div>
  <div v-else class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between">
      <span class="text-xs text-muted-foreground">Space used</span>
      <span class="font-mono text-sm text-foreground tabular-nums">{{ formatBytes(total) }}</span>
    </div>
    <div
      class="flex h-1.5 gap-px overflow-hidden rounded-full bg-surface-cut shadow-cut"
      aria-hidden="true"
    >
      <span
        v-for="part in parts"
        v-show="part.width > 0"
        :key="part.key"
        class="h-full"
        :class="part.tone"
        :style="{ width: `${part.width}%` }"
      />
    </div>
    <ul class="flex gap-4 text-2xs text-muted-foreground">
      <li v-for="part in parts" :key="part.key" class="flex items-center gap-1.5">
        <span class="size-1.5 rounded-full" :class="part.tone" aria-hidden="true" />
        {{ part.label }}
        <span class="font-mono text-foreground tabular-nums">{{ formatBytes(part.value) }}</span>
      </li>
    </ul>
  </div>
</template>
