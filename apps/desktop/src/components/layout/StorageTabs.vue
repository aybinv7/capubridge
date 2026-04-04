<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { Database, HardDrive, Archive, FolderOpen } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const navItems = [
  {
    name: "storage-indexeddb",
    label: "IndexedDB",
    icon: Database,
    path: "/storage/indexeddb",
  },
  {
    name: "storage-localstorage",
    label: "LocalStorage",
    icon: HardDrive,
    path: "/storage/localstorage",
  },
  {
    name: "storage-cache",
    label: "Cache API",
    icon: Archive,
    path: "/storage/cache",
  },
  {
    name: "storage-opfs",
    label: "OPFS",
    icon: FolderOpen,
    path: "/storage/opfs",
  },
];

function isActive(name: string): boolean {
  console.log("nameeee", name, route.name);
  return route.name === name;
}
</script>

<template>
  <div class="h-10 border-b border-border bg-[#151515] flex items-center px-1 shrink-0">
    <div class="flex items-center gap-0">
      <button
        v-for="item in navItems"
        :key="item.name"
        @click="router.push(item.path)"
        class="relative flex items-center gap-1.5 px-3 py-2 text-xs transition-colors duration-150 rounded-none"
        :class="
          isActive(item.name)
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-secondary-foreground'
        "
      >
        <component :is="item.icon" :size="13" class="shrink-0" />
        {{ item.label }}
        <div
          v-if="isActive(item.name)"
          class="absolute bottom-0 left-1 right-1 bg-foreground rounded-full"
        />
      </button>
    </div>
  </div>
</template>
