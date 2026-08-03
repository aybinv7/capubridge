<script setup lang="ts">
import type { ComponentApiEntry } from "../playground.types";

defineProps<{
  entries: readonly ComponentApiEntry[];
}>();
</script>

<template>
  <div class="component-api" aria-label="Component API">
    <div class="component-api__header">
      <strong>API</strong>
      <span>{{ entries.length }} entries</span>
    </div>
    <div class="component-api__table" role="table">
      <div v-for="entry in entries" :key="entry.name" class="component-api__row" role="row">
        <code role="cell">{{ entry.name }}</code>
        <span role="cell">{{ entry.type }}</span>
        <code role="cell">{{ entry.defaultValue ?? "—" }}</code>
        <p role="cell">{{ entry.description }}</p>
      </div>
    </div>
  </div>
</template>
