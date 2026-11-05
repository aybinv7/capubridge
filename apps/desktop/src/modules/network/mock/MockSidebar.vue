<script setup lang="ts">
import { computed, ref } from "vue";
import { Button, SearchField, Segmented, SegmentedButton } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import type { MockLogEntry, MockRule } from "@/types/mock.types";
import MockLogList from "./MockLogList.vue";
import MockRulesList from "./MockRulesList.vue";
import { matchesRuleSearch } from "./mockView";

const view = defineModel<"rules" | "log">("view", { required: true });

const props = defineProps<{
  rules: readonly MockRule[];
  log: readonly MockLogEntry[];
  selectedId: string | null;
  hits: (id: string) => number;
  anyHits: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  openRule: [id: string];
  clear: [];
  toggle: [id: string, enabled: boolean];
  remove: [id: string];
  resetHits: [];
  clearLog: [];
}>();

const search = ref("");
const shownRules = computed(() =>
  props.rules.filter((rule) => matchesRuleSearch(rule, search.value)),
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle px-3">
      <Segmented size="sm" active-variant="solid" aria-label="Rules or what was intercepted">
        <SegmentedButton
          :active="view === 'rules'"
          content-class-name="gap-1.5"
          :class="SEGMENT_TEXT"
          @click="view = 'rules'"
        >
          Rules
          <span class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">{{
            props.rules.length
          }}</span>
        </SegmentedButton>
        <SegmentedButton
          :active="view === 'log'"
          content-class-name="gap-1.5"
          :class="SEGMENT_TEXT"
          @click="view = 'log'"
        >
          Log
          <span class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">{{
            props.log.length
          }}</span>
        </SegmentedButton>
      </Segmented>
      <span class="flex-1" />
      <HintTooltip
        v-if="view === 'rules' && props.anyHits"
        text="Sets every rule's matched count back to zero"
      >
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
          class="text-muted-foreground hover:text-foreground"
          @click="emit('resetHits')"
        >
          Reset counts
        </Button>
      </HintTooltip>
      <Button
        v-else-if="view === 'log' && props.log.length"
        size="sm"
        variant="transparent"
        :outline="false"
        class="text-muted-foreground hover:text-foreground"
        @click="emit('clearLog')"
      >
        Clear log
      </Button>
    </div>

    <template v-if="view === 'rules'">
      <div v-if="props.rules.length" class="shrink-0 border-b border-border-subtle px-3 py-2">
        <SearchField
          v-model="search"
          size="sm"
          placeholder="Search by name or address"
          aria-label="Search rules by name or address"
        />
      </div>
      <p
        v-if="!props.rules.length"
        class="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground"
      >
        No rules yet.
      </p>
      <p
        v-else-if="!shownRules.length"
        class="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground"
      >
        No rule matches “{{ search.trim() }}”.
      </p>
      <MockRulesList
        v-else
        :rules="shownRules"
        :selected-id="props.selectedId"
        :hits="props.hits"
        @select="emit('select', $event)"
        @clear="emit('clear')"
        @toggle="(id, enabled) => emit('toggle', id, enabled)"
        @remove="emit('remove', $event)"
      />
    </template>
    <template v-else>
      <p
        v-if="!props.log.length"
        class="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground"
      >
        Nothing intercepted yet. Requests appear here while interception is on.
      </p>
      <MockLogList v-else :entries="props.log" @open-rule="emit('openRule', $event)" />
    </template>
  </div>
</template>
