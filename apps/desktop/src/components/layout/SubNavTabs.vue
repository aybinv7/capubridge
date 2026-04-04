<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Smartphone,
  FileText,
  Package,
  Monitor,
  FolderOpen,
  ScreenShare,
  Gauge,
  Database,
  HardDrive,
  Archive,
  Globe,
  Terminal,
  AlertTriangle,
  Zap,
  Shield,
  Link,
  FileJson,
  Settings,
  Wrench,
  Palette,
  Keyboard,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const iconMap: Record<string, typeof Smartphone> = {
  "devices-overview": Smartphone,
  "devices-logcat": FileText,
  "devices-apps": Package,
  "devices-webview": Monitor,
  "devices-files": FolderOpen,
  "devices-screen": ScreenShare,
  "devices-perf": Gauge,
  "storage-indexeddb": Database,
  "storage-localstorage": HardDrive,
  "storage-cache": Archive,
  "storage-opfs": FolderOpen,
  "network-requests": Globe,
  "network-websocket": Terminal,
  "network-throttle": Gauge,
  "network-mock": Archive,
  "console-output": FileText,
  "console-repl": Terminal,
  "console-exceptions": AlertTriangle,
  "capacitor-bridge": Zap,
  "capacitor-plugins": Package,
  "capacitor-config": FileJson,
  "capacitor-permissions": Shield,
  "capacitor-deeplinks": Link,
  "settings-general": Settings,
  "settings-adb": Wrench,
  "settings-theme": Palette,
  "settings-shortcuts": Keyboard,
};

const subTabs = computed(() => {
  const parentRoute = route.matched[0];
  if (!parentRoute?.children) return [];

  return parentRoute.children
    .filter((r) => r.path && !r.path.startsWith(":") && r.name)
    .map((r) => {
      const parentPath = parentRoute.path.replace(/\/$/, "");
      const childPath = r.path.replace(/^\//, "");
      const fullPath = childPath ? `${parentPath}/${childPath}` : parentPath;
      const name = r.name as string;
      return {
        name,
        label: formatLabel(name),
        path: fullPath,
        icon: iconMap[name] ?? null,
      };
    });
});

function formatLabel(name: string): string {
  const parts = name.split("-").slice(1);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function isActive(tabPath: string): boolean {
  return route.path === tabPath || route.path.startsWith(tabPath + "/");
}
</script>

<template>
  <div class="h-9 border-b border-border bg-[#151515] flex items-end px-4 shrink-0">
    <button
      v-for="tab in subTabs"
      :key="tab.name"
      @click="router.push(tab.path)"
      class="relative flex items-center gap-1.5 px-3 py-2 text-xs transition-colors duration-150"
      :class="
        isActive(tab.path)
          ? 'text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      "
    >
      <component v-if="tab.icon" :is="tab.icon" :size="13" class="shrink-0" />
      {{ tab.label }}
      <div v-if="isActive(tab.path)" class="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground" />
    </button>
  </div>
</template>
