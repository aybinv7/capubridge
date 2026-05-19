<script setup lang="ts">
defineSlots<{
  header?: () => unknown;
  subnav?: () => unknown;
  toolbar?: () => unknown;
  default?: () => unknown;
  status?: () => unknown;
}>();
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-[var(--bg-app)]">
    <header
      v-if="$slots.header"
      class="sticky top-0 z-10 flex h-11 shrink-0 items-center border-b border-[var(--border-subtle)] bg-[var(--bg-chrome)] px-4"
    >
      <slot name="header" />
    </header>

    <nav
      v-if="$slots.subnav"
      class="flex h-9 shrink-0 items-center border-b border-[var(--border-subtle)] bg-[var(--bg-chrome)] px-3"
    >
      <slot name="subnav" />
    </nav>

    <div
      v-if="$slots.toolbar"
      class="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-3"
    >
      <slot name="toolbar" />
    </div>

    <div class="min-h-0 flex-1 overflow-hidden bg-[var(--bg-app)]">
      <slot />
    </div>

    <footer
      v-if="$slots.status"
      class="flex h-7 shrink-0 items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-chrome)] px-3 text-[11px] text-[var(--fg-muted)]"
    >
      <slot name="status" />
    </footer>
  </div>
</template>
