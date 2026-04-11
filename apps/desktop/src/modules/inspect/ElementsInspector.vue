<script setup lang="ts">
import { onMounted } from "vue";
import { useInspectStore } from "@/stores/inspect.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useInspector } from "./useInspector";
import DomTree from "./DomTree.vue";
import ElementDetailPanel from "./ElementDetailPanel.vue";

const store = useInspectStore();
const devicesStore = useDevicesStore();
const mirrorStore = useMirrorStore();
const inspector = useInspector();

onMounted(() => {
  if (devicesStore.selectedDevice?.status !== "online") return;
  if (!mirrorStore.isOpen) {
    mirrorStore.open();
  }
  store.inspectMode = true;
});
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 min-h-0 overflow-hidden">
      <ResizablePanelGroup direction="vertical" class="h-full">
        <ResizablePanel :default-size="62" :min-size="30" class="min-h-0">
          <DomTree
            @select="inspector.selectNode($event)"
            @expand="inspector.expandNode($event)"
            @hover="inspector.highlightNode($event)"
            @unhover="inspector.clearHighlight()"
            @toggle-inspect="inspector.toggleInspectMode()"
            @refresh="inspector.refreshDocument()"
          />
        </ResizablePanel>

        <ResizableHandle with-handle class="data-[orientation=vertical]:cursor-row-resize" />

        <ResizablePanel :default-size="38" :min-size="20" class="min-h-0">
          <ElementDetailPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </div>
</template>
