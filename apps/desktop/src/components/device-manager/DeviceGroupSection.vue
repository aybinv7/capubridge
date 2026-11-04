<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import { ListTitle } from "@capubridge/cladd";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import DeviceListRow from "./DeviceListRow.vue";
import type { DeviceGroup } from "./deviceGroups";

const props = defineProps<{
  group: DeviceGroup;
  expanded: boolean;
  viewedSerial: string | null;
  inUseSerial: string | null;
  forgettingSerial?: string | null;
}>();

const emit = defineEmits<{
  toggle: [];
  selectDevice: [serial: string];
  forgetDevice: [serial: string];
}>();
</script>

<template>
  <section class="flex flex-col gap-0.5" :aria-label="props.group.label">
    <button
      v-if="props.group.collapsible"
      type="button"
      data-roving-item
      class="flex items-center gap-1.5 rounded-control px-2.5 py-1 text-left text-2xs text-[var(--fg-subtle)] outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      :aria-expanded="props.expanded"
      @click="emit('toggle')"
    >
      <ChevronRight
        :size="12"
        class="shrink-0 transition-transform duration-120"
        :class="props.expanded && 'rotate-90'"
        aria-hidden="true"
      />
      <span class="flex-1">{{ props.group.label }}</span>
      <span class="font-mono tabular-nums">{{ props.group.devices.length }}</span>
    </button>
    <ListTitle v-else class="px-2.5 pb-1 text-2xs font-normal normal-case text-[var(--fg-subtle)]">
      {{ props.group.label }}
    </ListTitle>

    <template v-if="props.expanded">
      <ContextMenu v-for="device in props.group.devices" :key="device.serial">
        <ContextMenuTrigger as-child>
          <div>
            <DeviceListRow
              :device="device"
              :viewed="props.viewedSerial === device.serial"
              :in-use="props.inUseSerial === device.serial"
              :busy="props.forgettingSerial === device.serial"
              @select="emit('selectDevice', device.serial)"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem variant="destructive" @select="emit('forgetDevice', device.serial)">
            Forget this device
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </template>
  </section>
</template>
