<script setup lang="ts">
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Group,
  LayoutGrid,
  Ungroup,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { StorageGraphSelectionAction } from "@/modules/storage/graph/storageGraphCanvas.utils";

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  action: [action: StorageGraphSelectionAction];
}>();

const tools: Array<{
  action: StorageGraphSelectionAction;
  icon: unknown;
  label: string;
}> = [
  { action: "group", icon: Group, label: "Group selection" },
  { action: "ungroup", icon: Ungroup, label: "Ungroup selection" },
  { action: "pack", icon: LayoutGrid, label: "Pack selection" },
  { action: "align-left", icon: AlignStartVertical, label: "Align left" },
  { action: "align-center", icon: AlignCenterVertical, label: "Align center" },
  { action: "align-right", icon: AlignEndVertical, label: "Align right" },
  { action: "align-top", icon: AlignStartHorizontal, label: "Align top" },
  { action: "align-middle", icon: AlignCenterHorizontal, label: "Align middle" },
  { action: "align-bottom", icon: AlignEndHorizontal, label: "Align bottom" },
  { action: "distribute-horizontal", icon: BetweenHorizontalStart, label: "Distribute horizontal" },
  { action: "distribute-vertical", icon: BetweenVerticalStart, label: "Distribute vertical" },
];
</script>

<template>
  <TooltipProvider :delay-duration="120">
    <div
      v-if="visible"
      class="pointer-events-auto absolute left-7 top-1/2 z-30 -translate-y-1/2"
    >
      <div class="flex flex-col gap-1.5 rounded-[32px] border border-primary/15 bg-surface-0/94 p-2 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.68)] backdrop-blur-xl">
        <Tooltip v-for="tool in tools" :key="tool.action">
          <TooltipTrigger as-child>
            <Button
              size="icon-sm"
              variant="ghost"
              class="h-10 w-10 rounded-[18px]"
              @click="emit('action', tool.action)"
            >
              <component :is="tool.icon" :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{{ tool.label }}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </TooltipProvider>
</template>
