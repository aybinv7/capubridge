<script setup lang="ts">
import { ref } from "vue";
import { ScreenShare, Camera, Video } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

const isRecording = ref(false);
const recordQuality = ref<"720p" | "1080p" | "1440p">("1080p");
const recordBitrate = ref("8");
const recordFormat = ref<"mp4" | "gif">("mp4");
</script>

<template>
  <div class="flex-1 flex gap-6 p-8 overflow-y-auto">
    <!-- Preview -->
    <div class="flex flex-col items-center gap-4">
      <div
        class="relative border border-border/30 bg-surface-2 overflow-hidden rounded-lg"
        style="width: 220px; height: 390px"
      >
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <ScreenShare class="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground/40">Live preview</p>
            <p class="text-xs text-muted-foreground/30">not connected</p>
          </div>
        </div>
        <div
          v-if="isRecording"
          class="absolute top-3 right-3 flex items-center gap-1.5 bg-error/90 text-white rounded-full px-2 py-0.5 text-xs font-medium"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          REC
        </div>
      </div>

      <div class="flex gap-2">
        <Button variant="outline" size="sm" class="gap-2">
          <Camera class="w-4 h-4" />
          Screenshot
        </Button>
        <Button
          :variant="isRecording ? 'destructive' : 'outline'"
          size="sm"
          class="gap-2"
          @click="isRecording = !isRecording"
        >
          <Video class="w-4 h-4" />
          {{ isRecording ? "Stop Recording" : "Record" }}
        </Button>
      </div>
    </div>

    <!-- Settings -->
    <div class="flex-1 max-w-xs space-y-5">
      <div>
        <div class="text-xs text-muted-foreground uppercase tracking-wider mb-2.5">
          Recording Quality
        </div>
        <div class="flex gap-1.5">
          <Button
            v-for="q in ['720p', '1080p', '1440p'] as const"
            :key="q"
            :variant="recordQuality === q ? 'default' : 'outline'"
            size="sm"
            class="flex-1"
            @click="recordQuality = q"
          >
            {{ q }}
          </Button>
        </div>
      </div>

      <div>
        <div class="text-xs text-muted-foreground uppercase tracking-wider mb-2.5">
          Bitrate (Mbps)
        </div>
        <div class="flex gap-1.5">
          <Button
            v-for="br in ['4', '8', '16', '20']"
            :key="br"
            :variant="recordBitrate === br ? 'default' : 'outline'"
            size="sm"
            class="flex-1"
            @click="recordBitrate = br"
          >
            {{ br }}
          </Button>
        </div>
      </div>

      <div>
        <div class="text-xs text-muted-foreground uppercase tracking-wider mb-2.5">
          Output Format
        </div>
        <div class="flex gap-1.5">
          <Button
            v-for="fmt in ['mp4', 'gif'] as const"
            :key="fmt"
            :variant="recordFormat === fmt ? 'default' : 'outline'"
            size="sm"
            class="flex-1 uppercase"
            @click="recordFormat = fmt"
          >
            {{ fmt }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
