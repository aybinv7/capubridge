<script setup lang="ts">
import { useLocalTabs } from "@/composables/useLocalTabs";
import type { MirrorSide } from "@/stores/mirror.store";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";
import LocalAddressBar from "./LocalAddressBar.vue";
import LocalTabStrip from "./LocalTabStrip.vue";
import type { ReloadKind } from "./useLocalPageAddress";

/**
 * The browser frame around pages on This PC: the tabs, then the toolbar of the open tab. A New tab
 * has no toolbar; its page asks for the address itself.
 */
const props = defineProps<{ url: string; loading: boolean; side: MirrorSide }>();

const emit = defineEmits<{
  reload: [kind: ReloadKind];
  go: [url: string, newTab: boolean];
  invalid: [text: string];
  toggleSide: [];
}>();

const browser = useThisPcBrowserStore();
const { selectTab, closeTab, openNewTab } = useLocalTabs();
</script>

<template>
  <div class="flex shrink-0 flex-col">
    <LocalTabStrip
      :loading="props.loading"
      @select="selectTab"
      @close="closeTab"
      @create="openNewTab"
    />
    <LocalAddressBar
      v-if="!browser.showingNewTab"
      :url="props.url"
      :loading="props.loading"
      :side="props.side"
      @reload="emit('reload', $event)"
      @go="(url, newTab) => emit('go', url, newTab)"
      @invalid="emit('invalid', $event)"
      @toggle-side="emit('toggleSide')"
    />
  </div>
</template>
