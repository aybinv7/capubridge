<script setup lang="ts">
import { Select } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent, UiSize } from "@capubridge/ui";

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

const fruits = ["Apple", "Banana", "Cherry", "Mango", "Pineapple", "Strawberry"] as const;
const sizes = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;

const size = ref<UiSize>("md");
const color = ref<UiAccent>("brand");
const rounded = ref(false);
const multiple = ref(false);
const search = ref(false);
const keyboardHints = ref(true);
const single = ref("Cherry");
const many = ref<string[]>(["Apple", "Mango"]);

const fruitValue = computed<string | string[]>({
  get: () => (multiple.value ? many.value : single.value),
  set: (value) => {
    if (Array.isArray(value)) many.value = value.map(String);
    else single.value = String(value);
  },
});

const code = computed(
  () => `<Select
  v-model="fruitValue"
  size="${size.value}"
  color="${color.value}"
  :rounded="${rounded.value}"
  :multiple="${multiple.value}"
  :search="${search.value}"
  :keyboard-hints="${keyboardHints.value}"
  title="Fruit"
  :options="fruits"
  :search-filter="filterFruits"
  placeholder="Pick a fruit"
/>`,
);

function filterFruits(query: string): readonly string[] {
  return fruits.filter((fruit) => fruit.toLowerCase().includes(query.toLowerCase()));
}
</script>

<template>
  <CatalogSection
    description="One controlled picker for single or multiple values, filtering, keyboard hints, and every shared size."
    eyebrow="04 · Forms"
    id="select"
    title="Select"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <Select
          v-model="fruitValue"
          class="select-playground-preview"
          :color="color"
          :disabled="!props.interactionsEnabled"
          :keyboard-hints="keyboardHints"
          :multiple="multiple"
          :options="fruits"
          placeholder="Pick a fruit"
          :rounded="rounded"
          :search="search"
          :search-filter="filterFruits"
          :size="size"
          title="Fruit"
        />
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="size" :items="sizes" label="Select size" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="multiple" label="multiple" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="search" label="search" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="keyboardHints" label="keyboardHints" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="rounded" label="rounded" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundColorControl v-model="color" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
