<script setup lang="ts">
import { ScrollArea } from "@/components/ui/scroll-area";
import AppPerformanceWorkspace from "./AppPerformanceWorkspace.vue";
import { useAppPanel } from "./useAppPanel";

const panel = useAppPanel();
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <ScrollArea v-if="panel.selectedTarget.value && panel.packageName.value" class="h-full">
      <div class="p-3">
        <AppPerformanceWorkspace
          :target-id="panel.selectedTarget.value.id"
          :is-ready="!!panel.selectedTarget.value.id && !!panel.packageName.value"
          :is-live="panel.inspector.isLive.value"
          :live-error="panel.inspector.liveError.value"
          :mem-info="panel.inspector.memInfo.value"
          :cpu-info="panel.inspector.cpuInfo.value"
        />
      </div>
    </ScrollArea>
  </div>
</template>
