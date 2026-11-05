<script setup lang="ts">
import { computed } from "vue";
import type { NetworkEntry } from "@/types/network.types";
import KeyValueList, { type KeyValueRow } from "./KeyValueList.vue";
import { findHeader, parseRequestCookies, parseSetCookies } from "./cookies";

const props = defineProps<{ entry: NetworkEntry }>();

const sent = computed<KeyValueRow[]>(() =>
  parseRequestCookies(findHeader(props.entry.requestHeaders, "cookie")).map((cookie) => ({
    key: cookie.name,
    value: cookie.value,
  })),
);
const received = computed(() =>
  parseSetCookies(findHeader(props.entry.responseHeaders, "set-cookie")).map((cookie) => ({
    ...cookie,
    rows: cookie.attributes.map(([key, value]) => ({ key, value: value === true ? "Yes" : value })),
  })),
);
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="flex flex-col gap-5 p-4">
      <section class="flex flex-col gap-2">
        <h3 class="flex items-center gap-1.5 text-xs font-medium text-foreground">
          Sent with the request
          <span class="font-mono text-2xs font-normal text-[var(--fg-subtle)]">{{
            sent.length
          }}</span>
        </h3>
        <KeyValueList v-if="sent.length" :rows="sent" mono />
        <p v-else class="text-xs text-muted-foreground">No cookies were sent.</p>
      </section>
      <section class="flex flex-col gap-2">
        <h3 class="flex items-center gap-1.5 text-xs font-medium text-foreground">
          Set by the response
          <span class="font-mono text-2xs font-normal text-[var(--fg-subtle)]">
            {{ received.length }}
          </span>
        </h3>
        <p v-if="!received.length" class="text-xs text-muted-foreground">No cookies were set.</p>
        <div
          v-for="(cookie, index) in received"
          :key="`${cookie.name}-${index}`"
          class="flex flex-col gap-1.5 rounded-control bg-surface-cut px-3 py-2 shadow-cut"
        >
          <p class="font-mono text-2xs break-all text-foreground select-text">
            {{ cookie.name }}
            <span class="text-muted-foreground">= {{ cookie.value || "(empty)" }}</span>
          </p>
          <KeyValueList v-if="cookie.rows.length" :rows="cookie.rows" mono />
        </div>
      </section>
    </div>
  </div>
</template>
