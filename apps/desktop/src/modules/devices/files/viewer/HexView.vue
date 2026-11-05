<script setup lang="ts">
import { computed, ref } from "vue";
import { AppWindow, Binary, Download, ExternalLink } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { hexRows } from "./hexDump";
import { formatBudget, truncationNote, type Truncation } from "./readPlan";
import { noPreviewTitle } from "./viewerCopy";
import { extensionOf } from "./viewerKinds";

const ROW_HEIGHT = 20;

const props = defineProps<{
  name: string;
  head: Uint8Array;
  truncation: Truncation | null;
  title?: string;
}>();

const emit = defineEmits<{ openOnComputer: []; chooseApp: []; download: [] }>();

const scroller = ref<HTMLElement | null>(null);
const rows = computed(() => hexRows(props.head));
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: ROW_HEIGHT,
  overscan: 8,
});

const heading = computed(() => props.title ?? noPreviewTitle(props.name, extensionOf(props.name)));
const shown = computed(() => {
  if (props.head.length === 0) return "The file is empty.";
  if (props.truncation) return `${truncationNote(props.truncation)}, as bytes.`;
  return `All ${formatBudget(props.head.length)} of it, as bytes.`;
});

const actionContent = "gap-2 [&>svg]:size-3.5";
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-surface-cut">
    <section
      class="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border-subtle bg-surface-0 px-5 py-4"
    >
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <span
          class="grid size-9 shrink-0 place-items-center rounded-control bg-surface-cut text-[var(--fg-subtle)] shadow-cut"
          aria-hidden="true"
        >
          <Binary :size="18" :stroke-width="1.6" />
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <h3 class="text-sm font-medium text-foreground">{{ heading }}</h3>
          <p class="text-xs text-muted-foreground">
            {{ shown }} An app on this computer may open it.
          </p>
        </div>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="solid-fill"
          :content-class-name="actionContent"
          @click="emit('openOnComputer')"
        >
          <ExternalLink :stroke-width="1.8" />
          Open with the default app
        </Button>
        <Button
          size="sm"
          variant="transparent"
          :content-class-name="actionContent"
          @click="emit('chooseApp')"
        >
          <AppWindow :stroke-width="1.8" />
          Choose an app…
        </Button>
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
          :content-class-name="actionContent"
          @click="emit('download')"
        >
          <Download :stroke-width="1.8" />
          Download
        </Button>
      </div>
    </section>

    <div
      v-if="rows.length > 0"
      ref="scroller"
      class="min-h-0 flex-1 overflow-auto px-5 py-3 font-mono text-xs leading-5"
      role="table"
      aria-label="First bytes of the file"
    >
      <div
        class="flex gap-6 pb-1 text-2xs text-[var(--fg-subtle)] uppercase select-none"
        role="row"
      >
        <span class="w-[8ch] shrink-0" role="columnheader">Offset</span>
        <span class="w-[48ch] shrink-0" role="columnheader">Bytes</span>
        <span role="columnheader">Text</span>
      </div>
      <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
      <div
        v-for="item in items"
        :key="item.index"
        class="flex gap-6 whitespace-pre"
        role="row"
        :style="{ height: `${ROW_HEIGHT}px` }"
      >
        <span class="w-[8ch] shrink-0 text-[var(--fg-subtle)] select-none" role="cell">{{
          item.data.offset
        }}</span>
        <span class="w-[48ch] shrink-0 text-foreground" role="cell">{{ item.data.hex }}</span>
        <span class="text-muted-foreground" role="cell">{{ item.data.ascii }}</span>
      </div>
      <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
    </div>
  </div>
</template>
