<script setup lang="ts">
import { Button } from "@capubridge/ui";
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
const readOnly = ref(false);
const size = ref("md");
const variant = ref("gradient");
const sizes = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;
const variants = ["gradient", "solid", "transparent", "gradient-fill"] as const;
const code = computed(
  () => `<Button
  color="${color.value}"
  size="${size.value}"
  variant="${variant.value}"
  ${disabled.value ? "disabled" : ':disabled="false"'}
  ${readOnly.value ? "read-only" : ':read-only="false"'}
>
  Connect target
</Button>`,
);

function setDisabled(value: boolean): void {
  disabled.value = value;
  if (value) readOnly.value = false;
}

function setReadOnly(value: boolean): void {
  readOnly.value = value;
  if (value) disabled.value = false;
}
</script>

<template>
  <CatalogSection
    description="A single action surface with Cladd-sized geometry and press motion."
    eyebrow="02 · Action"
    id="buttons"
    title="Button"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <Button
          :color="color"
          :disabled="disabled || !props.interactionsEnabled"
          :read-only="readOnly"
          :size="size"
          :variant="variant"
        >
          Connect target
        </Button>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="size" :items="sizes" label="Button size" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="variant" :items="variants" label="Button variant" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl
            label="disabled"
            :model-value="disabled"
            @update:model-value="setDisabled"
          />
          <PlaygroundSwitchControl
            label="readOnly"
            :model-value="readOnly"
            @update:model-value="setReadOnly"
          />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundColorControl v-model="color" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
