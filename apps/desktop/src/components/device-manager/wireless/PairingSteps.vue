<script setup lang="ts">
const props = defineProps<{ steps: string[] }>();
</script>

<template>
  <ol
    class="grid w-full gap-2"
    :style="{ gridTemplateColumns: `repeat(${props.steps.length}, minmax(0, 1fr))` }"
  >
    <li
      v-for="(step, index) in props.steps"
      :key="step"
      class="flex flex-col gap-1.5 rounded-well bg-surface-cut px-3 py-2.5 shadow-cut"
    >
      <span
        class="flex size-5 items-center justify-center rounded-full bg-surface-2 font-mono text-2xs text-foreground tabular-nums shadow-bevel"
        aria-hidden="true"
      >
        {{ index + 1 }}
      </span>
      <span class="text-xs text-muted-foreground">{{ step }}</span>
    </li>
  </ol>
</template>
