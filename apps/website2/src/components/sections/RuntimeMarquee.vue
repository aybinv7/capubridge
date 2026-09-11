<script setup lang="ts">
import { computed } from "vue";
import LogoLoop from "@/components/LogoLoop/LogoLoop.vue";
import { runtimes } from "@/data/runtimes";

/**
 * LogoLoop renders `node` through innerHTML, so the markup is built from the
 * local static table only and the styling lives in style.css where the scope
 * attribute cannot reach.
 */
const logos = computed(() =>
  runtimes.map((runtime) => ({
    node: `<span class="runtime-mark" style="--brand: ${runtime.color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${runtime.path}" /></svg><span class="runtime-name">${runtime.name}</span></span>`,
    title: runtime.name,
    ariaLabel: runtime.name,
  })),
);
</script>

<template>
  <section class="mx-auto max-w-[1360px] px-5 py-8 md:px-8 md:py-10">
    <div>
      <p class="text-center font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ink-3)]">
        Works with
      </p>

      <div class="mt-8 overflow-hidden md:mt-10">
        <LogoLoop
          :logos="logos"
          :speed="30"
          direction="left"
          :logo-height="40"
          :gap="96"
          :pause-on-hover="true"
          :scale-on-hover="true"
          :fade-out="true"
          fade-out-color="var(--background)"
          aria-label="Supported hybrid runtimes"
        />
      </div>
    </div>
  </section>
</template>
