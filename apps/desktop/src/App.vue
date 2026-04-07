<script setup lang="ts">
import AppShell from "@/components/layout/AppShell.vue";
import { Toaster } from "@/components/ui/sonner";
</script>

<template>
  <AppShell />
  <Toaster
    position="bottom-right"
    theme="dark"
    :rich-colors="true"
    :close-button="true"
    :visible-toasts="5"
    :duration="4000"
  />
</template>
