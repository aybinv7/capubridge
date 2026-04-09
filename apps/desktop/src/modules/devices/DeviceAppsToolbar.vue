<script setup lang="ts">
import { computed } from "vue";
import { LayoutGrid, List, RefreshCw, Search, Square } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const props = defineProps<{
  search: string;
  packageScope: "third-party" | "all" | "system";
  appsView: "grid" | "table";
  gridColumns: string;
  filteredCount: number;
  totalCount: number;
  thirdPartyCount: number;
  systemCount: number;
  showCounts: boolean;
  isLoading: boolean;
  isCancelling?: boolean;
}>();

const emit = defineEmits<{
  "update:search": [value: string];
  "update:packageScope": [value: "third-party" | "all" | "system"];
  "update:appsView": [value: "grid" | "table"];
  "update:gridColumns": [value: string];
  refresh: [];
  cancelLoad: [];
}>();

const searchModel = computed({
  get: () => props.search,
  set: (value: string) => emit("update:search", value),
});

const packageScopeModel = computed({
  get: () => props.packageScope,
  set: (value: "third-party" | "all" | "system") => emit("update:packageScope", value),
});

const appsViewModel = computed({
  get: () => props.appsView,
  set: (value: "grid" | "table") => emit("update:appsView", value),
});

const gridColumnsModel = computed({
  get: () => props.gridColumns,
  set: (value: string) => emit("update:gridColumns", value),
});
</script>

<template>
  <div class="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 bg-surface-2 px-4">
    <div class="flex min-w-0 max-w-sm flex-1 items-center gap-2">
      <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
      <Input
        v-model="searchModel"
        class="h-7 border-0 bg-transparent px-0 text-xs focus-visible:ring-0 placeholder:text-muted-foreground/30"
        placeholder="Search package or label…"
      />
    </div>

    <Select v-model:model-value="packageScopeModel">
      <SelectTrigger class="h-7 w-[124px] border-border/30 bg-surface-3 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="third-party">Third-party</SelectItem>
        <SelectItem value="all">All packages</SelectItem>
        <SelectItem value="system">System only</SelectItem>
      </SelectContent>
    </Select>

    <Select v-if="appsViewModel === 'grid'" v-model:model-value="gridColumnsModel">
      <SelectTrigger class="h-7 w-[104px] border-border/30 bg-surface-3 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="4">4 / row</SelectItem>
        <SelectItem value="6">6 / row</SelectItem>
        <SelectItem value="8">8 / row</SelectItem>
      </SelectContent>
    </Select>

    <span v-if="showCounts" class="shrink-0 text-[11px] text-muted-foreground/40 tabular-nums">
      {{ filteredCount }}
      <span v-if="searchModel" class="text-muted-foreground/25">/{{ totalCount }}</span>
      apps
    </span>

    <span
      v-if="showCounts"
      class="hidden shrink-0 text-[11px] text-muted-foreground/35 lg:inline tabular-nums"
    >
      {{ thirdPartyCount }} user · {{ systemCount }} system
    </span>

    <div class="flex-1" />

    <Button
      variant="ghost"
      size="icon-sm"
      class="h-7 w-7 text-muted-foreground/40 hover:text-muted-foreground"
      :disabled="isLoading"
      @click="emit('refresh')"
    >
      <RefreshCw class="h-3.5 w-3.5" :class="isLoading ? 'animate-spin' : ''" />
    </Button>

    <Button
      v-if="isLoading"
      variant="ghost"
      size="sm"
      class="h-7 gap-1 px-2 text-muted-foreground/50 hover:text-muted-foreground"
      :disabled="!!isCancelling"
      @click="emit('cancelLoad')"
    >
      <Square class="h-3 w-3" />
      {{ isCancelling ? "Stopping…" : "Stop" }}
    </Button>

    <div class="flex gap-0.5 rounded-md border border-border/20 bg-surface-3 p-0.5">
      <button
        class="flex h-6 w-6 items-center justify-center rounded transition-colors"
        :class="
          appsViewModel === 'grid'
            ? 'bg-surface-2 text-foreground shadow-sm'
            : 'text-muted-foreground/40 hover:text-muted-foreground/70'
        "
        @click="appsViewModel = 'grid'"
      >
        <LayoutGrid class="h-3 w-3" />
      </button>
      <button
        class="flex h-6 w-6 items-center justify-center rounded transition-colors"
        :class="
          appsViewModel === 'table'
            ? 'bg-surface-2 text-foreground shadow-sm'
            : 'text-muted-foreground/40 hover:text-muted-foreground/70'
        "
        @click="appsViewModel = 'table'"
      >
        <List class="h-3 w-3" />
      </button>
    </div>
  </div>
</template>
