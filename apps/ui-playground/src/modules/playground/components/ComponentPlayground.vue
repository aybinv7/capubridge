<script setup lang="ts">
import { Surface } from "@capubridge/ui";

import PlaygroundCode from "./PlaygroundCode.vue";

const props = withDefaults(
  defineProps<{
    code?: string;
    previewSurface?: boolean;
  }>(),
  {
    code: undefined,
    previewSurface: false,
  },
);
</script>

<template>
  <Surface
    class="component-example"
    data-cladd-example=""
    outline
    variant="transparent"
    :wrap-content="false"
  >
    <div class="component-example__layout">
      <div class="component-example__preview" data-cladd-example-preview="">
        <Surface
          v-if="props.previewSurface"
          class="component-example__preview-surface"
          content-class-name="component-example__preview-surface-content"
          outline
          variant="gradient"
        >
          <slot name="preview" />
        </Surface>
        <slot v-else name="preview" />
      </div>

      <div v-if="$slots.controls" class="component-example__controls">
        <slot name="controls" />
      </div>

      <PlaygroundCode v-if="props.code" :code="props.code" />
    </div>
  </Surface>
</template>
