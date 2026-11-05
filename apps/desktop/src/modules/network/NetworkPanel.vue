<script setup lang="ts">
import GatedRouterView from "@/components/gate/GatedRouterView.vue";
import SubNavTabs from "@/components/layout/SubNavTabs.vue";
import { useNetworkCommands } from "./useNetworkCommands";

useNetworkCommands();
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <SubNavTabs />
    <div class="min-h-0 flex-1 overflow-hidden">
      <GatedRouterView />
    </div>
  </div>
</template>
