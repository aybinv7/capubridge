<script setup lang="ts">
import { useReleaseDownloads } from "@/composables/useReleaseDownloads";
import PlatformIcon from "@/components/PlatformIcon.vue";

const { primary, latestTag, releasesLatest } = useReleaseDownloads();
</script>

<template>
  <div class="mt-8 flex flex-col items-start gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <!-- Detected-platform primary download -->
      <a
        v-if="primary"
        :href="primary.href"
        target="_blank"
        rel="noopener"
        class="group inline-flex items-center gap-2.5 rounded-full bg-[var(--accent)] px-5 py-3 text-[14px] font-semibold text-[#0e0e10] shadow-[0_10px_30px_-8px_rgba(232,118,90,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-8px_rgba(232,118,90,0.7)]"
      >
        <PlatformIcon :platform="primary.meta.key" class="h-[18px] w-[18px]" />
        Download for {{ primary.meta.os }}
      </a>

      <!-- Unknown platform: send to the download grid -->
      <a
        v-else
        href="#download"
        class="group inline-flex items-center gap-2.5 rounded-full bg-[var(--accent)] px-5 py-3 text-[14px] font-semibold text-[#0e0e10] shadow-[0_10px_30px_-8px_rgba(232,118,90,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-8px_rgba(232,118,90,0.7)]"
      >
        <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download
      </a>

      <a
        href="#download"
        class="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-4 py-3 text-[13px] font-medium text-white/[0.72] transition-colors hover:border-white/[0.28] hover:text-white"
      >
        All platforms
        <span aria-hidden="true">→</span>
      </a>
    </div>

    <p class="text-[11px] uppercase tracking-[0.16em] text-white/[0.4]">
      <template v-if="primary">{{ primary.meta.arch }} · {{ primary.meta.format }} · </template>
      <a :href="releasesLatest" target="_blank" rel="noopener" class="hover:text-[var(--accent)]">
        {{ latestTag ? `Free · ${latestTag}` : "Free · latest release" }}
      </a>
    </p>
  </div>
</template>
