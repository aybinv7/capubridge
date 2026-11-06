<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import { Link } from "@capubridge/cladd";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { groupConsoleErrors, originOf, type ErrorGroup } from "@/lib/console/consoleErrors";
import type { ConsoleStreamRow } from "@/lib/console/consoleStream";
import { useDrawerToolbarSlot } from "@/shared/drawer/toolbarSlot";
import { useRevealFocus } from "@/shared/timeline/revealFocus";
import { useConsoleStore } from "@/stores/console.store";
import { useDrawerStore } from "@/stores/drawer.store";
import { useTargetsStore } from "@/stores/targets.store";
import { copyText } from "../list/copyText";
import RowMenu from "../list/RowMenu.vue";
import StreamEmpty from "../list/StreamEmpty.vue";
import StreamList from "../list/StreamList.vue";
import type { StreamListHandle } from "../list/streamList.types";
import { useQueryHistory } from "../list/useQueryHistory";
import { consoleStatus } from "./consoleStatus";
import { useConsoleSuggest } from "./consoleSuggest";
import ConsoleErrorsList from "./ConsoleErrorsList.vue";
import ConsolePrompt from "./ConsolePrompt.vue";
import ConsoleRowView from "./ConsoleRow.vue";
import ConsoleRowDetail from "./ConsoleRowDetail.vue";
import ConsoleToolbar from "./ConsoleToolbar.vue";
import { formatConsoleRows, useConsoleActions } from "./useConsoleActions";
import { useConsoleRows } from "./useConsoleRows";
import { useConsolePrefs } from "./consolePrefs";

/**
 * The drawer's Console view: the WebView's console as one stream with the prompt at its foot,
 * results interleaved where they happened, and an Errors mode that groups errors by message
 * and top app frame. Capture lives at app level; this view only reads it.
 */
const props = defineProps<{ active: boolean }>();

const store = useConsoleStore();
const drawer = useDrawerStore();
const targets = useTargetsStore();
const toolbarSlot = useDrawerToolbarSlot();
const history = useQueryHistory("capubridge:drawer-console-history");
const prefs = useConsolePrefs();

const query = prefs.query;
const following = ref(true);
const { rows, revision, pending, compiled, floor, isExpanded, toggleGroup } = useConsoleRows(
  query,
  following,
);
const prompt = ref<InstanceType<typeof ConsolePrompt> | null>(null);
const actions = useConsoleActions(query, (expression) => prompt.value?.fill(expression));
const suggest = useConsoleSuggest(store.consoleSource.ring, history.recent);

const list = ref<StreamListHandle | null>(null);
const expanded = shallowRef<ReadonlySet<string>>(new Set());
const menuRow = shallowRef<ConsoleStreamRow | null>(null);

const mode = computed(() => drawer.consoleMode);
const appOrigin = computed(() => originOf(targets.selectedTarget?.url));
const targetLabel = computed(
  () => targets.selectedTarget?.title?.trim() || targets.selectedTarget?.packageName || "the page",
);
const status = computed(() => consoleStatus(store.captureStatus, store.liveSince));
const errorCount = computed(() => store.levelCounts.error + store.exceptionCount);
const tally = computed(() => {
  const total = store.levelCounts.all.toLocaleString();
  return compiled.value.predicate
    ? `${rows.value.length.toLocaleString()} rows of ${total} messages`
    : `${total} messages`;
});

const errorGroups = computed<ErrorGroup[]>(() => {
  if (mode.value !== "errors") return [];
  void store.entryVersion;
  void store.exceptionVersion;
  return groupConsoleErrors({
    entries: store.consoleSource.ring,
    exceptions: store.exceptionSource.ring,
    appOrigin: appOrigin.value,
    test: compiled.value.predicate,
  });
});

const revealOptions = {
  rows,
  idOf: (row: ConsoleStreamRow) => row.key,
  scrollToIndex: (index: number) => {
    following.value = false;
    const row = rows.value[index];
    if (row) list.value?.scrollToKey(row.key);
  },
  showAll: () => {
    query.value = "";
    drawer.setConsoleMode("stream");
  },
};
const flashConsole = useRevealFocus("console", revealOptions);
const flashException = useRevealFocus("exception", revealOptions);
const flashKey = computed(() => flashConsole.value ?? flashException.value);

function keyOf(row: ConsoleStreamRow): string {
  return row.key;
}

function toggle(key: string) {
  const row = rows.value.find((candidate) => candidate.key === key);
  if (row?.item.kind === "entry" && row.item.entry.isGroup) {
    toggleGroup(row.item.entry);
    return;
  }
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
  if (next.has(key)) following.value = false;
}

function clear() {
  store.clearConsole();
  store.clearExceptions();
  store.clearReplHistory();
  expanded.value = new Set();
}

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
    event.preventDefault();
    clear();
  }
}

