<script setup lang="ts">
import { Surface, SurfaceCut, surfaceLevels, surfaceVariants } from "@capubridge/ui";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";

defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();
</script>

<template>
  <CatalogSection
    description="Elevation, inherited context, fill behavior and the signature inset cut."
    eyebrow="01 · Foundation"
    id="surfaces"
    title="Surfaces"
  >
    <div class="specimen-group">
      <div class="specimen-label">
        <span>Elevation scale</span>
        <code>level 1—5</code>
      </div>
      <div class="surface-level-grid">
        <Surface
          v-for="level in surfaceLevels"
          :key="level"
          class="surface-swatch"
          :level="level"
          outline
          variant="gradient"
        >
          <strong>Level {{ level }}</strong>
          <span>Inherited surface</span>
        </Surface>
      </div>
    </div>

    <div class="specimen-group">
      <div class="specimen-label">
        <span>Surface variants</span>
        <code>5 contracts</code>
      </div>
      <div class="surface-variant-grid">
        <Surface
          v-for="variant in surfaceVariants"
          :key="variant"
          class="surface-swatch surface-swatch--compact"
          :variant="variant"
          :outline="!variant.includes('fill')"
        >
          <strong>{{ variant }}</strong>
          <span>hover to inspect</span>
        </Surface>
      </div>
    </div>

    <div class="specimen-group">
      <div class="specimen-label">
        <span>Nested context and cut</span>
        <code>automatic depth</code>
      </div>
      <Surface class="nested-surface" :level="2" outline>
        <div class="nested-surface__copy">
          <span>Parent surface</span>
          <strong>Level 2</strong>
        </div>
        <Surface class="nested-surface__child" outline variant="gradient">
          <span>Implicit child</span>
          <strong>Level 3</strong>
          <SurfaceCut class="nested-surface__cut" hoverable>
            <span>SurfaceCut</span>
            <strong>Carved back to parent depth</strong>
          </SurfaceCut>
        </Surface>
      </Surface>
    </div>
  </CatalogSection>
</template>
