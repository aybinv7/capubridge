<script setup lang="ts">
import { computed } from "vue";
import { X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DockPopoutButton from "./DockPopoutButton.vue";
import { dockTabMeta } from "./dock-meta";
import type { DockTab } from "@/types/dock.types";
import { isDockTab } from "@/types/dock.types";

const props = defineProps<{
  activeTab: DockTab;
  tabs: DockTab[];
  unreadByTab: Record<DockTab, boolean>;
}>();

const emit = defineEmits<{
  close: [];
  popout: [tab: DockTab];
  "update:activeTab": [tab: DockTab];
}>();

const activeMeta = computed(() => dockTabMeta[props.activeTab]);

function handleTabChange(value: string | number) {
  if (!isDockTab(String(value))) {
    return;
  }

  emit("update:activeTab", value);
}
</script>

<template>
  <div class="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-2">
    <Tabs
      class="min-w-0 flex-1 gap-0"
      :model-value="props.activeTab"
      @update:model-value="handleTabChange"
    >
      <TabsList class="h-8 w-full justify-start gap-1 rounded-lg bg-surface-1/80 p-1">
        <TabsTrigger
          v-for="tab in props.tabs"
          :key="tab"
          :value="tab"
          class="h-6 flex-none gap-2 rounded-md border border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-border data-[state=active]:bg-surface-3 data-[state=active]:text-foreground data-[state=active]:shadow-none"
        >
          <component :is="dockTabMeta[tab].icon" class="size-3.5" />
          <span>{{ dockTabMeta[tab].label }}</span>
          <span v-if="props.unreadByTab[tab]" class="size-1.5 rounded-full bg-accent" />
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="flex items-center gap-1">
      <DockPopoutButton :tab="props.activeTab" @popout="emit('popout', $event)" />
      <Button
        variant="ghost"
        size="icon-sm"
        class="size-8 rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        :title="`Close ${activeMeta.label}`"
        @click="emit('close')"
      >
        <X class="size-3.5" />
      </Button>
    </div>
  </div>
</template>
