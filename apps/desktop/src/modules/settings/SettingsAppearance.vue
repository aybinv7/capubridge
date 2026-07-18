<script setup lang="ts">
import { useTheme } from "@/composables/useTheme";
import ThemeCard from "./components/ThemeCard.vue";
import AccentSwatch from "./components/AccentSwatch.vue";
import SettingsSection from "./components/SettingsSection.vue";

const {
  themeId,
  accentId,
  customAccentHex,
  availableThemes,
  availableAccents,
  setTheme,
  setAccent,
  setCustomAccent,
} = useTheme();
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection title="Theme" description="Pick a palette. The accent color is set below.">
      <div class="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
        <ThemeCard
          v-for="theme in availableThemes"
          :key="theme.id"
          :theme="theme"
          :active="themeId === theme.id"
          @select="setTheme"
        />
      </div>
    </SettingsSection>

    <SettingsSection
      title="Accent"
      description="The active-thing color — focus rings, active tabs, primary buttons."
    >
      <div class="flex flex-wrap items-center gap-3 p-4">
        <AccentSwatch
          v-for="accent in availableAccents"
          :key="accent.id"
          :accent="accent"
          :active="accentId === accent.id"
          @select="setAccent"
        />
        <label class="ml-2 inline-flex items-center gap-2 text-xs text-[var(--fg-muted)]">
          <span>Custom</span>
          <input
            type="color"
            class="h-9 w-9 cursor-pointer rounded-md border border-[var(--border-default)] bg-transparent"
            :value="customAccentHex ?? '#3b82f6'"
            @input="(e) => setCustomAccent((e.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </SettingsSection>
  </div>
</template>
