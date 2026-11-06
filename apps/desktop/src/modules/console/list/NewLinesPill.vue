<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import KeyCaps from "@/components/command/KeyCaps.vue";

/** The pill that says how much arrived below while the list stopped following, and goes back. */
const props = defineProps<{ count: number; label: string }>();
const emit = defineEmits<{ resume: [] }>();

const count = new Intl.NumberFormat();
const text = computed(() =>
  props.count > 0 ? `${count.format(props.count)} ${props.label}` : "Back to the end",
);
</script>

<template>
  <div class="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
    <Button
      size="xs"
      variant="solid"
      surface-level="+2"
      class="pointer-events-auto shadow-float"
      content-class-name="gap-1.5"
      @click="emit('resume')"
    >
      <ArrowDown class="size-3" />
      <span class="tabular-nums">{{ text }}</span>
      <KeyCaps keys="end" quiet />
    </Button>
  </div>
</template>
