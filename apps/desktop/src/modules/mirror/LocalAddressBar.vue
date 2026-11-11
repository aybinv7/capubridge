<script setup lang="ts">
import { ArrowLeftRight } from "lucide-vue-next";
import type { ViewportArea } from "@/lib/web-viewport";
import type { MirrorSide } from "@/stores/mirror.store";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import LocalAddressField from "./LocalAddressField.vue";
import LocalReloadButton from "./LocalReloadButton.vue";
import WebViewportControls from "./WebViewportControls.vue";
import type { ReloadKind } from "./useLocalPageAddress";

/**
 * The one toolbar under the tabs: reload, the tab's address, the page size, and the swap that
 * trades places between the page and the panel beside it.
 */
const props = defineProps<{
  url: string;
  loading: boolean;
  side: MirrorSide;
  renderedWidth: number;
  area: ViewportArea | null;
}>();

const emit = defineEmits<{
  reload: [kind: ReloadKind];
  go: [url: string, newTab: boolean];
  invalid: [text: string];
  toggleSide: [];
}>();
</script>

<template>
  <div class="@container flex h-9 shrink-0 items-center gap-1 pr-1.5 pl-1.5">
    <LocalReloadButton :loading="props.loading" @reload="emit('reload', $event)" />

    <LocalAddressField
      :url="props.url"
      @go="(url, newTab) => emit('go', url, newTab)"
      @invalid="emit('invalid', $event)"
    />

    <WebViewportControls :rendered-width="props.renderedWidth" :area="props.area" />

    <IconAction
      :label="props.side === 'left' ? 'Put the page on the right' : 'Put the page on the left'"
      hint="Swaps the page and the panel beside it"
      size="sm"
      @click="emit('toggleSide')"
    >
      <ArrowLeftRight :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
