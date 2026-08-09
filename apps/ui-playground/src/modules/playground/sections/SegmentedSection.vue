<script setup lang="ts">
import { Segmented, SegmentedButton } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundSegmented from "../components/PlaygroundSegmented.vue";
import PlaygroundSwitchControl from "../components/PlaygroundSwitchControl.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const sizes = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;

const segmentedOptions = ["Grid", "List", "Table"] as const;
const segmentedActive = ref<(typeof segmentedOptions)[number]>("Grid");
const segmentedRounded = ref(true);
const segmentedDisabled = ref(false);
const segmentedSize = ref("md");
const segmentedCode = computed(
  () => `<Segmented ${segmentedRounded.value ? "" : ':rounded="false"'} size="${segmentedSize.value}">
${segmentedOptions
    .map(
      (option) =>
        `  <SegmentedButton :active="active === '${option}'" @click="active = '${option}'">${option}</SegmentedButton>`,
    )
    .join("\n")}
</Segmented>`,
);
</script>

<template>
  <CatalogSection
    description="A grouped set of mutually exclusive segment buttons, sharing size and roundness through context."
    eyebrow="02 · Action"
    id="segmented"
    title="Segmented"
  >
    <ComponentPlayground :code="segmentedCode" preview-surface>
      <template #preview>
        <Segmented
          :disabled="segmentedDisabled || !props.interactionsEnabled"
          :rounded="segmentedRounded"
          :size="segmentedSize"
        >
          <SegmentedButton
            v-for="option in segmentedOptions"
            :key="option"
            :active="segmentedActive === option"
            @click="segmentedActive = option"
          >
            {{ option }}
          </SegmentedButton>
        </Segmented>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="segmentedSize" :items="sizes" label="Segment size" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl label="rounded" v-model="segmentedRounded" />
          <PlaygroundSwitchControl label="disabled" v-model="segmentedDisabled" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
