<script setup lang="ts">
import AppShell from "@/components/layout/AppShell.vue";
import { TooltipProvider } from "@/components/ui/tooltip";
</script>

<template>
  <TooltipProvider :delay-duration="400" :skip-delay-duration="150">
    <AppShell />
  </TooltipProvider>
</template>
