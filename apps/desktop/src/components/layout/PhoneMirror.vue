<script setup lang="ts">
import { ref } from "vue";
import { Video, Camera, ExternalLink } from "lucide-vue-next";

const isRecording = ref(false);
const panelWidth = ref(220);
const isResizing = ref(false);

function startResize(e: MouseEvent) {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = panelWidth.value;

  function onMove(ev: MouseEvent) {
    const delta = ev.clientX - startX;
    panelWidth.value = Math.max(160, Math.min(400, startWidth + delta));
  }

  function onUp() {
    isResizing.value = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function toggleRecording() {
  isRecording.value = !isRecording.value;
}
</script>

<template>
  <div class="flex shrink-0" :style="{ width: `${panelWidth}px` }">
    <!-- Mirror content -->
    <div class="flex-1 flex flex-col bg-background border-r border-border overflow-hidden">
      <!-- Phone frame -->
      <div class="flex-1 flex items-center justify-center p-4">
        <div
          class="w-full max-w-[180px] aspect-[9/19] border-2 border-border bg-black flex items-center justify-center relative"
        >
          <!-- Notch -->
          <div
            class="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-background/20 rounded-full"
          />
          <!-- Screen placeholder -->
          <div class="w-[90%] h-[88%] bg-background/10 flex flex-col p-2 gap-1.5">
            <div class="h-1.5 w-3/5 bg-border rounded-sm" />
            <div class="h-1 w-4/5 bg-border/20 rounded-sm" />
            <div class="h-1 w-2/5 bg-border/20 rounded-sm" />
            <div class="mt-2 space-y-1.5">
              <div class="h-4 w-full bg-border/15 rounded-sm" />
              <div class="h-4 w-full bg-border/15 rounded-sm" />
              <div class="h-4 w-full bg-border/15 rounded-sm" />
            </div>
          </div>
          <!-- Home indicator -->
          <div
            class="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-border rounded-full"
          />
        </div>
      </div>

      <!-- Mirror controls -->
      <div class="h-10 border-t border-border flex items-center justify-center gap-3 px-3 shrink-0">
        <button
          class="w-7 h-7 flex items-center justify-center border border-border rounded-sm transition-colors duration-150"
          :class="isRecording ? 'bg-error/10 border-error/30' : 'hover:bg-accent'"
          title="Record"
          @click="toggleRecording"
        >
          <div v-if="isRecording" class="w-2 h-2 rounded-full bg-error animate-pulse" />
          <Video v-else class="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center border border-border rounded-sm hover:bg-accent transition-colors duration-150"
          title="Screenshot"
        >
          <Camera class="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center border border-border rounded-sm hover:bg-accent transition-colors duration-150"
          title="Pop out to window"
        >
          <ExternalLink class="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>

    <!-- Resize handle -->
    <div
      class="w-1 cursor-col-resize flex items-center justify-center hover:bg-border transition-colors duration-150 shrink-0"
      @mousedown="startResize"
    >
      <div class="w-px h-6 bg-border" />
    </div>
  </div>
</template>
