<script setup lang="ts">
import { reactive, watch } from "vue";
import GatedView from "@/components/gate/GatedView.vue";
import { ConsoleView, LogsView } from "@/modules/console/public";
import type { DrawerView } from "@/types/drawer.types";
import { DRAWER_VIEW_META } from "./drawerViews";

/**
 * The views of a drawer host, each behind its own gate (Logs needs a device, Console a
 * WebView). A view mounts the first time it is shown and then stays, so switching keeps its
 * query, scroll and opened rows.
 */
const props = defineProps<{ views: readonly DrawerView[]; current: DrawerView }>();

const visited = reactive(new Set<DrawerView>());
watch(
  () => props.current,
  (view) => visited.add(view),
  { immediate: true },
);
</script>

<template>
  <div class="relative min-h-0 flex-1">
    <template v-for="view in props.views" :key="view">
      <div
        v-if="visited.has(view)"
        v-show="view === props.current"
        :data-active="view === props.current"
        class="absolute inset-0 flex flex-col"
      >
        <GatedView :requirement="DRAWER_VIEW_META[view].requirement" density="compact">
          <LogsView v-if="view === 'logs'" :active="view === props.current" />
          <ConsoleView v-else :active="view === props.current" />
        </GatedView>
      </div>
    </template>
  </div>
</template>
