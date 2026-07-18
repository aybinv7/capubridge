<script setup lang="ts">
import { ArrowUpRight } from "lucide-vue-next";
import { invokeCommand } from "@/runtime/ipc/client";

const props = defineProps<{
  type: "video" | "screenshot";
  path: string;
  name: string;
  thumbnailBase64?: string;
}>();

async function openInFolder() {
  try {
    await invokeCommand("show_in_folder", { path: props.path });
  } catch (err) {
    console.error("Failed to open folder:", err);
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-3 w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl"
  >
    <div
      class="w-full aspect-video rounded-lg border border-zinc-800/50 bg-zinc-900/50 flex items-center justify-center overflow-hidden"
    >
      <img
        v-if="type === 'screenshot' && thumbnailBase64"
        :src="`data:image/png;base64,${thumbnailBase64}`"
        class="w-full h-full object-contain"
        alt="Thumbnail"
      />
      <div v-else class="text-zinc-500 text-sm font-medium">Video Preview</div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <div class="flex flex-col gap-1 overflow-hidden">
        <span class="text-sm font-medium text-zinc-100 truncate">{{ name }}</span>
        <span class="text-[11px] text-zinc-500 truncate" :title="path">{{ path }}</span>
      </div>

      <button
        @click="openInFolder"
        class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
        title="Show in folder"
      >
        <ArrowUpRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
