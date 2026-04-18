<script setup lang="ts">
import { RouterView } from "vue-router";
import SubNavTabs from "@/components/layout/SubNavTabs.vue";
import { useIndexedDBChangesTracking } from "@/modules/storage/changes/useIndexedDBChangesTracking";

useIndexedDBChangesTracking();
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <SubNavTabs />
    <div class="flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
