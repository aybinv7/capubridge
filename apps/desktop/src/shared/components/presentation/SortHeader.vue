<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    label: string;
    state: "asc" | "desc" | false;
    align?: "start" | "end";
  }>(),
  { align: "start" },
);

const emit = defineEmits<{ toggle: [] }>();

const ariaLabel = computed(() => {
  const by = `Sort by ${props.label.toLowerCase()}`;
  if (props.state === "asc") return `${by}, now ascending`;
  if (props.state === "desc") return `${by}, now descending`;
  return by;
});
</script>

<template>
  <button
    type="button"
    class="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
    :class="props.align === 'end' ? 'justify-end' : 'justify-start'"
    :aria-label="ariaLabel"
    @click.stop="emit('toggle')"
  >
    <span class="truncate">{{ props.label }}</span>
    <ArrowUp v-if="props.state === 'asc'" :size="11" aria-hidden="true" />
    <ArrowDown v-else-if="props.state === 'desc'" :size="11" aria-hidden="true" />
  </button>
</template>
