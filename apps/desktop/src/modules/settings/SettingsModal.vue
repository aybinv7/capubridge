<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Settings as SettingsIcon,
  Palette,
  Wrench,
  Globe,
  Keyboard,
  Download,
  Bot,
} from "lucide-vue-next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUpdaterStore } from "@/stores/updater.store";
import { useMcpStore } from "@/stores/mcp.store";

const route = useRoute();
const router = useRouter();
const updater = useUpdaterStore();
const mcp = useMcpStore();

const sections = [
  { name: "settings-general", label: "General", path: "/settings/general", icon: SettingsIcon },
  {
    name: "settings-appearance",
    label: "Appearance",
    path: "/settings/appearance",
    icon: Palette,
  },
  { name: "settings-adb", label: "ADB", path: "/settings/adb", icon: Wrench },
  { name: "settings-chrome", label: "Chrome", path: "/settings/chrome", icon: Globe },
  { name: "settings-shortcuts", label: "Shortcuts", path: "/settings/shortcuts", icon: Keyboard },
  { name: "settings-mcp", label: "AI / MCP", path: "/settings/mcp", icon: Bot },
  { name: "settings-updates", label: "Updates", path: "/settings/updates", icon: Download },
] as const;

onMounted(() => {
  void mcp.refresh();
});

const isOpen = computed(() => route.path.startsWith("/settings"));

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + "/");
}

function closeModal() {
  // Prefer going back if there's history, otherwise route to a safe default.
  if (window.history.state && window.history.state.back) {
    router.back();
  } else {
    router.push("/devices");
  }
}

function handleOpenChange(open: boolean) {
  if (!open) closeModal();
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="handleOpenChange">
    <DialogContent
      class="grid h-[80vh] max-h-[820px] w-[80vw] max-w-[1100px] grid-rows-[auto_auto_1fr] gap-0 overflow-hidden border-[var(--border-default)] bg-[var(--bg-surface)] p-0 sm:max-w-[1100px]"
    >
      <header
        class="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4"
      >
        <DialogTitle class="text-base font-medium text-[var(--fg-default)]">Settings</DialogTitle>
      </header>

      <nav
        class="flex items-center gap-1 border-b border-[var(--border-subtle)] px-4"
        role="tablist"
        aria-label="Settings sections"
      >
        <button
          v-for="section in sections"
          :key="section.name"
          type="button"
          role="tab"
          :aria-selected="isActive(section.path)"
          :class="[
            'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]',
            isActive(section.path)
              ? 'border-[var(--accent)] font-medium text-[var(--fg-default)]'
              : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-default)]',
          ]"
          @click="router.replace(section.path)"
        >
          <component :is="section.icon" :size="14" class="shrink-0" />
          {{ section.label }}
          <span
            v-if="section.name === 'settings-updates' && updater.updateAvailable"
            class="ml-1 size-1.5 rounded-full bg-[var(--accent)]"
            aria-label="Update available"
          />
          <span
            v-if="section.name === 'settings-mcp' && mcp.running"
            class="ml-1 size-1.5 rounded-full bg-[var(--accent)]"
            aria-label="MCP running"
          />
        </button>
      </nav>

      <div class="overflow-y-auto">
        <RouterView />
      </div>
    </DialogContent>
  </Dialog>
</template>
