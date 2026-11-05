<script setup lang="ts">
import { computed } from "vue";
import { LayoutGrid, List, RefreshCw } from "lucide-vue-next";
import { Button, SearchField, Segmented, SegmentedButton } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { AppCounts, AppScope } from "./appsModel";
import type { AppsDensity, AppsView } from "./appsView";

const search = defineModel<string>("search", { required: true });
const scope = defineModel<AppScope>("scope", { required: true });
const view = defineModel<AppsView>("view", { required: true });
const density = defineModel<AppsDensity>("density", { required: true });

const props = defineProps<{
  counts: AppCounts | null;
  shown: number;
  loading: boolean;
  cancelling: boolean;
}>();

const emit = defineEmits<{ refresh: []; cancel: [] }>();

const SCOPES: Array<{ value: AppScope; label: string; count: keyof AppCounts }> = [
  { value: "third-party", label: "Your apps", count: "thirdParty" },
  { value: "system", label: "System", count: "system" },
  { value: "all", label: "All", count: "total" },
];
const DENSITIES: Array<{ value: AppsDensity; label: string }> = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

const searchSummary = computed(() => {
  if (!search.value.trim() || !props.counts) return null;
  return `${props.shown} found`;
});
</script>

<template>
  <div class="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2">
    <SearchField
      v-model="search"
      size="sm"
      class="w-60 shrink-0"
      placeholder="Search by name or package"
      aria-label="Search apps by name or package"
    />
    <Segmented size="sm" aria-label="Which apps">
      <SegmentedButton
        v-for="option in SCOPES"
        :key="option.value"
        :active="scope === option.value"
        content-class-name="gap-1.5"
        @click="scope = option.value"
      >
        {{ option.label }}
        <span v-if="props.counts" class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
          {{ props.counts[option.count] }}
        </span>
      </SegmentedButton>
    </Segmented>
    <span v-if="searchSummary" class="shrink-0 text-xs text-muted-foreground tabular-nums">
      {{ searchSummary }}
    </span>

    <span class="flex-1" />

    <Button
      v-if="props.loading"
      size="sm"
      variant="transparent"
      :outline="false"
      :loading="props.cancelling"
      class="text-muted-foreground hover:text-foreground"
      @click="emit('cancel')"
    >
      Stop loading
    </Button>
    <IconAction
      label="Reload the app list"
      hint="Asks the phone again instead of using the saved list"
      :loading="props.loading"
      @click="emit('refresh')"
    >
      <RefreshCw :stroke-width="1.8" />
    </IconAction>

    <Segmented v-if="view === 'grid'" size="sm" aria-label="Icon size">
      <SegmentedButton
        v-for="option in DENSITIES"
        :key="option.value"
        :active="density === option.value"
        :aria-label="`${option.value} icons`"
        class="w-7 font-mono"
        @click="density = option.value"
      >
        {{ option.label }}
      </SegmentedButton>
    </Segmented>
    <Segmented size="sm" aria-label="Layout">
      <SegmentedButton
        :active="view === 'list'"
        aria-label="List"
        title="List"
        square
        @click="view = 'list'"
      >
        <List :size="14" :stroke-width="1.8" />
      </SegmentedButton>
      <SegmentedButton
        :active="view === 'grid'"
        aria-label="Icons"
        title="Icons"
        square
        @click="view = 'grid'"
      >
        <LayoutGrid :size="14" :stroke-width="1.8" />
      </SegmentedButton>
    </Segmented>
  </div>
</template>
