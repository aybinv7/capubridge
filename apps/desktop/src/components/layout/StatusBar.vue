<script setup lang="ts">
import { Circle, Wifi, HardDrive, Activity } from "lucide-vue-next";
</script>

<template>
  <footer
    class="h-6 bg-background border-t border-border flex items-center px-3 text-2xs font-mono text-muted-foreground shrink-0 gap-4 select-none"
  >
    <span class="flex items-center gap-1.5">
      <Circle class="w-[5px] h-[5px] fill-success text-success" />
      Connected
    </span>
    <span class="flex items-center gap-1.5">
      <Wifi class="w-2.5 h-2.5" />
      USB 3.0
    </span>
    <span class="flex items-center gap-1.5">
      <Activity class="w-2.5 h-2.5" />
      12 req/s
    </span>
    <span class="flex items-center gap-1.5">
      <HardDrive class="w-2.5 h-2.5" />
      14.2 MB / 2.4 GB
    </span>
    <span class="ml-auto">Capubridge v0.1.0-alpha</span>
  </footer>
</template>
