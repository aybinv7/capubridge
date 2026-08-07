<script setup lang="ts">
import { Button, Dialog } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundColorControl from "../components/PlaygroundColorControl.vue";
import PlaygroundSwitchControl from "../components/PlaygroundSwitchControl.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const color = ref<UiAccent>("neutral");
const open = ref(false);
const confirm = ref(false);
const code = computed(
  () => `<Dialog
  v-model="open"
  color="${color.value}"
  ${confirm.value ? 'confirm-text="Disconnect"' : ':confirm-text="undefined"'}
  title="Disconnect WebView?"
  description="The target can be attached again without losing its stored inspection state."
>
  <template #trigger>
    <Button>Open dialog</Button>
  </template>
</Dialog>`,
);
</script>

<template>
  <CatalogSection
    description="A portalled dialog with focus management, dismissal and controlled state."
    eyebrow="05 · Overlays"
    id="overlays"
    title="Dialog"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <Dialog
          v-model="open"
          :color="color"
          :confirm-text="confirm ? 'Disconnect' : undefined"
          description="The target can be attached again without losing its stored inspection state."
          title="Disconnect WebView?"
        >
          <template #trigger>
            <Button :disabled="!props.interactionsEnabled">Open dialog</Button>
          </template>
        </Dialog>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="confirm" label="confirmation action" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundColorControl v-model="color" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
