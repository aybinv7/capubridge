<script setup lang="ts">
import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { ChevronDown, ChevronUp, Trash2, X } from "lucide-vue-next";
import { Button, Link, Tab, Tabs, TabsList } from "@capubridge/cladd";
import type { CacheStorageEntryDetail } from "@capubridge/cdp-protocol";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DetailsState from "@/shared/http/DetailsState.vue";
import { TONE_CLASS } from "@/shared/http/tone";
import CacheEntryBody from "./CacheEntryBody.vue";
import CacheEntryHeaders from "./CacheEntryHeaders.vue";
import type { CacheRow } from "./cacheModel";

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
  readList: [];
}>();

const stored = useStorage<PaneTab>("capubridge:data:cache-pane-tab", "headers");
const tab = computed<PaneTab>({
  get: () => (stored.value === "response" ? "response" : "headers"),
  set: (value) => (stored.value = value),
});
const findSignal = ref(0);

const changed = computed(
  () => props.detail !== undefined && props.detail.version !== props.row.version,
);
const subtitle = computed(() => [props.position, props.row.kind].filter(Boolean).join(" · "));

function asTab(value: unknown): PaneTab {
  return value === "response" ? "response" : "headers";
}

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
      <Tabs :value="tab" @update:value="tab = asTab($event)">
        <TabsList
          aria-label="Cached entry"
          size="sm"
          active-variant="solid"
          :rounded="false"
          class="shrink-0 justify-start gap-0.5 border-b border-border-subtle px-2.5 py-1.5"
        >
          <Tab
            v-for="option in TABS"
            :key="option.value"
            :value="option.value"
            class="text-xs font-normal text-muted-foreground data-active:font-medium data-active:text-foreground"
          >
            {{ option.label }}
          </Tab>
        </TabsList>
      </Tabs>
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
        />
      </div>
    </template>

    <footer class="flex shrink-0 items-center gap-2 border-t border-border-subtle px-3 py-2">
      <HintTooltip :text="blockedReason">
        <Button
          size="sm"
          variant="transparent"
          color="red"
          content-class-name="gap-1.5"
          :disabled="blockedReason !== null || gone"
          :loading="busy"
          @click="emit('delete')"
        >
          <Trash2 :size="12" aria-hidden="true" />
          Delete entry…
        </Button>
      </HintTooltip>
      <span class="flex-1" />
      <span v-if="error && tab === 'headers'" class="truncate text-2xs text-error">
        Could not read this entry: {{ error }}
      </span>
    </footer>
  </section>
</template>
