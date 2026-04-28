<script setup lang="ts">
import { AppWindow } from "lucide-vue-next";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppPerformanceWorkspace from "./AppPerformanceWorkspace.vue";
import { useAppPanel } from "./useAppPanel";

const panel = useAppPanel();
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div
      v-if="!panel.selectedTarget.value || !panel.packageName.value"
      class="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-lg border border-border/25 bg-surface-1/90"
      >
        <AppWindow class="h-5 w-5 text-muted-foreground/35" />
      </div>
      <div class="text-lg font-medium text-foreground/80">No app target selected</div>
    </div>

    <ScrollArea v-else class="h-full">
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
