<script setup lang="ts">
import { computed } from "vue";
import { Folder, FolderSymlink } from "lucide-vue-next";
import type { FileEntry } from "@/types/adb.types";
import { fileIcon } from "./fileKinds";

const props = withDefaults(defineProps<{ entry: FileEntry; size?: number }>(), { size: 16 });

const icon = computed(() => {
  if (props.entry.entryType === "dir") return Folder;
  if (props.entry.entryType === "symlink") return FolderSymlink;
  return fileIcon(props.entry);
});
const folder = computed(
  () => props.entry.entryType === "dir" || props.entry.entryType === "symlink",
);
</script>

<template>
  <component
    :is="icon"
    v-if="icon"
    :size="props.size"
    :stroke-width="1.6"
    class="shrink-0"
    :class="folder ? 'fill-current/15 text-muted-foreground' : 'text-[var(--fg-subtle)]'"
    aria-hidden="true"
  />
</template>
