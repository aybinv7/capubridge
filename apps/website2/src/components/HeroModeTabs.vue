<script setup lang="ts">
import type { HeroMode } from "@/data/marketing";

defineProps<{
  modes: HeroMode[];
  activeKey: string;
}>();

const emit = defineEmits<{
  select: [key: string];
}>();
</script>

<template>
  <div
    class="hidden items-center gap-2 rounded-full border border-white/[0.1] bg-black/[0.18] px-2 py-1.5 backdrop-blur-xl md:flex"
  >
    <button
      v-for="mode in modes"
      :key="mode.key"
      type="button"
      class="group flex h-7 items-center gap-2 rounded-full px-2 transition"
      :class="activeKey === mode.key ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'"
      :aria-label="mode.label"
      @click="emit('select', mode.key)"
    >
      <span
        class="h-2 w-2 rounded-full transition"
        :class="
          activeKey === mode.key
            ? 'bg-[var(--accent)] shadow-[0_0_20px_rgba(232,118,90,0.8)]'
            : 'bg-white/[0.24]'
        "
      />
      <span
        class="max-w-0 overflow-hidden whitespace-nowrap text-[11px] text-white/[0.64] transition-all duration-300 group-hover:max-w-28"
        :class="activeKey === mode.key ? 'max-w-28' : ''"
      >
        {{ mode.label }}
      </span>
    </button>
  </div>
</template>