function retry() {
  store.retry().catch((error: unknown) => {
    store.error = `Could not reconnect the console: ${String(error)}`;
  });
}

const empty = computed(() => {
  if (mode.value === "errors") {
    if (errorGroups.value.length > 0) return null;
    return {
      title: compiled.value.predicate ? "No errors match the filter" : "No errors so far",
      detail: compiled.value.predicate
        ? null
        : "Uncaught exceptions and console.error calls land here, grouped.",
      raw: null,
      tone: "neutral" as const,
      action: compiled.value.predicate ? ("clear-filter" as const) : null,
    };
  }
  if (rows.value.length > 0) return null;
  if (store.captureStatus === "error") {
    return {
      title: `The console of ${targetLabel.value} is not connected`,
      detail: "Capubridge retries on its own; you can retry now.",
      raw: store.error,
      tone: "error" as const,
      action: "retry" as const,
    };
  }
  if (compiled.value.predicate && store.levelCounts.all > 0) {
    return {
      title: `Nothing matches ${query.value.trim()}`,
      detail: `${store.levelCounts.all.toLocaleString()} messages are kept.`,
      raw: null,
      tone: "neutral" as const,
      action: "clear-filter" as const,
    };
  }
  return {
    title: "Nothing logged yet",
    detail: "Messages from the page appear here. Run something in the prompt below.",
    raw: null,
    tone: "neutral" as const,
    action: null,
  };
});

watch(
  () => drawer.promptRequest,
  () => void nextTick(() => prompt.value?.focus()),
);

function copyGroups(groups: ErrorGroup[]) {
  const text = groups.map((group) => `${group.count}× ${group.message}`).join("\n");
  void copyText(text, groups.length > 1 ? "the errors" : "the error");
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col" @keydown="onKeydown">
    <Teleport v-if="toolbarSlot" :to="toolbarSlot" :disabled="!props.active">
      <ConsoleToolbar
        v-model:query="query"
        :suggest="suggest"
        :problems="compiled.problems"
        :floor="floor"
        :counts="store.levelCounts"
        :error-count="errorCount"
        :mode="mode"
        :status="status"
        :tally="tally"
        :following="following"
        @commit="history.remember"
        @floor="actions.setFloor"
        @mode="drawer.setConsoleMode"
        @follow="following = $event"
        @clear="clear"
      />
    </Teleport>

    <p
      v-if="store.error && !empty"
      class="shrink-0 truncate border-b border-border-subtle px-3 py-1 font-mono text-2xs text-warning"
      role="status"
    >
      {{ store.error }}
    </p>

    <StreamEmpty
      v-if="empty"
      :title="empty.title"
      :detail="empty.detail"
      :raw="empty.raw"
      :tone="empty.tone"
    >
      <Link v-if="empty.action === 'clear-filter'" class="text-xs" @click="query = ''">
        Clear the filter
      </Link>
      <Link v-else-if="empty.action === 'retry'" class="text-xs" @click="retry">Retry now</Link>
    </StreamEmpty>

    <ConsoleErrorsList
      v-else-if="mode === 'errors'"
      :groups="errorGroups"
      :app-origin="appOrigin"
      :actions-for="(row) => actions.actionsFor(row.item)"
      @action="(id, row) => actions.run(id, row)"
      @copy="copyGroups"
    />

    <ContextMenu v-else>
      <ContextMenuTrigger as-child>
        <StreamList
          ref="list"
          :rows="rows"
          :revision="revision"
          :key-of="keyOf"
          :following="following"
          :expanded="expanded"
          :pending="pending"
          pending-label="new messages"
          :flash-key="flashKey"
          label="Console messages"
          @leave-tail="following = false"
          @reach-tail="following = true"
          @toggle="toggle"
          @copy="
            copyText(formatConsoleRows($event), $event.length > 1 ? 'the messages' : 'the message')
          "
          @menu="menuRow = $event"
        >
          <template #row="{ row, selected, active, expanded: open }">
            <ConsoleRowView
              :row="row"
              :selected="selected"
              :active="active"
              :expanded="open"
              :group-open="row.item.kind === 'entry' && isExpanded(row.item.entry)"
              @source="actions.filterSource(row.item, $event)"
              @group="row.item.kind === 'entry' && toggleGroup(row.item.entry)"
            />
          </template>
          <template #detail="{ row }">
            <ConsoleRowDetail
              :row="row"
              :app-origin="appOrigin"
              :actions="actions.actionsFor(row.item)"
              @action="actions.run($event, row)"
            />
          </template>
        </StreamList>
      </ContextMenuTrigger>
      <RowMenu
        v-if="menuRow"
        :actions="actions.actionsFor(menuRow.item)"
        @action="menuRow && actions.run($event, menuRow)"
      />
    </ContextMenu>

    <ConsolePrompt ref="prompt" :target-label="targetLabel" />
  </div>
</template>
