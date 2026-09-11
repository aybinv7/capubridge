<script setup lang="ts">
import GradualBlur from "@/components/GradualBlur/GradualBlur.vue";
import ScrollFilament from "@/components/ui/ScrollFilament.vue";
import SideRail from "@/components/layout/SideRail.vue";
</script>

<template>
  <div class="page-grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />

  <SideRail />
  <ScrollFilament />

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
