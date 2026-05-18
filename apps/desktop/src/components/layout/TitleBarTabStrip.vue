<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  Smartphone,
  AppWindow,
  Database,
  Globe,
  Crosshair,
  MonitorPlay,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-vue-next";

const route = useRoute();

/**
 * Slice-2 stub: derive a single "tab" from the active route. When slice 3
 * lands the real tabs system, this component is replaced by the real strip
 * sourced from tabsStore.
 */

type StubTab = {
  label: string;
  icon: LucideIcon;
} | null;

const ROUTE_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  "/devices": { label: "Devices", icon: Smartphone },
  "/app": { label: "App", icon: AppWindow },
  "/storage": { label: "Storage", icon: Database },
  "/network": { label: "Network", icon: Globe },
  "/inspect": { label: "Inspect", icon: Crosshair },
  "/replay": { label: "Replay", icon: MonitorPlay },
  "/browser-preview": { label: "Browser Preview", icon: AppWindow },
  "/settings": { label: "Settings", icon: SettingsIcon },
};

const activeTab = computed<StubTab>(() => {
  const path = route.path;
  for (const prefix of Object.keys(ROUTE_LABELS)) {
    if (path.startsWith(prefix)) return ROUTE_LABELS[prefix];
  }
  return null;
});
</script>

<template>
  <div
    class="flex items-center gap-1 overflow-hidden"
    role="tablist"
    aria-label="Open tabs (preview)"
  >
    <div
      v-if="activeTab"
      class="relative flex h-7 max-w-[280px] items-center gap-1.5 truncate rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--fg-default)]"
      role="tab"
      :aria-selected="true"
    >
      <span
        class="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-[var(--accent)]"
        aria-hidden="true"
      />
      <component :is="activeTab.icon" :size="12" class="shrink-0 text-[var(--fg-muted)]" />
      <span class="truncate">{{ activeTab.label }}</span>
    </div>
  </div>
</template>
