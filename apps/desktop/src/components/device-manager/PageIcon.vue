<script setup lang="ts">
import { ref, watch } from "vue";
import { Globe } from "lucide-vue-next";

const props = defineProps<{ icon: string | null }>();

const broken = ref(false);
watch(
  () => props.icon,
  () => {
    broken.value = false;
  },
);
</script>

<template>
  <span
    class="grid size-7 shrink-0 place-items-center rounded-control bg-surface-2 shadow-bevel"
    aria-hidden="true"
  >
    <img
      v-if="props.icon && !broken"
      :src="props.icon"
      alt=""
      class="size-4 object-contain"
      draggable="false"
      @error="broken = true"
    />
    <Globe v-else :size="14" :stroke-width="1.8" class="text-muted-foreground" />
  </span>
</template>
