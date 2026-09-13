<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { CHROME_CDP_PORT } from "@/config/ports";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection title="Chrome" description="How Capubridge launches and connects to Chrome.">
      <SettingsRow label="CDP port" :description="`Chrome debugging uses port ${CHROME_CDP_PORT}.`">
        <Badge variant="outline" class="text-[var(--fg-muted)]">Managed</Badge>
      </SettingsRow>
      <SettingsRow
        label="Chrome executable"
        description="Capubridge automatically detects a supported local Chrome installation."
      >
        <Badge variant="outline" class="text-[var(--fg-muted)]">Automatic</Badge>
      </SettingsRow>
      <SettingsRow
        label="Launch configuration"
        description="Custom executable paths, launch flags, and connection modes are not configurable yet."
      >
        <Badge variant="outline" class="text-[var(--fg-muted)]">Unavailable</Badge>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
