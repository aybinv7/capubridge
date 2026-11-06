<script setup lang="ts">
import { computed } from "vue";
import { AppWindow, Binary, Download, ExternalLink } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import HexDump from "./HexDump.vue";
import { formatBudget, truncationNote, type Truncation } from "./readPlan";
import { primaryFileAction, type ViewerActions } from "./viewerActions";
import { noPreviewTitle } from "./viewerCopy";
import { extensionOf } from "./viewerKinds";

const props = defineProps<{
  name: string;
  head: Uint8Array;
  truncation: Truncation | null;
  title?: string;
  actions: ViewerActions;
}>();

const emit = defineEmits<{ openOnComputer: []; chooseApp: []; download: [] }>();

const heading = computed(() => props.title ?? noPreviewTitle(props.name, extensionOf(props.name)));
const shown = computed(() => {
  if (props.head.length === 0) return "The file is empty.";
  if (props.truncation) return `${truncationNote(props.truncation)}, as bytes.`;
  return `All ${formatBudget(props.head.length)} of it, as bytes.`;
});
const opensHere = computed(() => props.actions.openOnComputer || props.actions.chooseApp);
const primary = computed(() => primaryFileAction(props.actions));

function variantOf(action: "openOnComputer" | "chooseApp" | "download") {
  return primary.value === action ? "solid-fill" : "transparent";
}

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
            {{ shown }}<template v-if="opensHere"> An app on this computer may open it.</template>
          </p>
        </div>
      </div>
      <div v-if="primary" class="flex shrink-0 flex-wrap items-center gap-1">
        <Button
          v-if="props.actions.openOnComputer"
          size="sm"
          :variant="variantOf('openOnComputer')"
          :color="primary === 'openOnComputer' ? 'brand' : undefined"
          :content-class-name="actionContent"
          @click="emit('openOnComputer')"
        >
          <ExternalLink :stroke-width="1.8" />
          Open with the default app
        </Button>
        <Button
          v-if="props.actions.chooseApp"
          size="sm"
          :variant="variantOf('chooseApp')"
          :color="primary === 'chooseApp' ? 'brand' : undefined"
          :content-class-name="actionContent"
          @click="emit('chooseApp')"
        >
          <AppWindow :stroke-width="1.8" />
          Choose an app…
        </Button>
        <Button
          v-if="props.actions.download"
          size="sm"
          :variant="variantOf('download')"
          :color="primary === 'download' ? 'brand' : undefined"
          :outline="primary === 'download' ? undefined : false"
          :content-class-name="actionContent"
          @click="emit('download')"
        >
          <Download :stroke-width="1.8" />
          Download
        </Button>
      </div>
    </section>
    <HexDump :bytes="props.head" label="First bytes of the file" />
  </div>
</template>
