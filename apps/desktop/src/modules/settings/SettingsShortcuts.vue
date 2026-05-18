<script setup lang="ts">
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";

const shortcuts = [
  { keys: "Ctrl+K", action: "Open command palette" },
  { keys: "Ctrl+,", action: "Open settings" },
  { keys: "Ctrl+J", action: "Toggle bottom dock" },
  { keys: "Ctrl+B", action: "Toggle sidebar" },
  { keys: "Ctrl+1-5", action: "Switch to panel 1-5" },
  { keys: "Ctrl+1-5 (dock)", action: "Jump dock tabs while dock is focused" },
  { keys: "Ctrl+↑ / Ctrl+↓", action: "Resize dock while dock is focused" },
  { keys: "Esc", action: "Return focus from dock to main content" },
  { keys: "Ctrl+R", action: "Refresh active panel data" },
  { keys: "Ctrl+Enter", action: "Run query in active console" },
  { keys: "Ctrl+S", action: "Save current snapshot" },
  { keys: "Ctrl+F", action: "Focus search in active panel" },
  { keys: "Ctrl+Shift+C", action: "Clear active log/network/console" },
  { keys: "F5", action: "Reconnect to selected target" },
];
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection title="Keyboard shortcuts" description="Read-only for now.">
      <SettingsRow v-for="sc in shortcuts" :key="sc.keys" :label="sc.action">
        <kbd
          class="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[11px] text-[var(--fg-muted)]"
        >
          {{ sc.keys }}
        </kbd>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
