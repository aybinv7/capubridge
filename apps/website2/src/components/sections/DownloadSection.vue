<script setup lang="ts">
import BlurText from "@/components/BlurText/BlurText.vue";
import PlatformIcon from "@/components/PlatformIcon.vue";
import { useReleaseDownloads } from "@/composables/useReleaseDownloads";
import LayeredCard from "@/components/ui/LayeredCard.vue";
import { REPO_URL } from "@/data/site";

const { platforms, urls, latestTag, releasesLatest } = useReleaseDownloads();
</script>

<template>
  <section
    id="download"
    class="texture-weave scroll-mt-20 border-t border-[var(--rule)] bg-[var(--surface-0)]"
  >
    <div class="mx-auto max-w-[1360px] px-5 py-20 md:px-8 md:py-28">
      <div class="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-end">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
            05 / Download
          </p>
          <BlurText
            text="Free, open source, no account."
            as="h2"
            animate-by="words"
            direction="top"
            :delay="80"
            class-name="mt-5 max-w-[16ch] font-[var(--font-display)] text-[34px] font-semibold leading-[1.02] tracking-[-0.03em] text-[var(--ink-0)] md:text-[48px]"
          />
          <p class="mt-6 max-w-[46ch] text-[15px] font-normal leading-[1.75] text-[var(--ink-2)]">
            Pick your platform. Capubridge needs a device with USB debugging enabled and
            <code class="font-mono text-[13px] text-[var(--ink-1)]">adb</code> on your PATH —
            nothing else.
          </p>
          <p class="mt-6 font-mono text-[11px] tracking-[0.08em] text-[var(--ink-3)]">
            <a
              :href="releasesLatest"
              target="_blank"
              rel="noopener"
              class="underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
            >
              {{ latestTag ? `Latest release · ${latestTag}` : "All releases" }}
            </a>
            <span aria-hidden="true"> · </span>
            <a
              :href="REPO_URL"
              target="_blank"
              rel="noopener"
              class="underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
            >
              Source on GitHub
            </a>
          </p>
        </div>

        <ul class="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <li v-for="platform in platforms" :key="platform.key">
            <LayeredCard
              as="a"
              :accent="platform.accent"
              :href="urls[platform.key]"
              target="_blank"
              rel="noopener"
              class="platform h-full"
            >
              <div
                class="platform-face flex h-full items-center justify-between gap-4 rounded-lg border border-[var(--rule)] bg-[var(--surface-0)] p-5"
              >
                <span>
                  <span
                    class="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]"
                  >
                    {{ platform.os }}
                  </span>
                  <span class="mt-1.5 block text-[15px] font-medium text-[var(--ink-0)]">
                    {{ platform.arch }}
                  </span>
                  <span class="mt-0.5 block font-mono text-[11px] text-[var(--ink-3)]">
                    {{ platform.format }}
                  </span>
                </span>
                <span
                  class="platform-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--rule-strong)] text-[var(--ink-2)]"
                >
                  <PlatformIcon :platform="platform.key" class="h-[17px] w-[17px]" />
                </span>
              </div>
            </LayeredCard>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.platform-face {
  transition:
    border-color 260ms ease,
    background-color 260ms ease;
}

.platform:hover .platform-face {
  border-color: color-mix(in srgb, var(--card-accent) 48%, transparent);
  background-color: var(--surface-1);
}

.platform-icon {
  transition:
    background-color 220ms ease,
    border-color 220ms ease,
    color 220ms ease;
}

.platform:hover .platform-icon {
  border-color: transparent;
  background-color: var(--card-accent);
  color: #141112;
}
</style>
