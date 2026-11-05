<template>
  <div
    class="flex h-10 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface-0 px-3"
    role="toolbar"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
      <slot name="start" />
    </div>
    <div class="flex shrink-0 items-center gap-0.5">
      <slot name="end" />
    </div>
  </div>
</template>
