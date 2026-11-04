<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";
import { NavRail, NavRailItem } from "@capubridge/cladd";
import { primaryNavigationFeatures, utilityNavigationFeatures } from "@/app/feature-registry";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { useBindingHint } from "@/composables/useBindingHint";
import { shellIcons, type RailIconKey } from "@/shared/icons/shell-icons";

const route = useRoute();
const { keysOf } = useBindingHint();

function isActive(path: string) {
  return route.path.startsWith(path);
}

function railGlyph(key: RailIconKey, active: boolean) {
  const pair = shellIcons.rail[key];
  return active ? pair.filled : pair.regular;
}

function navKeys(featureId: string) {
  return keysOf(`nav.${featureId}`);
}
</script>

<template>
  <NavRail aria-label="Main" :labels="false" class="pb-2">
    <NavRailItem
      v-for="feature in primaryNavigationFeatures"
      :key="feature.id"
      :as="RouterLink"
      :to="feature.path"
      :label="feature.label"
      :active="isActive(feature.path)"
    >
      <template #icon="{ active }">
        <component :is="railGlyph(feature.railIcon, active)" />
      </template>
      <template #hint>
        <span v-if="feature.maturity !== 'stable'" class="font-normal text-muted-foreground">
          {{ feature.maturity }}
        </span>
        <KeyCaps v-if="navKeys(feature.id)" :keys="navKeys(feature.id) ?? ''" />
      </template>
    </NavRailItem>

    <template #footer>
      <NavRailItem
        v-for="feature in utilityNavigationFeatures"
        :key="feature.id"
        :as="RouterLink"
        :to="feature.path"
        :label="feature.label"
        :active="isActive(feature.path)"
      >
        <template #icon="{ active }">
          <component :is="railGlyph(feature.railIcon, active)" />
        </template>
        <template #hint>
          <KeyCaps v-if="navKeys(feature.id)" :keys="navKeys(feature.id) ?? ''" />
        </template>
      </NavRailItem>
    </template>
  </NavRail>
</template>
