<script setup lang="ts">
import type { Component } from "vue";
import { MoreHorizontal } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { DataAction } from "./dataFrame.types";

/** The ⋯ menu of a sidebar row or a header. Out of the tab order inside lists (`tabindex -1`). */
const props = withDefaults(
  defineProps<{
    actions: readonly DataAction[];
    label: string;
    inList?: boolean;
    icon?: Component;
  }>(),
  { inList: false, icon: undefined },
);

const emit = defineEmits<{ select: [actionId: string] }>();
</script>

<template>
  <DropdownMenu>
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
    </DropdownMenuContent>
  </DropdownMenu>
</template>
