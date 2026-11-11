<script setup lang="ts">
import { ref, watch } from "vue";
import { Globe, Loader2, X } from "lucide-vue-next";

/**
 * One page on This PC, as a browser tab: its icon (a spinner while it loads), its title, and a
 * close button that shows on hover and on the open tab. A middle click closes it too.
 */
const props = defineProps<{
  title: string;
  url: string;
  icon: string | null;
  active: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{ select: []; close: [] }>();

const broken = ref(false);
watch(
  () => props.icon,
  () => {
    broken.value = false;
  },
);

function onAuxClick(event: MouseEvent) {
  if (event.button !== 1) return;
  event.preventDefault();
  emit("close");
}
</script>

<template>
  <div
    role="tab"
    :aria-selected="props.active"
    :title="`${props.title}\n${props.url}`"
    class="group/tab relative flex h-7 max-w-52 min-w-24 flex-1 basis-40 cursor-default items-center gap-2 rounded-control pr-1 pl-2.5 text-xs transition-colors duration-150 select-none"
    :class="
      props.active
        ? 'bg-signal-select/12 text-signal-select ring-1 ring-signal-select/30 ring-inset'
        : 'text-muted-foreground hover:bg-surface-1 hover:text-foreground'
    "
    tabindex="0"
    @click="emit('select')"
    @auxclick="onAuxClick"
    @mousedown.middle.prevent
    @keydown.enter.prevent="emit('select')"
    @keydown.delete.prevent="emit('close')"
  >
    <Loader2
      v-if="props.loading"
      :size="13"
      class="shrink-0 animate-spin text-[var(--fg-subtle)]"
      aria-hidden="true"
    />
    <img
      v-else-if="props.icon && !broken"
      :src="props.icon"
      alt=""
      class="size-3.5 shrink-0 object-contain"
      draggable="false"
      @error="broken = true"
    />
    <Globe
      v-else
      :size="13"
      :stroke-width="1.8"
      class="shrink-0 text-[var(--fg-subtle)]"
      aria-hidden="true"
    />
    <span class="min-w-0 flex-1 truncate">{{ props.title }}</span>
    <button
      type="button"
      :aria-label="`Close ${props.title}`"
      class="grid size-5 shrink-0 place-items-center rounded-cladd-sm text-[var(--fg-subtle)] outline-none hover:bg-cladd-surface-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-signal-select"
      :class="props.active ? '' : 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100'"
      tabindex="-1"
      @click.stop="emit('close')"
    >
      <X :size="12" :stroke-width="2" />
    </button>
  </div>
</template>
