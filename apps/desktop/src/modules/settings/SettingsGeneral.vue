<script setup lang="ts">
import { Languages, Bell } from "lucide-vue-next";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection title="General" description="Application-wide preferences.">
      <SettingsRow label="Display language" description="Set the UI language">
        <span class="inline-flex items-center gap-2 text-xs text-[var(--fg-muted)]">
          <Languages :size="14" />
          English
        </span>
      </SettingsRow>

      <SettingsRow
        label="Desktop notifications"
        description="Show system notifications for device events"
      >
        <span class="inline-flex items-center gap-2 text-xs text-[var(--fg-muted)]">
          <Bell :size="14" />
          Off
        </span>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
