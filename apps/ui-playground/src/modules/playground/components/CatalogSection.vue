<script setup lang="ts">
import { Surface } from "@capubridge/ui";

defineProps<{
  description: string;
  eyebrow: string;
  id: string;
  title: string;
}>();
</script>

<template>
  <section :id="id" class="catalog-section">
    <header class="catalog-section__header">
      <span class="catalog-section__eyebrow">{{ eyebrow }}</span>
      <div>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
    </header>
    <Surface class="catalog-section__canvas" :level="2" outline variant="gradient">
      <slot />
    </Surface>
  </section>
</template>
