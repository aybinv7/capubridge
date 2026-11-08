<script setup lang="ts">
/** One Settings section: its title and a sentence, then its cards. */
const props = defineProps<{ title: string; description?: string }>();

defineSlots<{ default: () => unknown; aside?: () => unknown }>();
</script>

<template>
  <div class="mx-auto flex max-w-[640px] flex-col gap-5 px-6 pt-4 pb-8">
    <header class="flex min-h-9 items-center gap-3">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 class="text-base font-medium text-foreground">{{ props.title }}</h1>
        <p v-if="props.description" class="text-xs text-muted-foreground">
          {{ props.description }}
        </p>
      </div>
      <slot name="aside" />
    </header>
    <slot />
  </div>
</template>
