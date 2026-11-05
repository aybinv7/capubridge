<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight } from "lucide-vue-next";
import CopyAction from "../shared/CopyAction.vue";
import { breadcrumbs } from "./filePaths";

const props = defineProps<{ dir: string }>();

const emit = defineEmits<{ open: [path: string] }>();

const crumbs = computed(() => breadcrumbs(props.dir));
</script>

<template>
  <nav
    class="group/crumbs flex min-w-0 items-center gap-0.5 overflow-hidden"
    aria-label="Folder path"
  >
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
          :title="crumb.path"
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
    <CopyAction
      :value="props.dir"
      label="Copy folder path"
      class="shrink-0 opacity-0 transition-opacity duration-120 group-hover/crumbs:opacity-100 focus-visible:opacity-100"
    />
  </nav>
</template>
