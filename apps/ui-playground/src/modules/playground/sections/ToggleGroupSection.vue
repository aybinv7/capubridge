<script setup lang="ts">
import { ToggleButton, ToggleGroup } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundSwitchControl from "../components/PlaygroundSwitchControl.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const toggleMultiple = ref(true);
const toggleValue = ref<string | string[] | undefined>("bold");
const toggleCode = computed(
  () => `<ToggleGroup v-model:value="value" ${toggleMultiple.value ? "multiple" : ""}>
  <ToggleButton value="bold">Bold</ToggleButton>
  <ToggleButton value="italic">Italic</ToggleButton>
  <ToggleButton value="underline">Underline</ToggleButton>
</ToggleGroup>`,
);
</script>

<template>
  <CatalogSection
    description="A self-managing set of pressed ToggleButtons — the caller doesn't wire the selection by hand, unlike Segmented/SegmentedButton."
    eyebrow="02 · Action"
    id="toggle-group"
    title="Toggle group"
  >
    <ComponentPlayground :code="toggleCode" preview-surface>
      <template #preview>
        <ToggleGroup v-model:value="toggleValue" :multiple="toggleMultiple">
          <ToggleButton :disabled="!props.interactionsEnabled" value="bold">Bold</ToggleButton>
          <ToggleButton :disabled="!props.interactionsEnabled" value="italic">Italic</ToggleButton>
          <ToggleButton :disabled="!props.interactionsEnabled" value="underline"
            >Underline</ToggleButton
          >
        </ToggleGroup>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="toggleMultiple" label="multiple" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
