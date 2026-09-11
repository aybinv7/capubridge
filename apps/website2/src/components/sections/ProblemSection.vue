<script setup lang="ts">
import RevealOnScroll from "@/components/ui/RevealOnScroll.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import { captures } from "@/data/screenshots";
import { problems } from "@/data/problems";

const mediaFor = (key: string) => captures[key];
</script>

<template>
  <section
    id="problem"
    class="pattern-grid relative mx-auto max-w-[1360px] scroll-mt-20 px-5 py-16 md:px-8 md:py-24"
  >
    <SectionHeader
      index="01"
      eyebrow="The broken workflow"
      title="Four tools. None of them owns the whole picture."
    />

    <ol class="mt-14 border-t border-[var(--rule)]">
      <RevealOnScroll
        v-for="(problem, index) in problems"
        :key="problem.title"
        as="li"
        :delay="index * 60"
        class="problem-row filament-host relative overflow-hidden border-b border-[var(--rule)]"
        :style="{ '--card-accent': problem.accent }"
      >
        <div
          class="row-body grid gap-4 py-7 md:grid-cols-[3rem_11rem_1fr_10rem] md:items-baseline md:gap-8 lg:min-h-[150px]"
        >
          <span
            class="font-mono text-[11px] tabular-nums tracking-[0.18em] text-[var(--ink-3)]"
            aria-hidden="true"
          >
            {{ String(index + 1).padStart(2, "0") }}
          </span>

          <code class="problem-tool font-mono text-[12px]">{{ problem.tool }}</code>

          <div class="lg:max-w-[46ch]">
            <h3
              class="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink-0)] md:text-[19px]"
            >
              {{ problem.title }}
            </h3>
            <p class="mt-2 text-[14px] font-normal leading-[1.7] text-[var(--ink-2)]">
              {{ problem.description }}
            </p>
          </div>

          <p
            class="row-cost font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)] md:text-right"
          >
            {{ problem.cost }}
          </p>
        </div>

        <!--
          Slides in from the right on hover and nudges the row aside, so the
          answer to each complaint is one glance away instead of one scroll.
        -->
        <div
          v-if="mediaFor(problem.capture)"
          class="row-media pointer-events-none absolute right-0 top-0 hidden h-full w-[38%] lg:block"
          aria-hidden="true"
        >
          <div class="relative h-full overflow-hidden border-l border-[var(--card-accent)]/40">
            <video
              v-if="problem.video"
              class="h-full w-full object-cover"
              :src="problem.video"
              muted
              loop
              autoplay
              playsinline
            />
            <img
              v-else-if="mediaFor(problem.capture).status === 'clean'"
              class="h-full w-full object-cover"
              :src="mediaFor(problem.capture).src"
              :style="{ objectPosition: mediaFor(problem.capture).focal }"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div
              class="absolute inset-0 bg-[linear-gradient(90deg,var(--background),transparent_45%)]"
            />
            <p
              class="absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--card-accent)]"
            >
              {{ problem.answer }}
            </p>
          </div>
        </div>

        <svg
          class="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px w-full overflow-visible"
          aria-hidden="true"
        >
          <line
            class="filament"
            style="--filament-length: 100"
            x1="0"
            y1="0"
            x2="100%"
            y2="0"
            pathLength="100"
          />
        </svg>
      </RevealOnScroll>
    </ol>

    <!-- The turn: the list above is the setup, this is where it pays off. -->
    <RevealOnScroll :distance="20" class="mt-16 md:mt-20">
      <div class="grid gap-8 border-t border-[var(--rule)] pt-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-3)]">
            The question
          </p>
          <h3
            class="mt-4 max-w-[20ch] font-[var(--font-display)] text-[30px] font-semibold leading-[1.04] tracking-[-0.03em] text-[var(--ink-0)] md:text-[42px]"
          >
            So which of those windows is the bug in?
          </h3>
        </div>

        <div class="lg:pt-10">
          <p class="max-w-[46ch] text-[16px] font-normal leading-[1.75] text-[var(--ink-1)]">
            Wrong question. It is in the gap between them, and closing that gap is the entire
            product. One window holding the device, its storage, the DOM, the network, the native
            log, and a recording of all of it that someone else can open.
          </p>

          <a
            href="#how"
            class="mt-7 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] transition-opacity duration-200 hover:opacity-70"
          >
            See how it attaches
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </RevealOnScroll>
  </section>
</template>

<style scoped>
.problem-row {
  position: relative;
}

.problem-tool {
  color: var(--ink-3);
  transition: color 240ms ease;
}

.problem-row:hover .problem-tool {
  color: var(--card-accent);
}

.row-body {
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.row-cost {
  transition: opacity 260ms ease;
}

.row-media {
  transform: translateX(100%);
  transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (min-width: 1024px) {
  .problem-row:hover .row-body,
  .problem-row:focus-within .row-body {
    transform: translateX(-2rem);
  }

  .problem-row:hover .row-cost,
  .problem-row:focus-within .row-cost {
    opacity: 0;
  }

  .problem-row:hover .row-media,
  .problem-row:focus-within .row-media {
    transform: translateX(0);
  }
}

@media (max-width: 1023px) {
  .problem-row:hover .row-body {
    transform: translateX(6px);
  }
}
</style>
