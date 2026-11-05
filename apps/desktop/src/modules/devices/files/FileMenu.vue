<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { isFolderEntry, type DeviceFileListEntry } from "./filePaths";

const props = defineProps<{ entry: DeviceFileListEntry }>();

const emit = defineEmits<{
  details: [];
  open: [];
  openOnComputer: [];
  download: [];
  delete: [];
}>();
</script>

<template>
  <ContextMenuContent>
    <ContextMenuItem @select="emit('open')">
      {{ isFolderEntry(props.entry) ? "Open folder" : "Open" }}
    </ContextMenuItem>
    <ContextMenuItem @select="emit('details')">Show details</ContextMenuItem>
    <template v-if="!isFolderEntry(props.entry)">
      <ContextMenuItem @select="emit('openOnComputer')">Open on this computer</ContextMenuItem>
      <ContextMenuItem @select="emit('download')">Download</ContextMenuItem>
    </template>
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive" @select="emit('delete')">Delete</ContextMenuItem>
  </ContextMenuContent>
</template>
