<script setup lang="ts">
import { X } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";

const props = defineProps<{ open: boolean; title: string; label: string }>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Transition
    enter-active-class="transition-[width,opacity] duration-500 ease-cladd-settle"
    enter-from-class="w-0 opacity-0"
    enter-to-class="w-80 opacity-100"
    leave-active-class="transition-[width,opacity] duration-200 ease-in-out"
    leave-from-class="w-80 opacity-100"
    leave-to-class="w-0 opacity-0"
  >
    <aside
      v-if="props.open"
      class="w-80 shrink-0 overflow-hidden border-l border-border-subtle"
      :aria-label="props.label"
    >
      <div class="flex h-full w-80 min-h-0 flex-col">
        <div class="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle pr-2 pl-4">
          <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {{ props.title }}
          </span>
          <IconAction label="Close details" keys="Escape" size="sm" @click="emit('close')">
            <X :stroke-width="1.8" />
          </IconAction>
        </div>
        <slot />
      </div>
    </aside>
  </Transition>
</template>
