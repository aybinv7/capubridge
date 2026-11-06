<script setup lang="ts">
import { EXPANDED_HEIGHT, REST_HEIGHT } from "./stripGeometry";

/**
 * The strip's surface: a bevelled card on the page's own background that grows upward from
 * 28 px to its expanded height with transforms only. A top cap slides, a bottom cap stays, and
 * the middle scales on Y between them, so the bevel lines never stretch. `joined` squares the
 * resting top corners onto the console drawer above it.
 */
const props = withDefaults(defineProps<{ expanded: boolean; joined?: boolean }>(), {
  joined: false,
});

const CAP = REST_HEIGHT / 2;
const RISE = EXPANDED_HEIGHT - REST_HEIGHT;
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0"
    :style="{ height: `${EXPANDED_HEIGHT}px` }"
    aria-hidden="true"
  >
    <div class="absolute inset-x-0 bottom-0 overflow-hidden" :style="{ height: `${CAP}px` }">
      <div
        class="absolute inset-x-0 bottom-0 rounded-well bg-surface-0 shadow-bevel"
        :style="{ height: `${REST_HEIGHT}px` }"
      />
    </div>
    <div
      class="absolute inset-x-0 origin-bottom overflow-hidden transition-transform duration-300 ease-cladd-spring motion-reduce:transition-none"
      :style="{
        bottom: `${CAP}px`,
        height: `${RISE}px`,
        transform: `scaleY(${props.expanded ? 1 : 0})`,
      }"
    >
      <div
        class="absolute inset-x-0 bg-surface-0 shadow-bevel"
        :style="{ top: `-${CAP}px`, bottom: `-${CAP}px` }"
      />
    </div>
    <div
      class="absolute inset-x-0 top-0 overflow-hidden transition-transform duration-300 ease-cladd-spring motion-reduce:transition-none"
      :style="{ height: `${CAP}px`, transform: `translateY(${props.expanded ? 0 : RISE}px)` }"
    >
      <div
        class="absolute inset-x-0 top-0 bg-surface-0 shadow-bevel transition-[border-radius] duration-200"
        :class="props.joined && !props.expanded ? 'rounded-b-well' : 'rounded-well'"
        :style="{ height: `${REST_HEIGHT}px` }"
      />
    </div>
  </div>
</template>
