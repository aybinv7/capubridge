<script setup lang="ts">
defineProps<{
  tabs: Array<{ label: string; icon: string; anchor: string }>;
}>();
</script>

<template>
  <div class="module-nav">
    <a v-for="tab in tabs" :key="tab.anchor" :href="`#${tab.anchor}`" class="module-nav-tab">
      <span class="module-nav-icon">{{ tab.icon }}</span>
      {{ tab.label }}
    </a>
  </div>
</template>
