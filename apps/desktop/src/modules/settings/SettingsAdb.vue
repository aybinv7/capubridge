<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection title="ADB" description="How Capubridge connects to Android devices.">
      <SettingsRow
        label="ADB runtime"
        description="Resolved when Capubridge starts from CAPUBRIDGE_ADB_PATH, bundled platform-tools, or adb on PATH."
      >
        <Badge variant="outline" class="text-[var(--fg-muted)]">Automatic</Badge>
      </SettingsRow>
      <SettingsRow
        label="Device refresh"
        description="Refresh timing is managed by the active device workspace and is not configurable yet."
      >
        <Badge variant="outline" class="text-[var(--fg-muted)]">Managed</Badge>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
