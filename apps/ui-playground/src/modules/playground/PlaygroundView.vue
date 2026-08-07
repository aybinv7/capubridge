<script setup lang="ts">
import { UiProvider } from "@capubridge/ui";
import { ref } from "vue";
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
</script>

<template>
  <UiProvider class="playground-shell" :accent="accent" :theme="theme">
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
  </UiProvider>
</template>
