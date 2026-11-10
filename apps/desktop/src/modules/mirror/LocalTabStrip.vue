<script setup lang="ts">
import { computed } from "vue";
import { Plus } from "lucide-vue-next";
import { tabLabel } from "@/lib/local-tab-label";
import { useLocalPageHistoryStore } from "@/stores/localPageHistory.store";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { CDPTarget } from "@/types/cdp.types";
import LocalTab from "./LocalTab.vue";

/**
 * The tabs of This PC, one per open page, and a New tab while one is being opened. Tabs share the
 * row and shrink as more open; the row scrolls sideways past that.
 */
const props = defineProps<{ loading: boolean }>();

const emit = defineEmits<{ select: [tab: CDPTarget]; close: [tab: CDPTarget]; create: [] }>();

const browser = useThisPcBrowserStore();
const history = useLocalPageHistoryStore();

const tabs = computed(() =>
  browser.tabs.map((target) => ({
    target,
    label: tabLabel(target, browser.pages[target.id], history.visits),
    active: !browser.showingNewTab && browser.selectedTab?.id === target.id,
  })),
);

function dismissNewTab() {
  const back = browser.selectedTab ?? browser.tabs[0];
  if (back) emit("select", back);
}

function scrollSideways(event: WheelEvent) {
  const strip = event.currentTarget as HTMLElement;
  if (strip.scrollWidth <= strip.clientWidth || event.deltaX !== 0) return;
  strip.scrollLeft += event.deltaY;
}
</script>

<template>
  <div class="flex h-10 shrink-0 items-center gap-1 pr-1.5 pl-1.5">
    <div
      role="tablist"
      aria-label="Pages on This PC"
      class="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      @wheel.passive="scrollSideways"
    >
      <LocalTab
        v-for="tab in tabs"
        :key="tab.target.id"
        :title="tab.label.title"
        :url="tab.label.url"
        :icon="tab.label.icon"
        :active="tab.active"
        :loading="tab.active && props.loading"
        @select="emit('select', tab.target)"
        @close="emit('close', tab.target)"
      />
      <LocalTab
        v-if="browser.showingNewTab"
        title="New tab"
        url=""
        :icon="null"
        active
        :loading="false"
        @select="() => undefined"
        @close="dismissNewTab"
      />
    </div>
    <IconAction
      label="New tab"
      hint="Open another page on This PC"
      size="sm"
      @click="emit('create')"
    >
      <Plus :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
