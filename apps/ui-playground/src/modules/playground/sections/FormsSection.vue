<script setup lang="ts">
import { Slider } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundColorControl from "../components/PlaygroundColorControl.vue";
import PlaygroundSegmented from "../components/PlaygroundSegmented.vue";
import PlaygroundSwitchControl from "../components/PlaygroundSwitchControl.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";
import { createSliderCode } from "../component-docs";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const value = ref(50);
const color = ref<UiAccent>("neutral");
const disabled = ref(false);
const readOnly = ref(false);
const size = ref<"xs" | "sm" | "md">("md");
const sizes = ["xs", "sm", "md"] as const;
const code = computed(() =>
  createSliderCode({
    color: color.value,
    disabled: disabled.value,
    readOnly: readOnly.value,
    size: size.value,
  }),
);

function setDisabled(next: boolean): void {
  disabled.value = next;
  if (next) readOnly.value = false;
}

function setReadOnly(next: boolean): void {
  readOnly.value = next;
  if (next) disabled.value = false;
}
</script>

<template>
  <CatalogSection
    description="A continuous control with Cladd's thumb, fill and value-motion contract."
    eyebrow="04 · Forms"
    id="forms"
    title="Slider"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <div class="slider-playground-preview">
          <Slider
            v-model="value"
            aria-label="Slider playground value"
            class="slider-playground-preview__control"
            :color="color"
            :disabled="disabled || !props.interactionsEnabled"
            :read-only="readOnly"
            :size="size"
          />
        </div>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="size" :items="sizes" label="Slider size" />
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
