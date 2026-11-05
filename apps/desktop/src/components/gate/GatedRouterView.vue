<script setup lang="ts">
import { RouterView } from "vue-router";
import GatedView from "@/components/gate/GatedView.vue";
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <GatedView :requirement="route.meta.requires ?? 'none'" :secondary="route.meta.gateCommand">
      <component :is="Component" />
    </GatedView>
  </RouterView>
</template>
