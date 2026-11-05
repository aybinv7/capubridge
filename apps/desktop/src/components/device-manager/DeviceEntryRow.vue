<script setup lang="ts">
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import DeviceListRow from "./DeviceListRow.vue";
import { connectionSummary, type DeviceEntry } from "./deviceEntries";

const props = defineProps<{ entry: DeviceEntry; viewed: boolean; busy: boolean }>();

const emit = defineEmits<{ select: []; forget: [] }>();
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div>
        <DeviceListRow
          :device="props.entry.device"
          :connections="connectionSummary(props.entry)"
          :serials="props.entry.connections.map((connection) => connection.serial)"
          :viewed="props.viewed"
          :busy="props.busy"
          @select="emit('select')"
        />
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem variant="destructive" @select="emit('forget')">
        Forget this device
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
