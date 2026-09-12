<script setup lang="ts">
import GradualBlur from "@/components/GradualBlur/GradualBlur.vue";
import ScrollFilament from "@/components/ui/ScrollFilament.vue";
import SideRail from "@/components/layout/SideRail.vue";
import { useHeavyEffects } from "@/composables/useHeavyEffects";

const { heavyEffectsAllowed } = useHeavyEffects();
</script>

<template>
  <div class="page-grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />

  <SideRail />
  <ScrollFilament />

  <!--
    Fourteen fixed backdrop-filter layers between the two of these. Each one
    makes the compositor re-blur everything behind the strip on every scrolled
    frame, which a phone GPU cannot absorb while it is also driving the scroll.
  -->
  <template v-if="heavyEffectsAllowed">
    <GradualBlur
      position="top"
      target="page"
      height="3rem"
      :strength="1.1"
      :div-count="8"
      :opacity="0.85"
      curve="bezier"
    />
    <GradualBlur
      position="bottom"
      target="page"
      height="1rem"
      :strength="0.9"
      :div-count="6"
      :opacity="0.75"
      curve="bezier"
    />
  </template>

  <div v-else class="edge-scrim" aria-hidden="true" />
</template>
