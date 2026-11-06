<script setup lang="ts">
import { useId } from "vue";
import { ChevronRight } from "lucide-vue-next";

const props = defineProps<{ title: string; count?: number; open: boolean }>();

const emit = defineEmits<{ toggle: [] }>();

const panelId = useId();
</script>

<template>
  <section class="flex flex-col gap-2">
    <button
      type="button"
      class="flex w-full items-center gap-1.5 rounded-inner text-left text-xs font-medium text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
      :aria-expanded="props.open"
      :aria-controls="panelId"
      @click="emit('toggle')"
    >
      <ChevronRight
        :size="13"
        :stroke-width="1.8"
        class="shrink-0 text-[var(--fg-subtle)] transition-transform duration-120"
        :class="props.open && 'rotate-90'"
        aria-hidden="true"
      />
      {{ props.title }}
      <span
        v-if="props.count !== undefined"
        class="font-mono text-2xs font-normal text-[var(--fg-subtle)] tabular-nums"
      >
        {{ props.count }}
      </span>
    </button>
    <div v-if="props.open" :id="panelId" class="pl-5">
      <slot />
    </div>
  </section>
</template>
