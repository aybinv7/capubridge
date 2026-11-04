<script setup lang="ts">
import { useTheme } from "@/composables/useTheme";
import ThemeCard from "./components/ThemeCard.vue";
import SettingsSection from "./components/SettingsSection.vue";

const { themeId, availableThemes, setTheme } = useTheme();
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection
      title="Theme"
      description="Colour carries meaning: live, recording, selection and marks each own one hue."
    >
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
  </div>
</template>
