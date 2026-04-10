<script setup lang="ts">
import { computed } from "vue";
import type { BoxModel, ComputedStyle } from "@/types/inspect.types";

const props = defineProps<{
  boxModel: BoxModel | null;
  computedStyles: ComputedStyle[];
}>();

function getStyle(name: string): string {
  return props.computedStyles.find((s) => s.name === name)?.value ?? "-";
}

const margin = computed(() => ({
  top: getStyle("margin-top"),
  right: getStyle("margin-right"),
  bottom: getStyle("margin-bottom"),
  left: getStyle("margin-left"),
}));

const border = computed(() => ({
  top: getStyle("border-top-width"),
  right: getStyle("border-right-width"),
  bottom: getStyle("border-bottom-width"),
  left: getStyle("border-left-width"),
}));

const padding = computed(() => ({
  top: getStyle("padding-top"),
  right: getStyle("padding-right"),
  bottom: getStyle("padding-bottom"),
  left: getStyle("padding-left"),
}));

const content = computed(() => {
  if (!props.boxModel) return { width: "-", height: "-" };
  return {
    width: `${props.boxModel.width}`,
    height: `${props.boxModel.height}`,
  };
});
</script>

<template>
  <div class="p-4 flex items-center justify-center">
    <div v-if="!boxModel" class="text-xs text-muted-foreground/40">Select an element</div>

    <div v-else class="text-[10px] font-mono text-center select-none w-full max-w-72">
      <!-- Margin -->
      <div class="bg-orange-400/10 border border-orange-400/20 rounded p-2 relative">
        <div class="absolute top-0.5 left-1 text-orange-400/50">margin</div>
        <div class="text-orange-400/70 text-center mb-1">{{ margin.top }}</div>
        <div class="flex items-center">
          <div class="text-orange-400/70 w-10 text-right pr-1">{{ margin.left }}</div>
          <!-- Border -->
          <div class="flex-1 bg-yellow-400/10 border border-yellow-400/20 rounded p-2 relative">
            <div class="absolute top-0.5 left-1 text-yellow-400/50">border</div>
            <div class="text-yellow-400/70 text-center mb-1">{{ border.top }}</div>
            <div class="flex items-center">
              <div class="text-yellow-400/70 w-8 text-right pr-1">{{ border.left }}</div>
              <!-- Padding -->
              <div class="flex-1 bg-green-400/10 border border-green-400/20 rounded p-2 relative">
                <div class="absolute top-0.5 left-1 text-green-400/50">padding</div>
                <div class="text-green-400/70 text-center mb-1">{{ padding.top }}</div>
                <div class="flex items-center">
                  <div class="text-green-400/70 w-8 text-right pr-1">{{ padding.left }}</div>
                  <!-- Content -->
                  <div
                    class="flex-1 bg-blue-400/15 border border-blue-400/20 rounded py-2 px-1 text-blue-300 text-center"
                  >
                    {{ content.width }} x {{ content.height }}
                  </div>
                  <div class="text-green-400/70 w-8 text-left pl-1">{{ padding.right }}</div>
                </div>
                <div class="text-green-400/70 text-center mt-1">{{ padding.bottom }}</div>
              </div>
              <div class="text-yellow-400/70 w-8 text-left pl-1">{{ border.right }}</div>
            </div>
            <div class="text-yellow-400/70 text-center mt-1">{{ border.bottom }}</div>
          </div>
          <div class="text-orange-400/70 w-10 text-left pl-1">{{ margin.right }}</div>
        </div>
        <div class="text-orange-400/70 text-center mt-1">{{ margin.bottom }}</div>
      </div>
    </div>
  </div>
</template>
