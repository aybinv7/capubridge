<script setup lang="ts">
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { DataKind } from "./dataFrame.types";

/** Sources on the left, the open collection on the right; sizes persist per tab. */
const props = defineProps<{ kind: DataKind }>();

defineSlots<{ sidebar: () => unknown; default: () => unknown }>();
</script>

<template>
  <ResizablePanelGroup
    direction="horizontal"
    :auto-save-id="`capubridge:data-layout:${props.kind}`"
    class="h-full min-h-0"
  >
    <ResizablePanel
      :id="`data-${props.kind}-sources`"
      :order="1"
      :default-size="22"
      :min-size="14"
      :max-size="40"
      class="min-h-0"
    >
      <slot name="sidebar" />
    </ResizablePanel>
    <ResizableHandle
      class="w-2 bg-transparent before:absolute before:inset-y-4 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:bg-border-subtle before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring"
    />
    <ResizablePanel :id="`data-${props.kind}-main`" :order="2" :min-size="40" class="min-h-0">
      <div class="@container flex h-full min-h-0 min-w-0 flex-col">
        <slot />
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
