<script setup lang="ts">
import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { ChevronDown, ChevronUp, X } from "lucide-vue-next";
import { Link, Segmented, SegmentedButton } from "@capubridge/cladd";
import type { CacheStorageEntryDetail } from "@capubridge/cdp-protocol";
import DataPaneFooter from "@/modules/storage/frame/DataPaneFooter.vue";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DetailsState from "@/shared/http/DetailsState.vue";
import { TONE_CLASS } from "@/shared/http/tone";
import CacheEntryBody from "./CacheEntryBody.vue";
import CacheEntryHeaders from "./CacheEntryHeaders.vue";
import { responseChanged, type CacheRow } from "./cacheModel";

type PaneTab = "headers" | "response";

const TABS: { value: PaneTab; label: string }[] = [
  { value: "headers", label: "Headers" },
  { value: "response", label: "Response" },
];

/**
 * One cached entry beside the list: the request and its response, as Network shows a request.
 * The full read happens when the entry is shown; when the phone holds another response than the
 * list read, or none, the pane says so instead of mixing the two.
 */
const props = defineProps<{
  row: CacheRow;
  detail: CacheStorageEntryDetail | undefined;
  loading: boolean;
  error: string | null;
  /** The entry is not in the cache any more. */
  gone: boolean;
  position: string | null;
  blockedReason: string | null;
  busy: boolean;
  canPrev: boolean;
  canNext: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  prev: [];
  next: [];
  close: [];
  retry: [];
  readBody: [];
  readList: [];
}>();

const stored = useStorage<PaneTab>("capubridge:data:cache-pane-tab", "headers");
const tab = computed<PaneTab>({
  get: () => (stored.value === "response" ? "response" : "headers"),
  set: (value) => (stored.value = value),
});
const findSignal = ref(0);

const changed = computed(() => responseChanged(props.row, props.detail));
const subtitle = computed(() => [props.position, props.row.kind].filter(Boolean).join(" · "));

function onKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.altKey) return;
  if (event.key.toLowerCase() === "f" && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    tab.value = "response";
    findSignal.value += 1;
  } else if (event.key === "ArrowUp" && props.canPrev) {
    event.preventDefault();
    emit("prev");
  } else if (event.key === "ArrowDown" && props.canNext) {
    event.preventDefault();
    emit("next");
  }
}
</script>

<template>
  <section
    data-record-pane
    class="flex h-full min-h-0 flex-col"
    :aria-label="`Cached ${row.method} ${row.name}`"
    @keydown="onKeydown"
  >
    <header class="flex shrink-0 items-start gap-2 border-b border-border-subtle py-2 pr-2 pl-3">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <p class="flex min-w-0 items-center gap-2 font-mono text-xs">
          <span class="shrink-0 text-2xs text-[var(--fg-subtle)]">{{ row.method }}</span>
          <span class="truncate font-medium text-foreground select-text">{{ row.name }}</span>
          <span class="shrink-0 tabular-nums" :class="TONE_CLASS[row.statusTone]">
            {{ row.statusLabel }}
          </span>
        </p>
        <HintTooltip :text="row.url">
          <p class="truncate font-mono text-2xs text-[var(--fg-subtle)] select-text">
            {{ row.address }}
          </p>
        </HintTooltip>
        <span v-if="subtitle" class="text-2xs text-[var(--fg-subtle)] tabular-nums">
          {{ subtitle }}
        </span>
      </div>
      <IconAction
        label="Previous entry"
        keys="mod+arrowup"
        size="sm"
        :disabled="!canPrev"
        @click="emit('prev')"
      >
        <ChevronUp :stroke-width="1.8" />
      </IconAction>
      <IconAction
        label="Next entry"
        keys="mod+arrowdown"
        size="sm"
        :disabled="!canNext"
        @click="emit('next')"
      >
        <ChevronDown :stroke-width="1.8" />
      </IconAction>
      <CopyAction :value="row.url" label="Copy the address" />
      <IconAction label="Close" keys="Escape" size="sm" @click="emit('close')">
        <X :stroke-width="1.8" />
      </IconAction>
    </header>

    <p
      v-if="changed"
      class="flex shrink-0 flex-wrap items-center gap-x-2 border-b border-border-subtle px-3 py-1.5 text-2xs text-warning"
      role="status"
    >
      The app saved a new response after the list was read; this pane shows the new one.
      <Link class="text-foreground" @click="emit('readList')">Read the list again</Link>
    </p>

    <DetailsState
      v-if="gone"
      title="This entry is not in the cache any more"
      text="The app deleted or replaced it after the list was read."
      action-label="Read the list again"
      @action="emit('readList')"
    />
    <template v-else>
      <div class="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-1.5">
        <Segmented size="xs" active-variant="solid" aria-label="Show the entry's">
          <SegmentedButton
            v-for="option in TABS"
            :key="option.value"
            :active="tab === option.value"
            @click="tab = option.value"
          >
            {{ option.label }}
          </SegmentedButton>
        </Segmented>
      </div>
      <div class="min-h-0 flex-1">
        <CacheEntryHeaders
          v-if="tab === 'headers'"
          :row="row"
          :detail="detail"
          :loading="loading"
        />
        <CacheEntryBody
          v-else
          :row="row"
          :detail="detail"
          :loading="loading"
          :error="error"
          :find-signal="findSignal"
          @retry="emit('retry')"
          @read-body="emit('readBody')"
        />
      </div>
    </template>

    <DataPaneFooter
      delete-label="Delete entry…"
      :delete-reason="blockedReason"
      :delete-disabled="gone"
      :busy="busy"
      @delete="emit('delete')"
    >
      <template #status>
        <span v-if="error && tab === 'headers'" class="text-error">
          Could not read this entry: {{ error }}
        </span>
      </template>
    </DataPaneFooter>
  </section>
</template>
