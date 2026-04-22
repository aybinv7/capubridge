<script setup lang="ts">
import {
  Hand,
  LayoutGrid,
  MousePointer2,
  StickyNote,
  Waypoints,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { StorageGraphCanvasMode } from "@/modules/storage/graph/storageGraphCanvas.utils";

const props = defineProps<{
  mode: StorageGraphCanvasMode;
  showHeuristicEdges: boolean;
}>();

const emit = defineEmits<{
  "update:mode": [mode: StorageGraphCanvasMode];
  addNote: [];
  autoLayout: [];
  toggleHeuristicEdges: [];
}>();

const tools = [
  { id: "pan", icon: Hand, label: "Pan" },
  { id: "select", icon: MousePointer2, label: "Select" },
] as const;
</script>

<template>
  <TooltipProvider :delay-duration="120">
    <div class="pointer-events-auto absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
      <div class="flex items-center gap-1 rounded-[26px] border border-border/25 bg-surface-0/92 p-1.5 shadow-[0_18px_70px_-28px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <Tooltip v-for="tool in tools" :key="tool.id">
          <TooltipTrigger as-child>
            <Button
              size="icon-sm"
              :variant="props.mode === tool.id ? 'default' : 'ghost'"
              class="h-10 w-10 rounded-2xl"
              @click="emit('update:mode', tool.id)"
            >
              <component :is="tool.icon" :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{{ tool.label }}</TooltipContent>
        </Tooltip>

        <div class="mx-1 h-8 w-px bg-border/25" />

        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon-sm" variant="ghost" class="h-10 w-10 rounded-2xl" @click="emit('addNote')">
              <StickyNote :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Add note</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon-sm" variant="ghost" class="h-10 w-10 rounded-2xl" @click="emit('autoLayout')">
              <LayoutGrid :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Auto layout</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-sm"
              :variant="props.showHeuristicEdges ? 'default' : 'ghost'"
              class="h-10 w-10 rounded-2xl"
              @click="emit('toggleHeuristicEdges')"
            >
              <Waypoints :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ props.showHeuristicEdges ? "Hide" : "Show" }} inferred links
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </TooltipProvider>
</template>
