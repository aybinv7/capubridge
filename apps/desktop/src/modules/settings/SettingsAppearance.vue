<script setup lang="ts">
import { useTheme } from "@/composables/useTheme";
import ThemeCard from "./components/ThemeCard.vue";

const { themeId, availableThemes, setTheme } = useTheme();
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div class="max-w-3xl space-y-8">
      <section>
        <header class="mb-3">
          <h2 class="text-sm font-medium text-[var(--fg-default)]">Theme</h2>
          <p class="text-xs text-[var(--fg-muted)]">
            Pick a palette. The accent color is set separately below.
          </p>
        </header>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
          <ThemeCard
            v-for="theme in availableThemes"
            :key="theme.id"
            :theme="theme"
            :active="themeId === theme.id"
            @select="setTheme"
          />
        </div>
      </section>

      <!-- Accent picker arrives in Task 12. -->
    </div>
  </div>
</template>
