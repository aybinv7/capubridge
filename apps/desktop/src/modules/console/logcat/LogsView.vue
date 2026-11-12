<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { Link } from "@capubridge/cladd";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useDrawerToolbarSlot } from "@/shared/drawer/toolbarSlot";
import { useRevealFocus } from "@/shared/timeline/revealFocus";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useLogcatStore } from "@/stores/logcat.store";
import RowMenu from "../list/RowMenu.vue";
import StreamEmpty from "../list/StreamEmpty.vue";
import StreamList from "../list/StreamList.vue";
import { useQueryHistory } from "../list/useQueryHistory";
import type { StreamListHandle } from "../list/streamList.types";
import { exportLogs, type LogsExportFormat } from "./logsExport";
import { useLogsPrefs } from "./logsPrefs";
import { logsStatus } from "./logsStatus";
import { useLogsSuggest } from "./logsSuggest";
import LogsRowView from "./LogsRow.vue";
import LogsRowDetail from "./LogsRowDetail.vue";
import LogsToolbar from "./LogsToolbar.vue";
import { formatLogsRows, useLogsActions } from "./useLogsActions";
import { useLogsRows, type LogsRow } from "./useLogsRows";
import { copyText } from "../list/copyText";

/**
 * The drawer's Logs view: the device's logcat as 22 px lines that follow the end, filtered by
 * one query in Android Studio's grammar, with repeats folded and rows that open into detail.
 * Capture lives at app level; this view only reads it.
 */
const props = defineProps<{ active: boolean }>();

const logcat = useLogcatStore();
const devices = useDevicesStore();
const deviceNames = useDeviceNamesStore();
const prefs = useLogsPrefs();
const toolbarSlot = useDrawerToolbarSlot();
const history = useQueryHistory("capubridge:drawer-logs-history");

const query = prefs.query;
const {
  rows,
  pending,
  evictedWhileFrozen,
  matched,
  revision,
  compiled,
  predicate,
  floor,
  filtering,
  myPackage,
} = useLogsRows(query);
const actions = useLogsActions(query);
const suggest = useLogsSuggest({
  ring: logcat.ring,
  packages: computed(() => logcat.packages),
  myPackage,
  recent: history.recent,
});

const list = ref<StreamListHandle | null>(null);
const expanded = shallowRef<ReadonlySet<string>>(new Set());
const menuRow = shallowRef<LogsRow | null>(null);
const exporting = ref(false);

const following = computed(() => !logcat.isPaused);
const deviceName = computed(() =>
  devices.selectedDevice ? deviceNames.nameOf(devices.selectedDevice) : "the device",
);
const status = computed(() =>
  logsStatus({ state: logcat.streamState, liveSince: logcat.liveSince, attempt: logcat.attempt }),
);
const tally = computed(() => {
  const total = logcat.size.toLocaleString();
  return filtering.value ? `${matched.value.toLocaleString()} of ${total} lines` : `${total} lines`;
});
const pendingLabel = computed(() =>
  evictedWhileFrozen.value > 0 ? "new lines, the oldest no longer kept" : "new lines",
);

const flashKey = useRevealFocus("logcat", {
  rows,
  idOf: (row) => row.key,
  scrollToIndex: (index) => {
    logcat.pause();
    const row = rows.value[index];
    if (row) list.value?.scrollToKey(row.key);
  },
  showAll: () => {
    query.value = "";
  },
});

function keyOf(row: LogsRow): string {
  return row.key;
}

function toggle(key: string) {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
  if (next.has(key) && following.value) logcat.pause();
}

function follow(on: boolean) {
  if (on) logcat.resume();
  else logcat.pause();
}

function clear() {
  logcat.clear();
  expanded.value = new Set();
}

function showErrors() {
  actions.setFloor("E");
}

async function save(format: string) {
  exporting.value = true;
  try {
    await exportLogs(logcat.ring, predicate.value, format as LogsExportFormat, deviceName.value);
  } finally {
    exporting.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
    event.preventDefault();
    clear();
  }
}

const empty = computed(() => {
  if (rows.value.length > 0) return null;
  if (logcat.error) {
    return {
      title: `Logcat on ${deviceName.value} stopped answering`,
      detail: "Capubridge keeps trying. Start the capture again if it does not come back.",
      raw: logcat.error,
      tone: "error" as const,
      action: "restart" as const,
    };
  }
  if (filtering.value && logcat.size > 0) {
    return {
      title: query.value.trim() ? `No lines match ${query.value.trim()}` : "Every line is hidden",
      detail: prefs.hideEchoes.value
        ? "WebView console echoes are hidden too."
        : `${logcat.size.toLocaleString()} lines are kept.`,
      raw: null,
      tone: "neutral" as const,
      action: "clear-filter" as const,
    };
  }
  return {
    title: `Waiting for the first line from ${deviceName.value}`,
    detail: logcat.streamState === "live" ? "Logcat is live; nothing has been written yet." : null,
    raw: null,
    tone: "neutral" as const,
    action: null,
  };
});

function clearFilter() {
  query.value = "";
  prefs.hideEchoes.value = false;
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col" @keydown="onKeydown">
    <Teleport v-if="toolbarSlot" :to="toolbarSlot" :disabled="!props.active">
      <LogsToolbar
        v-model:query="query"
        :suggest="suggest"
        :problems="compiled.problems"
        :floor="floor"
        :counts="logcat.levelCounts"
        :status="status"
        :tally="tally"
        :following="following"
        :exporting="exporting"
        @commit="history.remember"
        @floor="actions.setFloor"
        @follow="follow"
        @restart="logcat.restart()"
        @clear="clear"
        @export="save"
        @show-errors="showErrors"
      />
    </Teleport>

    <p
      v-if="logcat.error && !empty"
      class="shrink-0 truncate border-b border-border-subtle px-3 py-1 font-mono text-2xs text-warning"
      role="status"
    >
      {{ logcat.error }}
    </p>

    <StreamEmpty
      v-if="empty"
      :title="empty.title"
      :detail="empty.detail"
      :raw="empty.raw"
      :tone="empty.tone"
    >
      <Link v-if="empty.action === 'clear-filter'" class="text-xs" @click="clearFilter">
        Clear the filter
      </Link>
      <Link v-else-if="empty.action === 'restart'" class="text-xs" @click="logcat.restart()">
        Start the capture again
      </Link>
    </StreamEmpty>

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
          :pending-label="pendingLabel"
          :flash-key="flashKey"
          label="Log lines"
          @leave-tail="logcat.pause()"
          @reach-tail="logcat.resume()"
          @toggle="toggle"
          @copy="copyText(formatLogsRows($event), $event.length > 1 ? 'the lines' : 'the line')"
          @menu="menuRow = $event"
        >
          <template #row="{ row, selected, active, expanded: open }">
            <LogsRowView
              :row="row"
              :selected="selected"
              :active="active"
              :expanded="open"
              :process-column="prefs.processColumn.value"
              @field="actions.edit"
            />
          </template>
          <template #detail="{ row }">
            <LogsRowDetail :row="row" :app-package="myPackage" @field="actions.edit" />
          </template>
        </StreamList>
      </ContextMenuTrigger>
      <RowMenu
        v-if="menuRow"
        :actions="actions.actionsFor(menuRow.last)"
        @action="menuRow && actions.run($event, menuRow)"
      />
    </ContextMenu>
  </div>
</template>
