<script setup lang="ts">
import { Button, Tooltip } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundSegmented from "../components/PlaygroundSegmented.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const tooltipPosition = ref("top");
const tooltipPositions = ["top", "bottom"] as const;

const tooltipCode = computed(
  () => `<Tooltip position="${tooltipPosition.value}" :timeout="false">
  <template #trigger>
    <Button>Hover me</Button>
  </template>
  Forwards the CDP port for this target
</Tooltip>`,
);
</script>

<template>
  <CatalogSection
    description="A portalled hover/focus label with a delayed show and matching position contract."
    eyebrow="05 · Overlays"
    id="tooltip"
    title="Tooltip"
  >
    <ComponentPlayground :code="tooltipCode" preview-surface>
      <template #preview>
        <Tooltip :position="tooltipPosition" :timeout="false">
          <template #trigger>
            <Button :disabled="!props.interactionsEnabled">Hover me</Button>
          </template>
          Forwards the CDP port for this target
        </Tooltip>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented
            v-model="tooltipPosition"
            :items="tooltipPositions"
            label="Tooltip position"
          />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
