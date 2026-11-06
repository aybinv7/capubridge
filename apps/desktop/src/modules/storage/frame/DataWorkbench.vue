<script setup lang="ts">
import { Surface } from "@capubridge/cladd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { DataKind } from "./dataFrame.types";

/**
 * Sources on the left (220–440 px) on the panel itself, and the open collection on a workspace
 * raised one level above it (`Surface +1`, outlined, `rounded-well`, 8 px gutters), so depth
 * rather than a border separates them. Everything inside resolves its depth from that surface:
 * grids sit in recessed wells, record panes one level higher. Sizes persist per tab.
 */
const props = defineProps<{ kind: DataKind }>();

defineSlots<{ sidebar: () => unknown; default: () => unknown }>();
</script>

<template>
  <ResizablePanelGroup
    direction="horizontal"
    :auto-save-id="`capubridge:data-layout:v2:${props.kind}`"
    class="h-full min-h-0"
  >
    <ResizablePanel
      :id="`data-${props.kind}-sources`"
      :order="1"
      size-unit="px"
      :default-size="280"
      :min-size="220"
      :max-size="440"
      class="min-h-0"
    >
      <slot name="sidebar" />
    </ResizablePanel>
    <ResizableHandle
      class="w-2 bg-transparent before:absolute before:inset-y-4 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring"
    />
    <ResizablePanel :id="`data-${props.kind}-main`" :order="2" :min-size="40" class="min-h-0">
      <div class="h-full min-h-0 py-2 pr-2">
        <Surface
          variant="solid"
          level="+1"
          outline
          class="h-full min-h-0 overflow-hidden rounded-well"
          content-class-name="@container flex h-full min-h-0 min-w-0 flex-col"
        >
          <slot />
        </Surface>
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
