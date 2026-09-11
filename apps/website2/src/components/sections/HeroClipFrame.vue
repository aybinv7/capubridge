<script setup lang="ts">
import { computed, ref } from "vue";
import { useReducedMotion } from "@/composables/useReducedMotion";
import { heroClip } from "@/data/heroClip";

const { reduced } = useReducedMotion();

/** A missing or unplayable file must fall back, never leave a black box. */
const failed = ref(false);

const showVideo = computed(() => heroClip.ready && !failed.value && !reduced.value);
const showPoster = computed(() => heroClip.ready && !failed.value && reduced.value);
</script>

<template>
  <figure class="clip-frame filament-host relative m-0">
    <div
      class="relative overflow-hidden rounded-lg border border-[var(--rule-strong)] bg-[var(--surface-1)]"
    >
      <div
        class="flex h-7 items-center gap-1.5 border-b border-[var(--rule)] bg-[var(--surface-2)] px-3"
      >
        <span class="h-2 w-2 rounded-full bg-white/15" />
        <span class="h-2 w-2 rounded-full bg-white/10" />
        <span class="h-2 w-2 rounded-full bg-white/10" />
        <span class="ml-2 font-mono text-[10px] tracking-[0.1em] text-[var(--ink-3)]">
          capubridge
        </span>
        <span class="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-[var(--accent)]">
          <span class="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
          live
        </span>
      </div>

      <div class="relative aspect-[16/10] w-full">
        <video
          v-if="showVideo"
          class="h-full w-full object-cover"
          :poster="heroClip.poster"
          :aria-label="heroClip.alt"
          autoplay
          muted
          loop
          playsinline
          preload="metadata"
          disablepictureinpicture
          @error="failed = true"
        >
          <source :src="heroClip.webm" type="video/webm" />
          <!--
            The error lands on the last <source> that fails, not on the media
            element, so the fallback has to be armed here. Without it a missing
            file renders an empty black box instead of the placeholder.
          -->
          <source :src="heroClip.mp4" type="video/mp4" @error="failed = true" />
        </video>

        <img
          v-else-if="showPoster"
          class="h-full w-full object-cover"
          :src="heroClip.poster"
          :alt="heroClip.alt"
          decoding="async"
        />

        <!--
          Until the clip is shot this states the spec rather than showing an
          empty box, so the gap is obvious in review instead of shipping blank.
        -->
        <div
          v-else
          class="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] px-6 text-center"
        >
          <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">
            Clip pending
          </p>
          <p class="max-w-[34ch] text-[12px] leading-5 text-[var(--ink-3)]">
            Phone left, data right, one sync tap · 8-12s silent loop · 1600x1000 · webm + mp4 · demo
            app only
          </p>
        </div>
      </div>
    </div>

    <!-- Ties the frame back to the filament language used across the site. -->
    <svg
      class="pointer-events-none absolute -left-6 top-1/2 hidden h-px w-6 overflow-visible lg:block"
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

    <figcaption class="mt-3 flex gap-3 text-[12px] leading-5 text-[var(--ink-3)]">
      <span class="mt-[7px] h-px w-6 shrink-0 bg-[var(--rule-strong)]" aria-hidden="true" />
      {{ heroClip.caption }}
    </figcaption>
  </figure>
</template>

<style scoped>
.clip-frame {
  --card-accent: var(--accent);
}
</style>
