<script setup lang="ts">
import { Database, HardDrive, Layers, Shield } from "lucide-vue-next";

const storageAPIs = [
  {
    name: "IndexedDB",
    status: "available",
    quota: "14.2 MB / 2.4 GB",
    icon: Database,
    color: "text-foreground",
  },
  {
    name: "LocalStorage",
    status: "available",
    quota: "18 keys / ~200 KB",
    icon: HardDrive,
    color: "text-info",
  },
  {
    name: "OPFS",
    status: "available",
    quota: "4 files / 5.1 MB",
    icon: Layers,
    color: "text-success",
  },
  {
    name: "Cache API",
    status: "available",
    quota: "2 caches / 2.6 MB",
    icon: Shield,
    color: "text-warning",
  },
];
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="max-w-xl space-y-3">
      <div
        v-for="api in storageAPIs"
        :key="api.name"
        class="flex items-center gap-4 p-4 border border-border bg-accent transition-all"
      >
        <div
          class="w-10 h-10 bg-secondary border border-border flex items-center justify-center shrink-0"
          :class="api.color"
        >
          <component :is="api.icon" class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-xs font-medium text-foreground">{{ api.name }}</span>
            <span class="text-2xs font-medium text-success">{{ api.status }}</span>
          </div>
          <div class="text-2xs text-muted-foreground font-mono">{{ api.quota }}</div>
        </div>
        <div class="w-1.5 h-1.5 rounded-full bg-success" />
      </div>
    </div>
  </div>
</template>
