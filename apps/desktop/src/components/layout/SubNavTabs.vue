<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useInspectPlugins } from "@/modules/inspect/useInspectPlugins";
import {
  Smartphone,
  FileText,
  Package,
  Monitor,
  FolderOpen,
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
  DatabaseZap,
  Table2,
  Crosshair,
  Diff,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const inspectPlugins = useInspectPlugins();

const iconMap: Record<string, typeof Smartphone> = {
  "devices-overview": Smartphone,
  "devices-logcat": FileText,
  "devices-apps": Package,
  "devices-webview": Monitor,
  "devices-files": FolderOpen,
  "devices-performance": Gauge,
  "storage-indexeddb": HardDrive,
  "storage-localforage": Database,
  "storage-localstorage": DatabaseZap,
  "storage-cache": Archive,
  "storage-opfs": FolderOpen,
  "storage-sqlite": Table2,
  "storage-changes": Diff,
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
  "settings-chrome": Globe,
  "settings-theme": Palette,
  "settings-shortcuts": Keyboard,
  "inspect-elements": Crosshair,
};

type SubTab = {
  name: string;
  label: string;
  path: string;
  icon: Component | null;
};

const inspectSubTabs = computed<SubTab[]>(() => {
  const tabs: SubTab[] = [
    {
      name: "inspect-elements",
      label: "Elements",
      path: "/inspect/elements",
      icon: iconMap["inspect-elements"] ?? null,
    },
  ];

  inspectPlugins.plugins.value.forEach((plugin) => {
    tabs.push({
      name: plugin.routeName,
      label: plugin.name,
      path: `/inspect/${plugin.routeSegment}`,
      icon: plugin.icon,
    });
  });

  return tabs;
});

const subTabs = computed(() => {
  const parentRoute = route.matched[0];
  if (!parentRoute?.children) return [];
  if (parentRoute.path === "/inspect") return inspectSubTabs.value;

  return parentRoute.children
    .filter((r) => {
      if (!r.path || r.path.startsWith(":") || !r.name) return false;
      return true;
    })
    .map((r) => {
      const parentPath = parentRoute.path.replace(/\/$/, "");
      const childPath = r.path.replace(/^\//, "").split("/")[0];
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
  <div class="h-11 border-b border-border/30 bg-surface-0 flex items-center gap-1 px-1.5 shrink-0">
    <button
      v-for="tab in subTabs"
      :key="tab.name"
      @click="router.push(tab.path)"
      class="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors duration-150 rounded-xl"
      :class="
        isActive(tab.path)
          ? 'text-foreground font-medium bg-surface-3 border border-border/30'
          : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface-2'
      "
    >
      <component v-if="tab.icon" :is="tab.icon" :size="13" class="shrink-0 opacity-50" />
      {{ tab.label }}
    </button>
  </div>
</template>
