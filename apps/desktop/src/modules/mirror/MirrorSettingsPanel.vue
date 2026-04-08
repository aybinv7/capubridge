<script setup lang="ts">
import { useMirrorStore } from "@/stores/mirror.store";

const mirrorStore = useMirrorStore();

const fpsOptions = [5, 10, 15, 30] as const;
const qualityOptions = ["720p", "1080p", "1440p"] as const;
const bitrateOptions = [4, 8, 16, 20] as const;
</script>

<template>
  <div class="p-3 space-y-4">
    <!-- FPS (polling rate) -->
    <div>
      <p class="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">Stream FPS</p>
      <div class="flex gap-1">
        <button
          v-for="fps in fpsOptions"
          :key="fps"
          class="flex-1 h-6 text-xs rounded transition-colors border"
          :class="
            mirrorStore.settings.fps === fps
              ? 'bg-accent border-border text-foreground'
              : 'border-border/30 text-muted-foreground hover:text-foreground hover:bg-accent/50'
          "
          @click="mirrorStore.settings.fps = fps"
        >
          {{ fps }}
        </button>
      </div>
    </div>

    <!-- Recording quality -->
    <div>
      <p class="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">
        Record Quality
      </p>
      <div class="flex gap-1">
        <button
          v-for="q in qualityOptions"
          :key="q"
          class="flex-1 h-6 text-xs rounded transition-colors border"
          :class="
            mirrorStore.settings.recordQuality === q
              ? 'bg-accent border-border text-foreground'
              : 'border-border/30 text-muted-foreground hover:text-foreground hover:bg-accent/50'
          "
          @click="mirrorStore.settings.recordQuality = q"
        >
          {{ q }}
        </button>
      </div>
    </div>

    <!-- Bitrate -->
    <div>
      <p class="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">
        Record Bitrate (Mbps)
      </p>
      <div class="flex gap-1">
        <button
          v-for="br in bitrateOptions"
          :key="br"
          class="flex-1 h-6 text-xs rounded transition-colors border"
          :class="
            mirrorStore.settings.recordBitrate === br
              ? 'bg-accent border-border text-foreground'
              : 'border-border/30 text-muted-foreground hover:text-foreground hover:bg-accent/50'
          "
          @click="mirrorStore.settings.recordBitrate = br"
        >
          {{ br }}
        </button>
      </div>
    </div>
  </div>
</template>
