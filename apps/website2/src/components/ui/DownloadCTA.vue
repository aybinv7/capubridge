<script setup lang="ts">
import PlatformIcon from "@/components/PlatformIcon.vue";
import ThreadButton from "@/components/ui/ThreadButton.vue";
import { useReleaseDownloads } from "@/composables/useReleaseDownloads";

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const { primary, latestTag, releasesLatest } = useReleaseDownloads();
</script>

<template>
  <div class="flex flex-col items-center gap-4 lg:items-start">
    <div class="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
      <ThreadButton v-if="primary" variant="primary" :href="primary.href" external accent="#141112">
        <PlatformIcon :platform="primary.meta.key" class="h-[17px] w-[17px]" />
        Download for {{ primary.meta.os }}
      </ThreadButton>

      <ThreadButton v-else variant="primary" href="#download" accent="#141112">
        Download Capubridge
      </ThreadButton>

      <!--
        A second call to action is redundant weight on a small screen. Hidden
        via a wrapper, not a class on ThreadButton itself, since its own root
        already carries an unconditional inline-flex - two display utilities
        on one element race on stylesheet order, not markup order.
      -->
      <span class="hidden lg:inline-flex">
        <ThreadButton href="#download">
          All platforms
          <span aria-hidden="true">↓</span>
        </ThreadButton>
      </span>
    </div>

    <p
      v-if="!compact"
      class="text-center font-mono text-[11px] tracking-[0.08em] text-[var(--ink-3)] lg:text-left"
    >
      <template v-if="primary">{{ primary.meta.arch }} · {{ primary.meta.format }} · </template>
      <a
        :href="releasesLatest"
        target="_blank"
        rel="noopener"
        class="underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
      >
        {{ latestTag ? `Free and open source · ${latestTag}` : "Free and open source" }}
      </a>
    </p>
  </div>
</template>
