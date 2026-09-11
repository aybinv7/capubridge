<script setup lang="ts">
import "./style.css";

import PageFrame from "@/components/layout/PageFrame.vue";
import SiteHeader from "@/components/layout/SiteHeader.vue";
import SiteFooter from "@/components/layout/SiteFooter.vue";
import HeroSection from "@/components/sections/HeroSection.vue";
import RuntimeMarquee from "@/components/sections/RuntimeMarquee.vue";
import HowItWorksSection from "@/components/sections/HowItWorksSection.vue";
import FeaturesSection from "@/components/sections/FeaturesSection.vue";
import FlagshipSection from "@/components/sections/FlagshipSection.vue";
import DownloadSection from "@/components/sections/DownloadSection.vue";
</script>

<template>
  <PageFrame />
  <SiteHeader />
  <main>
    <HeroSection />
    <RuntimeMarquee />
    <HowItWorksSection />
    <FeaturesSection />
    <FlagshipSection />
    <DownloadSection />
  </main>
  <SiteFooter />
</template>
