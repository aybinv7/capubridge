<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "primary" | "ghost";
    href?: string;
    external?: boolean;
    accent?: string;
  }>(),
  { variant: "ghost", accent: "var(--accent)" },
);

const plucking = ref(false);
let timer: number | undefined;

const pluck = () => {
  if (timer) window.clearTimeout(timer);
  plucking.value = true;
  timer = window.setTimeout(() => {
    plucking.value = false;
    timer = undefined;
  }, 460);
};
</script>

<template>
  <component
    :is="props.href ? 'a' : 'button'"
    :href="props.href"
    :target="props.external ? '_blank' : undefined"
    :rel="props.external ? 'noopener' : undefined"
    :type="props.href ? undefined : 'button'"
    class="thread-btn filament-host group relative inline-flex items-center gap-2.5 rounded-md px-5 py-3 text-[14px] font-semibold"
    :class="[props.variant === 'primary' ? 'is-primary' : 'is-ghost', { 'is-plucking': plucking }]"
    :style="{ '--card-accent': props.accent }"
    @pointerdown="pluck"
  >
    <svg
      class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <rect
        class="filament"
        style="--filament-length: 100"
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx="6"
        pathLength="100"
      />
    </svg>

    <span class="relative inline-flex items-center gap-2.5">
      <slot />
    </span>
  </component>
</template>

<style scoped>
.thread-btn {
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 200ms ease,
    color 200ms ease,
    border-color 200ms ease;
}

.thread-btn::after {
  position: absolute;
  inset: 0;
  border: 1px solid var(--card-accent);
  border-radius: 6px;
  content: "";
  opacity: 0;
  pointer-events: none;
}

.thread-btn.is-plucking::after {
  animation: ring 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes ring {
  0% {
    opacity: 0.85;
    transform: scale(1);
  }

  100% {
    opacity: 0;
    transform: scale(1.16);
  }
}

.is-primary {
  background: var(--accent);
  color: #141112;
}

.is-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.is-ghost {
  border: 1px solid var(--rule-strong);
  color: var(--ink-1);
}

.is-ghost:hover {
  border-color: transparent;
  color: var(--ink-0);
  transform: translateY(-1px);
}

.thread-btn:active {
  transform: translateY(1px) scale(0.985);
}
</style>
