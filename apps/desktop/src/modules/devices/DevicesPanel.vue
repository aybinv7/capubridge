<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import GatedRouterView from "@/components/gate/GatedRouterView.vue";
import SubNavTabs from "@/components/layout/SubNavTabs.vue";
import { provideDeviceVitals } from "./perf/useDeviceVitals";

const VITALS_ROUTES = new Set(["devices-overview", "devices-performance"]);

const route = useRoute();
provideDeviceVitals(computed(() => VITALS_ROUTES.has(String(route.name ?? ""))));
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <SubNavTabs />
    <div class="flex-1 overflow-hidden">
      <GatedRouterView />
    </div>
  </div>
</template>
