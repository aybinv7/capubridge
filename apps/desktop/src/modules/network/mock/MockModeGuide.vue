<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";

const props = defineProps<{ port: number }>();
</script>

<template>
  <div class="grid shrink-0 gap-3 border-b border-border-subtle p-3 @3xl:grid-cols-2">
    <section class="flex flex-col gap-2 rounded-control bg-surface-cut p-3 shadow-cut">
      <h3 class="text-xs font-medium text-foreground">In the WebView</h3>
      <div class="flex items-center gap-1.5 font-mono text-2xs" aria-hidden="true">
        <span class="rounded-inner bg-surface-2 px-1.5 py-0.5 text-foreground">App</span>
        <ArrowRight :size="12" class="text-[var(--fg-subtle)]" />
        <span class="rounded-inner bg-cat-network/20 px-1.5 py-0.5 text-foreground">
          Capubridge answers
        </span>
        <span class="text-[var(--fg-subtle)] line-through">server</span>
      </div>
      <p class="text-xs text-muted-foreground">
        Best for an app running on the phone. Capubridge answers matching requests inside the
        selected WebView, so the app keeps its usual addresses and needs no change.
      </p>
    </section>
    <section class="flex flex-col gap-2 rounded-control bg-surface-cut p-3 shadow-cut">
      <h3 class="text-xs font-medium text-foreground">Local server</h3>
      <div class="flex items-center gap-1.5 font-mono text-2xs" aria-hidden="true">
        <span class="rounded-inner bg-surface-2 px-1.5 py-0.5 text-foreground">App</span>
        <ArrowRight :size="12" class="text-[var(--fg-subtle)]" />
        <span class="rounded-inner bg-surface-2 px-1.5 py-0.5 text-foreground">
          localhost:{{ props.port }}
        </span>
        <ArrowRight :size="12" class="text-[var(--fg-subtle)]" />
        <span class="rounded-inner bg-cat-network/20 px-1.5 py-0.5 text-foreground">
          Capubridge server
        </span>
      </div>
      <p class="text-xs text-muted-foreground">
        For apps you can point at another address, even without WebView debugging. Run the server,
        point the app at <span class="font-mono">http://127.0.0.1:{{ props.port }}</span
        >, then use Connect the phone so the phone's localhost reaches this computer.
      </p>
    </section>
  </div>
</template>
