<script setup lang="ts">
import ThreadLink from "@/components/ui/ThreadLink.vue";
import { footerGroups } from "@/data/site";
</script>

<template>
  <footer class="border-t border-[var(--rule)]">
    <div class="mx-auto max-w-[1360px] px-5 py-14 md:px-8">
      <div class="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div class="flex items-center gap-2.5">
            <img
              src="/icon-64.webp"
              srcset="/icon-64.webp 64w, /icon-128.webp 128w"
              sizes="28px"
              alt=""
              class="h-7 w-7 object-contain"
              width="28"
              height="28"
            />
            <span class="font-[var(--font-display)] text-[16px] font-semibold">Capubridge</span>
          </div>
          <p class="mt-3 max-w-[34ch] text-[13px] leading-6 text-[var(--ink-3)]">
            A native desktop workbench for debugging Android WebViews on real devices.
          </p>
        </div>

        <div v-for="group in footerGroups" :key="group.title">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-3)]">
            {{ group.title }}
          </p>
          <ul class="mt-4 space-y-2.5">
            <li v-for="link in group.links" :key="link.label">
              <ThreadLink :href="link.href" :external="link.external">
                {{ link.label }}
              </ThreadLink>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="mt-12 flex flex-col gap-3 border-t border-[var(--rule)] pt-6 font-mono text-[11px] tracking-[0.08em] text-[var(--ink-3)] sm:flex-row sm:items-center sm:justify-between"
      >
        <p>MIT licensed · Requires ADB in PATH</p>
        <ThreadLink href="#top">Back to top ↑</ThreadLink>
      </div>
    </div>
  </footer>
</template>
