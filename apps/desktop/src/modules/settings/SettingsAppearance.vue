<script setup lang="ts">
import { useTheme } from "@/composables/useTheme";
import ThemeCard from "./components/ThemeCard.vue";
import AccentSwatch from "./components/AccentSwatch.vue";

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

      <section>
        <header class="mb-3">
          <h2 class="text-sm font-medium text-[var(--fg-default)]">Accent</h2>
          <p class="text-xs text-[var(--fg-muted)]">
            The accent is the active-thing color — focus rings, active tabs, primary buttons.
          </p>
        </header>
        <div class="flex flex-wrap items-center gap-3">
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
      </section>
    </div>
  </div>
</template>
