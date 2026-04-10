<script setup lang="ts">
import { ref, computed } from "vue";
import { Search } from "lucide-vue-next";
import type { ComputedStyle } from "@/types/inspect.types";

const props = defineProps<{
  styles: ComputedStyle[];
  isLoading: boolean;
}>();

const filter = ref("");
const showAll = ref(false);

const filteredStyles = computed(() => {
  let list = props.styles;
  if (filter.value) {
    const q = filter.value.toLowerCase();
    list = list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.value.toLowerCase().includes(q),
    );
  }
  if (!showAll.value) {
    list = list.filter(
      (s) =>
        s.value &&
        s.value !== "none" &&
        s.value !== "normal" &&
        s.value !== "auto" &&
        s.value !== "0px",
    );
  }
  return list;
});
</script>

<template>
  <div class="flex flex-col h-full text-xs font-mono">
    <div class="flex items-center gap-1 px-2 py-1 border-b border-border/20">
      <Search class="w-3 h-3 text-muted-foreground/40" />
      <input
        v-model="filter"
        placeholder="Filter..."
        class="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/30"
      />
      <label class="flex items-center gap-1 text-[10px] text-muted-foreground/50 cursor-pointer">
        <input v-model="showAll" type="checkbox" class="w-3 h-3" />
        All
      </label>
    </div>

    <div class="flex-1 overflow-auto p-2 space-y-0.5">
      <div v-if="isLoading" class="text-muted-foreground/40 text-center py-4">Loading...</div>
      <div
        v-for="style in filteredStyles"
        :key="style.name"
        class="flex gap-1 py-0.5 hover:bg-surface-2 px-1 rounded"
      >
        <span class="text-blue-400 shrink-0">{{ style.name }}</span>
        <span class="text-muted-foreground">:</span>
        <span class="text-foreground/80 truncate">{{ style.value }}</span>
      </div>
    </div>
  </div>
</template>
