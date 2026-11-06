<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { crumbsOf } from "./opfsSources";

/** The way from the OPFS root to the open folder; each step opens that folder. */
const props = defineProps<{ path: string }>();

const emit = defineEmits<{ open: [path: string] }>();

const crumbs = computed(() => crumbsOf(props.path));
</script>

<template>
  <nav class="flex min-w-0 items-center overflow-hidden" aria-label="Folder path">
    <ol class="flex min-w-0 items-center gap-0.5 overflow-hidden font-mono text-xs [direction:rtl]">
      <li
        v-for="(crumb, index) in [...crumbs].reverse()"
        :key="crumb.path"
        class="flex shrink-0 items-center gap-0.5 [direction:ltr]"
        :class="index === 0 ? 'shrink' : ''"
      >
        <button
          type="button"
          class="truncate rounded-inner px-1 py-0.5 outline-none hover:bg-cladd-surface-hover focus-visible:ring-1 focus-visible:ring-ring"
          :class="index === 0 ? 'text-foreground' : 'text-muted-foreground'"
          :aria-current="index === 0 ? 'location' : undefined"
          :title="`/${crumb.path}`"
          @click="emit('open', crumb.path)"
        >
          {{ crumb.label }}
        </button>
        <ChevronRight
          v-if="index !== crumbs.length - 1"
          :size="12"
          class="order-first shrink-0 text-[var(--fg-subtle)]"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>
