<script setup lang="ts">
import { Spinner } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundColorControl from "../components/PlaygroundColorControl.vue";
import PlaygroundSegmented from "../components/PlaygroundSegmented.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const color = ref<UiAccent>("neutral");
const size = ref("md");
const sizes = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;
const code = computed(
  () => `<Spinner
  color="${color.value}"
  size="${size.value}"
/>`,
);
</script>

<template>
  <CatalogSection
    description="A focused loading signal with consistent optical weight at every size."
    eyebrow="06 · Feedback"
    id="feedback"
    title="Spinner"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <Spinner :color="color" :size="size" />
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="size" :items="sizes" label="Spinner size" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundColorControl v-model="color" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
