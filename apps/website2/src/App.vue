<script setup lang="ts">
import { computed } from "vue";
import "./style.css";

import HeroLaunch from "@/components/HeroLaunch.vue";
import HeroLaunchV2 from "@/components/HeroLaunchV2.vue";
import ProblemSection from "@/components/ProblemSection.vue";
import FeaturesSection from "@/components/FeaturesSection.vue";
import CTASection from "@/components/CTASection.vue";
import LaunchFooter from "@/components/LaunchFooter.vue";
import { heroModes } from "@/data/marketing";

const isV2 = computed(() => window.location.search.includes("v2"));
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
    <HeroLaunchV2 v-if="isV2" :modes="heroModes" />
    <HeroLaunch v-else :modes="heroModes" />
    <ProblemSection />
    <FeaturesSection />
    <CTASection />
    <LaunchFooter />
  </main>
</template>
