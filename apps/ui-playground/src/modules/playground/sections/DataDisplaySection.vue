<script setup lang="ts">
import { Chip } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundColorControl from "../components/PlaygroundColorControl.vue";
import PlaygroundSegmented from "../components/PlaygroundSegmented.vue";
import PlaygroundSwitchControl from "../components/PlaygroundSwitchControl.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const color = ref<UiAccent>("neutral");
const disabled = ref(false);
const rounded = ref(false);
const size = ref("md");
const variant = ref("gradient");
const sizes = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;
const variants = ["gradient", "solid", "transparent", "gradient-fill"] as const;
const code = computed(
  () => `<Chip
  color="${color.value}"
  size="${size.value}"
  variant="${variant.value}"
  ${rounded.value ? "rounded" : ':rounded="false"'}
  ${disabled.value ? "disabled" : ':disabled="false"'}
>
  Connected
</Chip>`,
);
</script>

<template>
  <CatalogSection
    description="Compact status language with the same surface, color and density controls."
    eyebrow="03 · Data display"
    id="data-display"
    title="Chip"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <Chip
          :color="color"
          :disabled="disabled || !props.interactionsEnabled"
          :rounded="rounded"
          :size="size"
          :variant="variant"
        >
          Connected
        </Chip>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="size" :items="sizes" label="Chip size" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="variant" :items="variants" label="Chip variant" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="rounded" label="rounded" />
          <PlaygroundSwitchControl v-model="disabled" label="disabled" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundColorControl v-model="color" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
