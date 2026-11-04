<script setup lang="ts">
import { computed, ref } from "vue";
import type { Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useInspectPlugins } from "@/modules/inspect/useInspectPlugins";
import {
  Smartphone,
  AppWindow,
  Package,
  FolderOpen,
  Gauge,
  Battery,
  Database,
  HardDrive,
  Archive,
  Globe,
  Palette,
  Keyboard,
  DatabaseZap,
  Table2,
  Crosshair,
} from "lucide-vue-next";

import { isRouteEnabled } from "@/app/feature-registry";

const route = useRoute();
const router = useRouter();
const inspectPlugins = useInspectPlugins();
const tabRefs = ref<HTMLButtonElement[]>([]);

const iconMap: Record<string, typeof Smartphone> = {
  "devices-overview": Smartphone,
  "devices-apps": Package,
  "devices-files": FolderOpen,
  "devices-performance": Gauge,
  "app-overview": AppWindow,
  "app-performance": Gauge,
  "app-data-usage": Battery,
  "storage-indexeddb": HardDrive,
  "storage-localforage": Database,
  "storage-localstorage": DatabaseZap,
  "storage-cache": Archive,
  "storage-opfs": FolderOpen,
  "storage-sqlite": Table2,
  "storage-graph": Database,
  "network-requests": Globe,
  "network-mock": Archive,
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
      if (
        !r.path ||
        r.path.startsWith(":") ||
        !r.name ||
        r.meta?.navigation === false ||
        !isRouteEnabled(r)
      )
        return false;
      return true;
    })
    .map((r) => {
      const parentPath = parentRoute.path.replace(/\/$/, "");
      const childPath = r.path.replace(/^\//, "").split("/")[0];
      const fullPath = childPath ? `${parentPath}/${childPath}` : parentPath;
      const name = r.name as string;
      return {
        name,
        label: typeof r.meta?.label === "string" ? r.meta.label : formatLabel(name),
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

function focusTab(index: number) {
  const count = subTabs.value.length;
  if (count === 0) return;
  const next = (index + count) % count;
  tabRefs.value[next]?.focus();
  void router.push(subTabs.value[next].path);
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusTab(index + 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    focusTab(index - 1);
  } else if (event.key === "Home") {
    event.preventDefault();
    focusTab(0);
  } else if (event.key === "End") {
    event.preventDefault();
    focusTab(subTabs.value.length - 1);
  }
}
</script>

<template>
  <div
    role="tablist"
    class="flex h-9 shrink-0 items-stretch gap-0.5 border-b border-[var(--border-subtle)] bg-[var(--bg-chrome)] px-2"
  >
    <button
      v-for="(tab, index) in subTabs"
      :key="tab.name"
      :ref="(el) => (tabRefs[index] = el as HTMLButtonElement)"
      role="tab"
      :aria-selected="isActive(tab.path)"
      :tabindex="isActive(tab.path) ? 0 : -1"
      class="relative flex items-center gap-1.5 rounded-t-md px-2.5 text-sm transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      :class="
        isActive(tab.path)
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-surface-raised)]/60'
      "
      @click="router.push(tab.path)"
      @keydown="onKeydown($event, index)"
    >
      <component
        v-if="tab.icon"
        :is="tab.icon"
        :size="14"
        :class="['shrink-0', isActive(tab.path) ? 'opacity-100' : 'opacity-60']"
      />
      {{ tab.label }}
      <span
        v-if="isActive(tab.path)"
        class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-signal-select"
      />
    </button>
  </div>
</template>
