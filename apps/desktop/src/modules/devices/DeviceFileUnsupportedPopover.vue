<script setup lang="ts">
import { Download, ExternalLink } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { fileIcon, fileIconClass, type DeviceFileListEntry } from "./deviceFiles.utils";

const props = defineProps<{
  open: boolean;
  entry: DeviceFileListEntry | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  openExternal: [entry: DeviceFileListEntry];
  chooseApp: [entry: DeviceFileListEntry];
  download: [entry: DeviceFileListEntry];
}>();

function openExternal() {
  if (props.entry) emit("openExternal", props.entry);
}

function download() {
  if (props.entry) emit("download", props.entry);
}

function chooseApp() {
  if (props.entry) emit("chooseApp", props.entry);
}
</script>

<template>
  <Popover :open="open" @update:open="emit('update:open', $event)">
    <PopoverAnchor as-child>
      <span class="fixed left-1/2 top-1/2 h-px w-px" />
    </PopoverAnchor>
    <PopoverContent class="w-80 border-border/40 bg-surface-2 p-3" side="top" align="center">
      <div v-if="entry" class="space-y-3">
        <div class="flex min-w-0 items-start gap-2">
          <component
            :is="fileIcon(entry)"
            class="mt-0.5 h-4 w-4 shrink-0"
            :class="fileIconClass(entry)"
          />
          <div class="min-w-0">
            <div class="truncate text-sm font-medium" :title="entry.name">
              {{ entry.name }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground/55">
              No in-app viewer for this file type.
            </div>
          </div>
        </div>
        <div class="grid gap-1.5">
          <Button variant="outline" size="sm" class="justify-start gap-2" @click="openExternal()">
            <ExternalLink class="h-3.5 w-3.5" />System default app
          </Button>
          <Button variant="outline" size="sm" class="justify-start gap-2" @click="chooseApp()">
            <ExternalLink class="h-3.5 w-3.5" />Choose app…
          </Button>
          <Button variant="outline" size="sm" class="justify-start gap-2" @click="download()">
            <Download class="h-3.5 w-3.5" />Download
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
