<script setup lang="ts">
import { Minus, Plus, Redo2, Undo2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const props = defineProps<{
  zoomPercent: number;
  canUndo: boolean;
  canRedo: boolean;
}>();

const emit = defineEmits<{
  zoomOut: [];
  zoomIn: [];
  resetZoom: [];
  undo: [];
  redo: [];
}>();
</script>

<template>
  <TooltipProvider :delay-duration="120">
    <div class="pointer-events-auto absolute bottom-5 left-5 z-30">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 rounded-[22px] border border-border/25 bg-surface-0/92 p-1.5 shadow-[0_18px_70px_-28px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon-sm" variant="ghost" class="h-10 w-10 rounded-2xl" @click="emit('zoomOut')">
                <Minus :size="16" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Zoom out</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                class="h-10 min-w-[5rem] rounded-2xl px-3 text-xs font-medium tabular-nums text-foreground/85"
                @click="emit('resetZoom')"
              >
                {{ props.zoomPercent }}%
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Fit view</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon-sm" variant="ghost" class="h-10 w-10 rounded-2xl" @click="emit('zoomIn')">
                <Plus :size="16" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Zoom in</TooltipContent>
          </Tooltip>
        </div>

        <div class="flex items-center gap-1 rounded-[22px] border border-border/25 bg-surface-0/92 p-1.5 shadow-[0_18px_70px_-28px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-sm"
                variant="ghost"
                class="h-10 w-10 rounded-2xl"
                :disabled="!props.canUndo"
                @click="emit('undo')"
              >
                <Undo2 :size="16" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-sm"
                variant="ghost"
                class="h-10 w-10 rounded-2xl"
                :disabled="!props.canRedo"
                @click="emit('redo')"
              >
                <Redo2 :size="16" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Redo</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>
