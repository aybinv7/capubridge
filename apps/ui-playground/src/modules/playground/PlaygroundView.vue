<script setup lang="ts">
import { UiProvider } from "@capubridge/ui";
import { ref, watchEffect } from "vue";
import type { UiAccent, UiTheme } from "@capubridge/ui";
import { RouterView } from "vue-router";

import PlaygroundControls from "./components/PlaygroundControls.vue";
import PlaygroundHeader from "./components/PlaygroundHeader.vue";
import SectionNav from "./components/SectionNav.vue";
import { catalogComponentCount, catalogEntries, catalogStateCount } from "./playground.data";

const theme = ref<UiTheme>("dark");
const accent = ref<UiAccent>("neutral");
const interactionsEnabled = ref(true);

function toggleTheme(): void {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

// Cladd's provider publishes context only, so the app owns the theme class on its own root. Only
// `dark`/`light` goes here: upstream never puts `cladd-color-*` on a root — that class is applied
// per component (`Surface.tsx`: `color && cladd-color-${color}`), and the app-wide accent travels
// as context, which interactive components read through `useAccentColor()` as their default color.
// Putting it on the root would recompute `--cui-bg` and tint the whole page.
watchEffect(() => {
  const root = document.documentElement;
  root.classList.toggle("dark", theme.value === "dark");
  root.classList.toggle("light", theme.value === "light");
});
</script>

<template>
  <UiProvider :accent-color="accent" :theme="theme">
    <div class="playground-shell">
      <PlaygroundHeader
        :component-count="catalogComponentCount"
        :state-count="catalogStateCount"
        :theme="theme"
        @toggle-theme="toggleTheme"
      />
      <div class="playground-layout">
        <SectionNav :entries="catalogEntries" />
        <main class="playground-main">
          <PlaygroundControls
            :accent="accent"
            :interactions-enabled="interactionsEnabled"
            :theme="theme"
            @update-accent="accent = $event"
            @update-interactions="interactionsEnabled = $event"
            @update-theme="theme = $event"
          />
          <RouterView v-slot="{ Component, route }">
            <Transition mode="out-in" name="catalog-page">
              <component
                :is="Component"
                :key="route.path"
                :accent="accent"
                :interactions-enabled="interactionsEnabled"
              />
            </Transition>
          </RouterView>
        </main>
      </div>
    </div>
  </UiProvider>
</template>
