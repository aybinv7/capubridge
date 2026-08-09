<script setup lang="ts">
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@capubridge/ui";
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

const sizes = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;

const toolbarSize = ref("md");
const toolbarCode = computed(
  () => `<Toolbar size="${toolbarSize.value}">
  <ToolbarButton>Copy</ToolbarButton>
  <ToolbarButton>Paste</ToolbarButton>
  <ToolbarSeparator />
  <ToolbarButton>Delete</ToolbarButton>
</Toolbar>`,
);
</script>

<template>
  <CatalogSection
    description="A Surface-backed action bar; ToolbarButton reads its size/rounded/variant/outline from the enclosing Toolbar by default."
    eyebrow="02 · Action"
    id="toolbar"
    title="Toolbar"
  >
    <ComponentPlayground :code="toolbarCode" preview-surface>
      <template #preview>
        <Toolbar :size="toolbarSize">
          <ToolbarButton :disabled="!props.interactionsEnabled">Copy</ToolbarButton>
          <ToolbarButton :disabled="!props.interactionsEnabled">Paste</ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton :disabled="!props.interactionsEnabled">Delete</ToolbarButton>
        </Toolbar>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="toolbarSize" :items="sizes" label="Toolbar button size" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
