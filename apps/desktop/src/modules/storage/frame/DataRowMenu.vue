<script setup lang="ts">
import type { Component } from "vue";
import { MoreHorizontal, PanelBottom, PanelRight } from "lucide-vue-next";
import { useRecordPaneStore } from "@/stores/recordPane.store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { DataAction } from "./dataFrame.types";

/**
 * The ⋯ menu of a sidebar row or a header. Out of the tab order inside lists (`tabindex -1`);
 * `open` lets the list open it from the keyboard (Shift+F10, the Menu key) or a right-click.
 * `recordPaneToggle` adds where records open, below or beside the table, for every database.
 */
const props = withDefaults(
  defineProps<{
    actions: readonly DataAction[];
    label: string;
    inList?: boolean;
    icon?: Component;
    recordPaneToggle?: boolean;
  }>(),
  { inList: false, icon: undefined, recordPaneToggle: false },
);

const emit = defineEmits<{ select: [actionId: string] }>();

const open = defineModel<boolean>("open", { default: false });
const recordPane = useRecordPaneStore();
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <span class="inline-flex" @click.stop @pointerdown.stop>
        <IconAction
          :label="props.label"
          :size="props.inList ? 'sm' : 'md'"
          :tabindex="props.inList ? -1 : undefined"
          aria-haspopup="menu"
        >
          <component :is="props.icon ?? MoreHorizontal" :stroke-width="1.8" />
        </IconAction>
      </span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <template v-for="action in props.actions" :key="action.id">
        <DropdownMenuSeparator v-if="action.separatorBefore" />
        <DropdownMenuItem
          :disabled="action.disabled"
          :variant="action.danger ? 'destructive' : 'default'"
          @select="emit('select', action.id)"
        >
          <component :is="action.icon" v-if="action.icon" class="size-3.5" aria-hidden="true" />
          <span class="flex min-w-0 flex-col">
            <span class="truncate">{{ action.label }}</span>
            <span v-if="action.disabled && action.reason" class="text-2xs text-muted-foreground">
              {{ action.reason }}
            </span>
          </span>
        </DropdownMenuItem>
      </template>
      <template v-if="props.recordPaneToggle">
        <DropdownMenuSeparator v-if="props.actions.length" />
        <DropdownMenuItem @select="recordPane.togglePlacement()">
          <component
            :is="recordPane.placement === 'side' ? PanelBottom : PanelRight"
            class="size-3.5"
            aria-hidden="true"
          />
          <span class="truncate">{{
            recordPane.placement === "side"
              ? "Show records below the table"
              : "Show records beside the table"
          }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
