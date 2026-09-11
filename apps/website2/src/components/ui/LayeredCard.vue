<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    accent?: string;
    as?: string;
    layers?: number;
  }>(),
  { accent: "var(--accent)", as: "div", layers: 3 },
);
</script>

<template>
  <component
    :is="props.as"
    class="layered filament-host relative block"
    :style="{ '--card-accent': props.accent }"
  >
    <span
      v-for="index in props.layers"
      :key="index"
      class="sheet pointer-events-none absolute inset-0 rounded-lg border"
      :style="{ '--sheet-index': index, '--sheet-delay': `${(index - 1) * 80}ms` }"
      aria-hidden="true"
    />

    <div class="relative h-full">
      <slot />
    </div>
  </component>
</template>

<style scoped>
/*
 * Ambient at rest, not hidden until hover: the peeled-sheet look is the
 * site's identity mark, so it has to be visible without an interaction to
 * discover it. Hover/focus just settles the sheets further out and
 * brightens them - an enhancement on top of a state that already reads.
 */
.sheet {
  border-color: color-mix(in srgb, var(--card-accent) 34%, transparent);
  transform: translate3d(calc(5px * var(--sheet-index)), calc(5px * var(--sheet-index)), 0);
}

.sheet:nth-of-type(1) {
  opacity: 0.4;
}

.sheet:nth-of-type(2) {
  opacity: 0.22;
}

.sheet:nth-of-type(3) {
  opacity: 0.12;
}

.layered:hover .sheet,
.layered:focus-visible .sheet,
.layered:focus-within .sheet {
  transform: translate3d(calc(9px * var(--sheet-index)), calc(9px * var(--sheet-index)), 0);
}

.layered:hover .sheet:nth-of-type(1),
.layered:focus-visible .sheet:nth-of-type(1),
.layered:focus-within .sheet:nth-of-type(1) {
  opacity: 0.6;
}

.layered:hover .sheet:nth-of-type(2),
.layered:focus-visible .sheet:nth-of-type(2),
.layered:focus-within .sheet:nth-of-type(2) {
  opacity: 0.34;
}

.layered:hover .sheet:nth-of-type(3),
.layered:focus-visible .sheet:nth-of-type(3),
.layered:focus-within .sheet:nth-of-type(3) {
  opacity: 0.18;
}

/* A calm press instead of the spring wobble - cards are not instruments. */
.layered:active {
  transform: scale(0.996);
  transition: transform 120ms ease;
}
</style>
