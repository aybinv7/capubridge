<script setup lang="ts">
import { FolderOpen } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { AppFolder } from "./appFolders";

const props = defineProps<{ folders: readonly AppFolder[] }>();

const emit = defineEmits<{ open: [path: string] }>();
</script>

<template>
  <ul class="flex flex-col">
    <li
      v-for="folder in props.folders"
      :key="folder.key"
      class="group/folder flex items-center gap-2 rounded-control py-1 pr-1 pl-2 hover:bg-cladd-surface-hover"
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 flex-col text-left outline-none focus-visible:underline"
        @click="emit('open', folder.path)"
      >
        <span class="text-xs text-foreground">{{ folder.label }}</span>
        <span class="truncate font-mono text-2xs text-[var(--fg-subtle)]" :title="folder.path">
          {{ folder.path }}
        </span>
      </button>
      <IconAction label="Open in Files" size="sm" @click="emit('open', folder.path)">
        <FolderOpen :stroke-width="1.8" />
      </IconAction>
    </li>
  </ul>
</template>
