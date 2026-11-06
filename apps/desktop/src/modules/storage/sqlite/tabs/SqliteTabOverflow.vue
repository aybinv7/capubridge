<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, X } from "lucide-vue-next";
import { Button, List, ListButton, Popover, SearchField } from "@capubridge/cladd";
import { rankByScore } from "@/lib/commands/fuzzy";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { SqliteStripTab } from "./sqliteStripTabs";

/** "N more": every tab in a searchable list, each closable, for a strip too narrow to show them. */
const props = defineProps<{ tabs: readonly SqliteStripTab[]; hidden: number }>();

const emit = defineEmits<{ select: [id: string]; close: [id: string] }>();

const open = ref(false);
const query = ref("");
const shown = computed(() => rankByScore(props.tabs, query.value, (tab) => tab.label));

function choose(id: string) {
  open.value = false;
  emit("select", id);
}
</script>

<template>
  <Popover v-model:open="open" position="bottom-end" content-class-name="w-72 p-1.5">
    <template #trigger>
      <Button
        size="xs"
        variant="transparent"
        :outline="false"
        content-class-name="gap-1 text-muted-foreground"
        :aria-label="`Show all ${tabs.length} tabs`"
      >
        <ChevronDown :size="12" aria-hidden="true" />
        <span v-if="hidden > 0" class="tabular-nums">{{ hidden }} more</span>
      </Button>
    </template>
    <div class="flex flex-col gap-1">
      <SearchField v-model="query" size="sm" placeholder="Find a tab" aria-label="Find a tab" />
      <List class="max-h-80 overflow-y-auto">
        <div v-for="tab in shown" :key="tab.id" class="group/row flex items-center gap-1">
          <ListButton
            size="sm"
            :selected="tab.active"
            class="min-w-0 flex-1"
            content-class-name="gap-2 px-2"
            @click="choose(tab.id)"
          >
            <template #icon>
              <component :is="tab.icon" :size="13" :stroke-width="1.8" />
            </template>
            <span class="truncate font-mono text-xs" :class="tab.preview ? 'italic' : ''">
              {{ tab.label }}
            </span>
          </ListButton>
          <IconAction
            v-if="tab.closable"
            size="xs"
            :label="`Close ${tab.label}`"
            @click="emit('close', tab.id)"
          >
            <X :stroke-width="1.8" />
          </IconAction>
        </div>
      </List>
    </div>
  </Popover>
</template>
