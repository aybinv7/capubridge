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
  RefreshCw,
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
  <div class="h-10 border-b border-border/20 bg-surface-1 flex items-center px-1 shrink-0">
    <div class="flex items-center gap-0">
      <button
        v-for="tab in subTabs"
        :key="tab.name"
        @click="router.push(tab.path)"
        class="relative flex items-center gap-1.5 px-3 py-2 text-xs transition-colors duration-150 rounded-none"
        :class="
          isActive(tab.path)
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-secondary-foreground'
        "
      >
        <component v-if="tab.icon" :is="tab.icon" :size="13" class="shrink-0" />
        {{ tab.label }}
        <div
          v-if="isActive(tab.path)"
          class="absolute bottom-0 left-1 right-1 h-[2px] bg-primary rounded-full"
        />
      </button>
    </div>
  </div>
</template>
