<script setup lang="ts">
import type { Component } from "vue";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Group,
  LayoutGrid,
  Ungroup,
} from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { StorageGraphSelectionAction } from "./storageGraphCanvas.utils";

/** Arranging several selected nodes: group them, pack, align or space them out. */
defineProps<{ count: number }>();

const emit = defineEmits<{ action: [action: StorageGraphSelectionAction] }>();

const groups: ReadonlyArray<
  ReadonlyArray<{ action: StorageGraphSelectionAction; icon: Component; label: string }>
> = [
  [
    { action: "group", icon: Group, label: "Group them" },
    { action: "ungroup", icon: Ungroup, label: "Ungroup them" },
    { action: "pack", icon: LayoutGrid, label: "Pack them together" },
  ],
  [
    { action: "align-left", icon: AlignStartVertical, label: "Align left edges" },
    { action: "align-center", icon: AlignCenterVertical, label: "Align centres" },
    { action: "align-right", icon: AlignEndVertical, label: "Align right edges" },
    { action: "align-top", icon: AlignStartHorizontal, label: "Align top edges" },
    { action: "align-middle", icon: AlignCenterHorizontal, label: "Align middles" },
    { action: "align-bottom", icon: AlignEndHorizontal, label: "Align bottom edges" },
  ],
  [
    { action: "distribute-horizontal", icon: BetweenHorizontalStart, label: "Space out across" },
    { action: "distribute-vertical", icon: BetweenVerticalStart, label: "Space out down" },
  ],
];
</script>

<template>
  <div
    class="pointer-events-auto absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-well bg-surface-0 p-1 shadow-float ring-1 ring-border-subtle"
    role="toolbar"
    :aria-label="`Arrange ${count} selected`"
  >
    <span class="px-2 text-2xs text-muted-foreground tabular-nums">{{ count }} selected</span>
    <template v-for="(group, index) in groups" :key="index">
      <span class="mx-1 h-5 w-px bg-border-subtle" aria-hidden="true" />
      <IconAction
        v-for="tool in group"
        :key="tool.action"
        :label="tool.label"
        position="bottom"
        @click="emit('action', tool.action)"
      >
        <component :is="tool.icon" :stroke-width="1.8" />
      </IconAction>
    </template>
  </div>
</template>
