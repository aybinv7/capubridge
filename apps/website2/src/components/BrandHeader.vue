<script setup lang="ts">
defineProps<{
  items: { label: string; href: string }[];
}>();
</script>

<template>
  <header class="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-5">
    <div
      class="mx-auto flex h-11 max-w-[1440px] items-center justify-between rounded-full border border-white/[0.1] bg-[#0b0d12]/[0.72] px-2.5 backdrop-blur-2xl md:px-3"
    >
      <a
        href="#"
        class="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-black"
        aria-label="Capubridge home"
      >
        <img src="/icon.png" alt="" class="h-7 w-7 object-contain" />
      </a>

      <nav class="flex items-center gap-1" aria-label="Primary navigation">
        <a
          v-for="item in items"
          :key="item.href"
          :href="item.href"
          class="rounded-full px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)] transition hover:bg-white/[0.06] hover:text-white"
        >
          {{ item.label }}
        </a>
      </nav>

      <span
        class="hidden rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/[0.38] md:inline-flex"
      >
        Desktop runtime
      </span>
    </div>
  </header>
</template>
