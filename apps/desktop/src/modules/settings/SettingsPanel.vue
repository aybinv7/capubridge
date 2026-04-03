<script setup lang="ts">
import { Settings } from "lucide-vue-next";
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
    <Settings :size="28" class="text-muted-foreground/15" />
    <div class="space-y-1">
      <p class="text-[12px] font-medium text-muted-foreground/40">Settings</p>
      <p class="text-[11px] text-muted-foreground/25">
        ADB path · Theme · Keyboard shortcuts — Phase 6
      </p>
    </div>
  </div>
</template>
