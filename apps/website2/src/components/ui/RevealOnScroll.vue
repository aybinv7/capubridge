<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    as?: string;
    delay?: number;
    distance?: number;
  }>(),
  { as: "div", delay: 0, distance: 16 },
);

const host = ref<HTMLElement | null>(null);
const shown = ref(false);

/**
 * Armed at setup, not on mount, so the hidden state is part of the first paint
 * and there is no flash. When motion is reduced or IntersectionObserver is
 * missing the element simply never arms, which leaves it visible.
 */
const armed =
  typeof window !== "undefined" &&
  typeof IntersectionObserver !== "undefined" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let observer: IntersectionObserver | undefined;
let failsafe: number | undefined;

onMounted(() => {
  if (!armed || !host.value) return;

  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        shown.value = true;
        observer?.disconnect();
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
  );
  observer.observe(host.value);

  /**
   * If the observer never fires - a throttled background tab, a layout the
   * observer cannot resolve - the content must not stay hidden.
   */
  failsafe = window.setTimeout(() => {
    shown.value = true;
    observer?.disconnect();
  }, 1600);
});

onBeforeUnmount(() => {
  if (failsafe) window.clearTimeout(failsafe);
  observer?.disconnect();
});
</script>

<template>
  <component
    :is="props.as"
    ref="host"
    :class="armed ? ['reveal', { 'is-shown': shown }] : undefined"
    :style="
      armed
        ? { '--reveal-delay': `${props.delay}ms`, '--reveal-distance': `${props.distance}px` }
        : undefined
    "
  >
    <slot />
  </component>
</template>

<style scoped>
.reveal {
  opacity: 0;
  transform: translate3d(0, var(--reveal-distance, 16px), 0);
  transition:
    opacity 520ms ease,
    transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--reveal-delay, 0ms);
  will-change: opacity, transform;
}

.reveal.is-shown {
  opacity: 1;
  transform: translate3d(0, 0, 0);
  will-change: auto;
}
</style>
