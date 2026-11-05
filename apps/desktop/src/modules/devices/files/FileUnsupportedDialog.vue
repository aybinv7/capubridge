<script setup lang="ts">
import { computed } from "vue";
import { AppWindow, Download, ExternalLink } from "lucide-vue-next";
import { Button, Dialog } from "@capubridge/cladd";
import FileGlyph from "./FileGlyph.vue";
import { entryExtension } from "./fileKinds";
import type { DeviceFileListEntry } from "./filePaths";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{ entry: DeviceFileListEntry | null }>();

const emit = defineEmits<{
  openOnComputer: [entry: DeviceFileListEntry];
  chooseApp: [entry: DeviceFileListEntry];
  download: [entry: DeviceFileListEntry];
}>();

const title = computed(() => {
  const entry = props.entry;
  if (!entry) return "No preview for this file";
  const ext = entryExtension(entry);
  return ext && ext !== entry.name.toLowerCase()
    ? `No preview for .${ext} files`
    : "No preview for this file";
});

function run(action: "openOnComputer" | "chooseApp" | "download") {
  const entry = props.entry;
  if (!entry) return;
  open.value = false;
  if (action === "openOnComputer") emit("openOnComputer", entry);
  else if (action === "chooseApp") emit("chooseApp", entry);
  else emit("download", entry);
}
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :aria-label="title"
    class="w-[380px] max-w-[calc(100vw-48px)]"
    content-class-name="flex flex-col gap-4 p-5"
  >
    <header class="flex items-start gap-3">
      <span
        class="grid size-9 shrink-0 place-items-center rounded-control bg-surface-cut shadow-cut"
      >
        <FileGlyph v-if="props.entry" :entry="props.entry" :size="18" />
      </span>
      <div class="flex min-w-0 flex-col gap-0.5">
        <h2 class="text-sm font-medium text-foreground">{{ title }}</h2>
        <p class="truncate text-xs text-muted-foreground" :title="props.entry?.path">
          {{ props.entry?.name }} can still be opened another way.
        </p>
      </div>
    </header>
    <div class="flex flex-col gap-1">
      <Button
        size="sm"
        variant="solid-fill"
        content-class-name="w-full justify-start gap-2 [&>svg]:size-3.5"
        @click="run('openOnComputer')"
      >
        <ExternalLink :stroke-width="1.8" />
        Open with the default app on this computer
      </Button>
      <Button
        size="sm"
        variant="transparent"
        content-class-name="w-full justify-start gap-2 [&>svg]:size-3.5"
        @click="run('chooseApp')"
      >
        <AppWindow :stroke-width="1.8" />
        Choose an app on this computer
      </Button>
      <Button
        size="sm"
        variant="transparent"
        :outline="false"
        content-class-name="w-full justify-start gap-2 [&>svg]:size-3.5"
        @click="run('download')"
      >
        <Download :stroke-width="1.8" />
        Download
      </Button>
    </div>
  </Dialog>
</template>
