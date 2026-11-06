<script setup lang="ts">
import { Tab, Tabs, TabsList } from "@capubridge/cladd";
import { useDrawerStore } from "@/stores/drawer.store";
import { isDrawerView } from "@/types/drawer.types";
import { DRAWER_VIEW_META } from "./drawerViews";

/**
 * Logs or Console. A view's tab counts the warnings and errors that arrived while it was out
 * of sight; the count goes when the view is shown.
 */
const drawer = useDrawerStore();
const count = new Intl.NumberFormat(undefined, { notation: "compact" });

function select(value: string) {
  if (isDrawerView(value)) drawer.setView(value);
}
</script>

<template>
  <Tabs :value="drawer.currentView" @update:value="select">
    <TabsList
      aria-label="Drawer view"
      size="sm"
      active-variant="solid"
      :rounded="false"
      class="shrink-0 gap-0.5"
    >
      <Tab
        v-for="view in drawer.docked"
        :key="view"
        :value="view"
        class="gap-1.5 text-xs font-normal text-muted-foreground data-active:font-medium data-active:text-foreground"
      >
        <component :is="DRAWER_VIEW_META[view].icon" class="size-3.5" aria-hidden="true" />
        {{ DRAWER_VIEW_META[view].label }}
        <span
          v-if="drawer.unread[view] > 0 && drawer.currentView !== view"
          class="rounded-full bg-surface-2 px-1.5 font-mono text-2xs leading-4 text-foreground tabular-nums shadow-bevel"
          :aria-label="`${drawer.unread[view]} new warnings or errors`"
        >
          {{ count.format(drawer.unread[view]) }}
        </span>
      </Tab>
    </TabsList>
  </Tabs>
</template>
