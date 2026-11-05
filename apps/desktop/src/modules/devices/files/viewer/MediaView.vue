<script setup lang="ts">
import { computed } from "vue";
import { Music } from "lucide-vue-next";
import { useObjectUrl } from "./useObjectUrl";
import type { MediaContent } from "./viewerContent";

const props = defineProps<{ content: MediaContent; name: string }>();

const emit = defineEmits<{ unreadable: [] }>();

const url = useObjectUrl(computed(() => props.content.blob));
</script>

<template>
  <div class="flex h-full min-h-0 items-center justify-center bg-surface-cut p-6">
    <video
      v-if="props.content.kind === 'video' && url"
      :key="url"
      :src="url"
      controls
      preload="metadata"
      class="max-h-full max-w-full rounded-well shadow-float"
      :aria-label="props.name"
      @error="emit('unreadable')"
    />
    <div
      v-else-if="url"
      class="flex w-full max-w-md flex-col items-center gap-4 rounded-surface border border-border-subtle bg-surface-0 p-6 shadow-bevel"
    >
      <span
        class="grid size-14 place-items-center rounded-well bg-surface-cut text-[var(--fg-subtle)] shadow-cut"
        aria-hidden="true"
      >
        <Music :size="24" :stroke-width="1.6" />
      </span>
      <p class="max-w-full truncate text-sm text-foreground" :title="props.name">
        {{ props.name }}
      </p>
      <audio
        :key="url"
        :src="url"
        controls
        preload="metadata"
        class="w-full"
        :aria-label="props.name"
        @error="emit('unreadable')"
      />
    </div>
  </div>
</template>
