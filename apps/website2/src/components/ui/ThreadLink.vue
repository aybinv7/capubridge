<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    href: string;
    external?: boolean;
    active?: boolean;
  }>(),
  { external: false, active: false },
);
</script>

<template>
  <a
    :href="props.href"
    :target="props.external ? '_blank' : undefined"
    :rel="props.external ? 'noopener' : undefined"
    class="thread-link filament-host relative inline-block py-1.5 text-[13px]"
    :class="props.active ? 'is-active' : ''"
    :data-drawn="props.active ? 'true' : 'false'"
  >
    <slot />
    <svg
      class="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] w-full overflow-visible"
      aria-hidden="true"
    >
      <line
        class="filament"
        style="--filament-length: 100"
        x1="0"
        y1="1"
        x2="100%"
        y2="1"
        pathLength="100"
      />
    </svg>
  </a>
</template>

<style scoped>
.thread-link {
  color: var(--ink-2);
  transition: color 180ms ease;
}

.thread-link:hover {
  color: var(--ink-0);
}

.is-active {
  color: var(--ink-0);
}
</style>
