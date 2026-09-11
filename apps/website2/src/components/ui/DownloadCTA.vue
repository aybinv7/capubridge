<script setup lang="ts">
import PlatformIcon from "@/components/PlatformIcon.vue";
import ThreadButton from "@/components/ui/ThreadButton.vue";
import { useReleaseDownloads } from "@/composables/useReleaseDownloads";

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const { primary, latestTag, releasesLatest } = useReleaseDownloads();
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <ThreadButton v-if="primary" variant="primary" :href="primary.href" external accent="#141112">
        <PlatformIcon :platform="primary.meta.key" class="h-[17px] w-[17px]" />
        Download for {{ primary.meta.os }}
      </ThreadButton>

      <ThreadButton v-else variant="primary" href="#download" accent="#141112">
        Download Capubridge
      </ThreadButton>

      <ThreadButton href="#download">
        All platforms
        <span aria-hidden="true">↓</span>
      </ThreadButton>
    </div>

    <p v-if="!compact" class="font-mono text-[11px] tracking-[0.08em] text-[var(--ink-3)]">
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
