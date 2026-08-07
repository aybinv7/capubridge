<script setup lang="ts">
import { RouterLink } from "vue-router";

import type { CatalogEntry } from "../playground.types";

defineProps<{
  entries: CatalogEntry[];
}>();
</script>

<template>
  <aside class="section-nav" aria-label="Component catalog">
    <div class="section-nav__heading">
      <span class="section-nav__label">Components</span>
      <span>{{ entries.length }}</span>
    </div>
    <nav>
      <RouterLink v-for="entry in entries" :key="entry.id" :to="entry.path">
        <span class="section-nav__index">{{
          String(entries.indexOf(entry) + 1).padStart(2, "0")
        }}</span>
        <span class="section-nav__copy">
          <strong>{{ entry.label }}</strong>
          <small>{{ entry.description }}</small>
        </span>
        <span class="section-nav__count">{{ entry.count }}</span>
      </RouterLink>
    </nav>
    <div class="section-nav__footer">
      <span class="section-nav__pulse" />
      Package linked locally
    </div>
  </aside>
</template>
