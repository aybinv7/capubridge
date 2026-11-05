<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowUp,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  PanelRight,
  PanelRightClose,
  RadioTower,
  RefreshCw,
} from "lucide-vue-next";
import { SearchField, Segmented, SegmentedButton, Select } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import FilesBreadcrumbs from "./FilesBreadcrumbs.vue";
import { REFRESH_INTERVALS, type FilesView, type SearchScope } from "./filesView";

const query = defineModel<string>("query", { required: true });
const scope = defineModel<SearchScope>("scope", { required: true });
const view = defineModel<FilesView>("view", { required: true });
const showHidden = defineModel<boolean>("showHidden", { required: true });
const detailsOpen = defineModel<boolean>("detailsOpen", { required: true });
const refreshEveryMs = defineModel<number>("refreshEveryMs", { required: true });

const props = defineProps<{ dir: string; loading: boolean }>();

const emit = defineEmits<{
  open: [path: string];
  up: [];
  refresh: [];
  searchFocus: [focused: boolean];
}>();

const intervalLabel = computed(
  () =>
    REFRESH_INTERVALS.find((option) => option.value === refreshEveryMs.value)?.label ?? "Manual",
);
const intervalModel = computed({
  get: () => refreshEveryMs.value,
  set: (value: unknown) => {
    refreshEveryMs.value = typeof value === "number" ? value : Number(value) || 0;
  },
});
</script>

<template>
  <div class="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2">
    <IconAction
      label="Up one folder"
      keys="Backspace"
      :disabled="props.dir === '/'"
      @click="emit('up')"
    >
      <ArrowUp :stroke-width="1.8" />
    </IconAction>
    <FilesBreadcrumbs :dir="props.dir" class="min-w-0 flex-1" @open="emit('open', $event)" />

    <SearchField
      v-model="query"
      size="sm"
      class="w-52 shrink-0"
      :placeholder="scope === 'device' ? 'Search the whole phone' : 'Search this folder'"
      :aria-label="scope === 'device' ? 'Search the whole phone' : 'Search this folder'"
      @focusin="emit('searchFocus', true)"
      @focusout="emit('searchFocus', false)"
    />
    <Segmented size="sm" aria-label="Where to search">
      <SegmentedButton :active="scope === 'folder'" @click="scope = 'folder'"
        >Folder</SegmentedButton
      >
      <SegmentedButton :active="scope === 'device'" @click="scope = 'device'"
        >Phone</SegmentedButton
      >
    </Segmented>

    <span class="mx-0.5 h-4 w-px shrink-0 bg-border-subtle" aria-hidden="true" />

    <Select
      v-model="intervalModel"
      :options="REFRESH_INTERVALS"
      size="sm"
      variant="transparent"
      :outline="false"
      :keyboard-hints="false"
      title="How often the folder is read again"
      aria-label="How often the folder is read again"
      class="w-auto shrink-0 text-muted-foreground"
    >
      <template #icon>
        <RadioTower :size="13" :stroke-width="1.8" aria-hidden="true" />
      </template>
      {{ intervalLabel }}
    </Select>
    <IconAction label="Read the folder again" :loading="props.loading" @click="emit('refresh')">
      <RefreshCw :stroke-width="1.8" />
    </IconAction>
    <IconAction
      :label="showHidden ? 'Hide hidden files' : 'Show hidden files'"
      hint="Names that start with a dot"
      toggle
      :pressed="showHidden"
      @click="showHidden = !showHidden"
    >
      <EyeOff v-if="showHidden" :stroke-width="1.8" />
      <Eye v-else :stroke-width="1.8" />
    </IconAction>
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
    <IconAction
      :label="detailsOpen ? 'Hide details' : 'Show details'"
      toggle
      :pressed="detailsOpen"
      @click="detailsOpen = !detailsOpen"
    >
      <PanelRightClose v-if="detailsOpen" :stroke-width="1.8" />
      <PanelRight v-else :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
