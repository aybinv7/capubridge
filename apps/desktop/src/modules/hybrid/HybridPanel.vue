<script setup lang="ts">
import { Puzzle } from "lucide-vue-next";
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
    <Puzzle :size="28" class="text-muted-foreground/15" />
    <div class="space-y-1">
      <p class="text-[12px] font-medium text-muted-foreground/40">Hybrid App Tools</p>
      <p class="text-[11px] text-muted-foreground/25">
        Capacitor plugin mapper · Sync queue · Migration tracker — Phase 5
      </p>
    </div>
  </div>
</template>
