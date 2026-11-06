<script setup lang="ts">
import { computed, ref } from "vue";
import { Button, SearchField, Segmented, SegmentedButton } from "@capubridge/cladd";
import RecordSplit from "@/shared/components/layout/RecordSplit.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import type { MockLogEntry, MockRule } from "@/types/mock.types";
import ColumnsMenu from "../columns/ColumnsMenu.vue";
import { useListColumns } from "../columns/useListColumns";
import MockLogTable from "./MockLogTable.vue";
import MockRulesTable from "./MockRulesTable.vue";
import { MOCK_LOG_COLUMNS, MOCK_RULE_COLUMNS } from "./mockColumns";
import { matchesRuleSearch } from "./mockView";

/**
 * Rules or the interception log in a recessed well, each in its own columns, with the rule
 * editor raised beside them (the `pane` slot) while a rule is chosen, like a Data tab's record.
 */
const view = defineModel<"rules" | "log">("view", { required: true });

const props = defineProps<{
  rules: readonly MockRule[];
  log: readonly MockLogEntry[];
  selectedId: string | null;
  hits: (id: string) => number;
  anyHits: boolean;
  paneOpen: boolean;
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

defineSlots<{ pane: () => unknown }>();

const search = ref("");
const shownRules = computed(() =>
  props.rules.filter((rule) => matchesRuleSearch(rule, search.value)),
);

const rulesTable = ref<{ header: HTMLElement | null } | null>(null);
const logTable = ref<{ header: HTMLElement | null } | null>(null);
const ruleColumns = useListColumns({
  key: "mock-rules",
  columns: MOCK_RULE_COLUMNS,
  measure: computed(() => rulesTable.value?.header ?? null),
});
const logColumns = useListColumns({
  key: "mock-log",
  columns: MOCK_LOG_COLUMNS,
  measure: computed(() => logTable.value?.header ?? null),
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 items-center gap-2 px-3 pt-2 pb-2">
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
      <SearchField
        v-if="view === 'rules' && props.rules.length"
        v-model="search"
        size="sm"
        class="w-60 min-w-36 shrink"
        placeholder="Search by name or address"
        aria-label="Search rules by name or address"
      />
      <span class="flex-1" />
      <span
        v-if="view === 'rules' && props.rules.length && !props.selectedId"
        class="truncate text-2xs text-[var(--fg-subtle)]"
      >
        Choose a rule to edit it
      </span>
      <HintTooltip
        v-if="view === 'rules' && props.anyHits"
        text="Sets every rule's matched count back to zero"
      >
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
          class="shrink-0 text-muted-foreground hover:text-foreground"
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
        class="shrink-0 text-muted-foreground hover:text-foreground"
        @click="emit('clearLog')"
      >
        Clear log
      </Button>
      <ColumnsMenu
        v-if="view === 'rules'"
        :columns="MOCK_RULE_COLUMNS"
        :is-hidden="ruleColumns.isHidden"
        :dropped="ruleColumns.dropped.value"
        :reasons="ruleColumns.reasons.value"
        @toggle="(id, visible) => ruleColumns.setHidden(id, !visible)"
        @show-all="ruleColumns.showAll()"
      />
      <ColumnsMenu
        v-else
        :columns="MOCK_LOG_COLUMNS"
        :is-hidden="logColumns.isHidden"
        :dropped="logColumns.dropped.value"
        :reasons="logColumns.reasons.value"
        @toggle="(id, visible) => logColumns.setHidden(id, !visible)"
        @show-all="logColumns.showAll()"
      />
    </div>

    <RecordSplit
      :pane-open="props.paneOpen"
      save-id="capubridge:network-mock-pane:v1"
      panel-prefix="network-mock"
      :pane-default="520"
      :pane-min="380"
      :pane-max="1000"
    >
      <template #grid>
        <template v-if="view === 'rules'">
          <p
            v-if="!props.rules.length"
            class="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground"
          >
            No rules yet. Use New rule above, or Mock this response in Requests.
          </p>
          <p
            v-else-if="!shownRules.length"
            class="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground"
          >
            No rule matches “{{ search.trim() }}”.
          </p>
          <MockRulesTable
            v-else
            ref="rulesTable"
            :rules="shownRules"
            :selected-id="props.selectedId"
            :hits="props.hits"
            :layout="ruleColumns"
            @select="emit('select', $event)"
            @clear="emit('clear')"
            @toggle="(id, enabled) => emit('toggle', id, enabled)"
            @remove="emit('remove', $event)"
          />
        </template>
        <template v-else>
          <p
            v-if="!props.log.length"
            class="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground"
          >
            Nothing intercepted yet. Requests appear here while interception is on.
          </p>
          <MockLogTable
            v-else
            ref="logTable"
            :entries="props.log"
            :layout="logColumns"
            @open-rule="emit('openRule', $event)"
          />
        </template>
      </template>
      <template #pane>
        <slot name="pane" />
      </template>
    </RecordSplit>
  </div>
</template>
