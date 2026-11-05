<script setup lang="ts">
import { computed } from "vue";
import { Check, Film, FolderOpen, TriangleAlert } from "lucide-vue-next";
import { invokeCommand } from "@/runtime/ipc/client";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { CaptureToastContent } from "./mirrorCapture";

const props = withDefaults(defineProps<CaptureToastContent>(), {
  path: null,
  thumbnail: null,
  duration: null,
  partial: false,
});

const stillAlt = computed(() =>
  props.kind === "screenshot" ? "The screenshot" : "The last frame of the recording",
);

async function showInFolder() {
  if (!props.path) return;
  try {
    await invokeCommand("show_in_folder", { path: props.path });
  } catch (error) {
    console.error("Failed to show the capture in its folder", error);
  }
}
</script>

<template>
  <div
    class="flex w-[var(--width)] max-w-full items-center gap-3 rounded-surface bg-popover p-2 pr-2.5 shadow-float ring-1 ring-border-subtle"
  >
    <div
      class="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-control bg-surface-cut shadow-cut"
    >
      <img
        v-if="props.thumbnail"
        :src="props.thumbnail"
        :alt="stillAlt"
        class="size-full object-cover"
        draggable="false"
      />
      <Film v-else :stroke-width="1.6" class="size-4 text-muted-foreground" />
      <span
        v-if="props.duration"
        class="absolute right-0.5 bottom-0.5 rounded-[4px] bg-black/70 px-1 font-mono text-2xs leading-4 text-white tabular-nums"
      >
        {{ props.duration }}
      </span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="flex items-center gap-1.5 text-xs text-foreground">
        <TriangleAlert
          v-if="props.partial"
          :stroke-width="2"
          class="size-3 shrink-0 text-warning"
        />
        <Check v-else :stroke-width="2.4" class="size-3 shrink-0 text-success" />
        <span class="truncate">{{ props.title }}</span>
      </span>
      <span class="truncate text-2xs text-muted-foreground" :title="props.detail">
        {{ props.detail }}
      </span>
    </div>

    <IconAction
      v-if="props.path"
      label="Show in folder"
      size="sm"
      position="top"
      class="shrink-0"
      @click="showInFolder"
    >
      <FolderOpen :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
