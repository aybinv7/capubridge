<script setup lang="ts">
import { Keyboard } from "lucide-vue-next";

const shortcuts = [
  { keys: "Ctrl+1-5", action: "Switch to panel 1-5" },
  { keys: "Ctrl+J", action: "Toggle bottom dock" },
  { keys: "Ctrl+B", action: "Toggle sidebar" },
  { keys: "Ctrl+1-5 (dock)", action: "Jump dock tabs while dock is focused" },
  { keys: "Ctrl+↑ / Ctrl+↓", action: "Resize dock while dock is focused" },
  { keys: "Esc", action: "Return focus from dock to main content" },
  { keys: "Ctrl+R", action: "Refresh active panel data" },
  { keys: "Ctrl+Enter", action: "Run query in active console" },
  { keys: "Ctrl+S", action: "Save current snapshot" },
  { keys: "Ctrl+F", action: "Focus search in active panel" },
  { keys: "Ctrl+Shift+C", action: "Clear active log/network/console" },
  { keys: "Ctrl+,", action: "Open settings" },
  { keys: "F5", action: "Reconnect to selected target" },
  { keys: "Ctrl+K", action: "Open command palette" },
];
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div class="max-w-xl space-y-6">
      <div>
        <h3 class="text-sm font-medium text-foreground mb-3">Keyboard Shortcuts</h3>
        <div class="space-y-1">
          <div
            v-for="sc in shortcuts"
            :key="sc.keys"
            class="flex items-center justify-between p-3 bg-accent border border-border"
          >
            <span class="text-xs text-foreground">{{ sc.action }}</span>
            <kbd
              class="text-2xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded border border-border"
            >
              {{ sc.keys }}
            </kbd>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
