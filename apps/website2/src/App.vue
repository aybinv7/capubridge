<script setup lang="ts">
import BrandHeader from "@/components/BrandHeader.vue";
import FeatureBento from "@/components/FeatureBento.vue";
import HeroLaunch from "@/components/HeroLaunch.vue";
import LaunchFooter from "@/components/LaunchFooter.vue";
import { bentoCards, heroModes, navItems, systemChips, workflowChips } from "@/data/marketing";
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
    <BrandHeader :items="navItems" />
    <HeroLaunch :modes="heroModes" />
    <FeatureBento :cards="bentoCards" :system-chips="systemChips" :workflow-chips="workflowChips" />
    <LaunchFooter />
  </main>
</template>
