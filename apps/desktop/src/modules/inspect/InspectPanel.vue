<script setup lang="ts">
import { RouterView } from "vue-router";
import SubNavTabs from "@/components/layout/SubNavTabs.vue";
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <SubNavTabs />
    <div class="flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
