<script setup lang="ts">
import { ref, shallowRef, watch, onMounted } from "vue";
import { FolderOpen, AlertCircle, Loader2, ScanSearch } from "lucide-vue-next";
import { open as openFilePicker } from "@tauri-apps/plugin-dialog";
import { useRoute } from "vue-router";
import { useTimelineClock } from "@/composables/useTimelineClock";
import { useReplaySession } from "@/composables/useReplaySession";
import { Button } from "@/components/ui/button";
import ReplayPlayer from "./ReplayPlayer.vue";
import ReplayTimeline from "./ReplayTimeline.vue";
import ReplayNetworkPanel from "./ReplayNetworkPanel.vue";
import ReplayConsoleLane from "./ReplayConsoleLane.vue";
import ReplayPerformanceLane from "./ReplayPerformanceLane.vue";
import ReplayElementsPanel from "./ReplayElementsPanel.vue";
import ReplayDatabasesPanel from "./ReplayDatabasesPanel.vue";
import ReplaySessionPicker from "./ReplaySessionPicker.vue";

const pickerOpen = ref(false);

const route = useRoute();
const { session, isLoading, error, load } = useReplaySession();

const clock = useTimelineClock(0);

const playerRef = ref<InstanceType<typeof ReplayPlayer> | null>(null);
const activePane = ref<"network" | "console" | "performance" | "databases" | "elements">("network");
const inspectActive = ref(false);
/** Raw Element reference from the replay iframe, set on player click or tree click */
const selectedIframeEl = shallowRef<Element | null>(null);

function onInspectSelect(el: Element) {
  selectedIframeEl.value = el;
  activePane.value = "elements";
}

/** Getter passed to ReplayElementsPanel so it can snapshot the iframe DOM on demand */
function getIframeDoc(): Document | null {
  return playerRef.value?.getIframeDoc() ?? null;
}

const splitRef = ref<HTMLElement | null>(null);
const leftPct = ref(50);

function startResize(e: MouseEvent) {
  e.preventDefault();
  const container = splitRef.value;
  if (!container) return;
  const onMove = (ev: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    const pct = ((ev.clientX - rect.left) / rect.width) * 100;
    leftPct.value = Math.max(20, Math.min(80, pct));
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

onMounted(() => {
  const filePath = route.query.file as string | undefined;
  if (filePath) loadFile(filePath);
});

async function loadFile(filePath: string) {
  clock.pause();
  inspectActive.value = false;
  selectedIframeEl.value = null;
  await load(filePath);
}

watch(
  () => session.value,
  (s) => {
    if (!s) return;
    clock.seek(0);
    clock.setDuration(s.manifest.duration);
  },
);

function openPicker() {
  pickerOpen.value = true;
}

async function openFromDisk() {
  const selected = await openFilePicker({
    title: "Open .capu session",
    filters: [{ name: "Capu sessions", extensions: ["capu"] }],
    multiple: false,
    directory: false,
  });
  if (typeof selected === "string") await loadFile(selected);
}

function handlePickerSelect(filePath: string) {
  void loadFile(filePath);
}

function onSeek(ms: number) {
  if (clock.isPlaying.value) {
    playerRef.value?.play(ms);
  } else {
    playerRef.value?.seekTo(ms);
  }
}

function onPlay() {
  playerRef.value?.play(clock.positionMs.value);
}
function onPause() {
  playerRef.value?.pause(clock.positionMs.value);
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleString();
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
</script>

<template>
  <div class="flex flex-col h-full bg-background">
    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex flex-1 items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 class="w-5 h-5 animate-spin" />
      <span class="text-sm">Loading session…</span>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <AlertCircle class="w-8 h-8 text-destructive" />
      <p class="text-sm">Failed to load session</p>
      <p class="text-[11px] text-muted-foreground/60 max-w-sm text-center">{{ error }}</p>
      <Button variant="outline" size="sm" class="mt-2" @click="openPicker">
        <FolderOpen class="w-3.5 h-3.5 mr-1.5" /> Open another file
      </Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!session"
      class="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground"
    >
      <div
        class="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center border border-border/20"
      >
        <FolderOpen class="w-7 h-7 text-muted-foreground/40" />
      </div>
      <div class="text-center">
        <p class="text-sm font-medium text-foreground/70">No session loaded</p>
        <p class="text-[11px] text-muted-foreground/50 mt-1">Open a .capu file to replay it</p>
      </div>
      <Button size="sm" @click="openPicker">
        <FolderOpen class="w-3.5 h-3.5 mr-1.5" /> Open .capu file
      </Button>
    </div>

    <template v-else>
      <!-- Session info bar -->
      <div
        class="flex-none flex items-center gap-4 px-4 py-2 border-b border-border/20 text-[11px] text-muted-foreground bg-surface-1"
      >
        <span class="font-medium text-foreground/80">{{ session.manifest.label }}</span>
        <span class="text-border/60">·</span>
        <span>{{ formatDate(session.manifest.startedAt) }}</span>
        <span class="text-border/60">·</span>
        <span>{{ formatDuration(session.manifest.duration) }}</span>
        <template v-if="session.manifest.deviceSerial">
          <span class="text-border/60">·</span>
          <span>{{ session.manifest.deviceSerial }}</span>
        </template>
        <div class="flex-1" />

        <!-- Inspect toggle -->
        <button
          class="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors"
          :class="
            inspectActive
              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
              : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-surface-2 border border-transparent'
          "
          :title="inspectActive ? 'Disable inspect' : 'Inspect DOM elements (hover to highlight)'"
          @click="inspectActive = !inspectActive"
        >
          <ScanSearch class="w-3.5 h-3.5" />
          Inspect
        </button>

        <Button variant="outline" size="sm" class="h-6 text-[11px] px-2" @click="openPicker">
          <FolderOpen class="w-3 h-3 mr-1" /> Open
        </Button>
      </div>

      <!-- Main split -->
      <div ref="splitRef" class="flex flex-1 min-h-0 overflow-hidden">
        <!-- Player pane -->
        <div class="flex-none min-w-0 flex flex-col min-h-0 p-2" :style="{ width: leftPct + '%' }">
          <ReplayPlayer
            ref="playerRef"
            :events="session.rrwebEvents"
            :target-url="session.manifest.targetUrl"
            :inspect-active="inspectActive"
            class="flex-1 min-h-0"
            @inspect-select="onInspectSelect"
          />
        </div>

        <!-- Drag divider -->
        <div
          class="w-1 shrink-0 bg-border/20 hover:bg-accent/40 active:bg-accent/60 cursor-col-resize transition-colors select-none"
          @mousedown="startResize"
        />

        <!-- Right pane: tabs + panels -->
        <div class="flex-1 min-w-0 border-l border-border/20 flex flex-col min-h-0">
          <div class="flex-none flex border-b border-border/20">
            <button
              class="flex-1 py-1.5 text-[11px] font-medium transition-colors"
              :class="
                activePane === 'network'
                  ? 'text-foreground border-b-2 border-brand'
                  : 'text-muted-foreground/50 hover:text-foreground'
              "
              @click="activePane = 'network'"
            >
              Network
              <span class="ml-1 text-muted-foreground/40 text-[10px]">{{
                session.networkEvents.length
              }}</span>
            </button>
            <button
              class="flex-1 py-1.5 text-[11px] font-medium transition-colors"
              :class="
                activePane === 'databases'
                  ? 'text-foreground border-b-2 border-brand'
                  : 'text-muted-foreground/50 hover:text-foreground'
              "
              @click="activePane = 'databases'"
            >
              Databases
              <span
                v-if="session.databaseEvents.length || session.databasePath"
                class="ml-1 text-muted-foreground/40 text-[10px]"
                >{{ session.databaseEvents.length || "db" }}</span
              >
            </button>
            <button
              class="flex-1 py-1.5 text-[11px] font-medium transition-colors"
              :class="
                activePane === 'console'
                  ? 'text-foreground border-b-2 border-brand'
                  : 'text-muted-foreground/50 hover:text-foreground'
              "
              @click="activePane = 'console'"
            >
              Console
              <span class="ml-1 text-muted-foreground/40 text-[10px]">{{
                session.consoleEvents.length
              }}</span>
            </button>
            <button
              class="flex-1 py-1.5 text-[11px] font-medium transition-colors"
              :class="
                activePane === 'performance'
                  ? 'text-foreground border-b-2 border-brand'
                  : 'text-muted-foreground/50 hover:text-foreground'
              "
              @click="activePane = 'performance'"
            >
              Performance
              <span
                v-if="session.perfEvents.length"
                class="ml-1 text-muted-foreground/40 text-[10px]"
                >{{ session.perfEvents.length }}</span
              >
            </button>
            <button
              class="flex-1 py-1.5 text-[11px] font-medium transition-colors"
              :class="
                activePane === 'elements'
                  ? 'text-foreground border-b-2 border-brand'
                  : 'text-muted-foreground/50 hover:text-foreground'
              "
              @click="activePane = 'elements'"
            >
              Elements
              <span
                v-if="selectedIframeEl"
                class="ml-1 text-[10px]"
                :class="activePane === 'elements' ? 'text-brand' : 'text-muted-foreground/40'"
                >●</span
              >
            </button>
          </div>

          <div class="flex-1 min-h-0">
            <ReplayNetworkPanel
              v-if="activePane === 'network'"
              :events="session.networkEvents"
              :position-ms="clock.positionMs.value"
              class="h-full"
            />
            <ReplayConsoleLane
              v-else-if="activePane === 'console'"
              :events="session.consoleEvents"
              :position-ms="clock.positionMs.value"
              class="h-full"
            />
            <ReplayPerformanceLane
              v-else-if="activePane === 'performance'"
              :perf-events="session.perfEvents"
              :network-events="session.networkEvents"
              :position-ms="clock.positionMs.value"
              :duration="session.manifest.duration"
              class="h-full"
            />
            <ReplayDatabasesPanel
              v-else-if="activePane === 'databases'"
              :events="session.databaseEvents"
              :database-path="session.databasePath"
              :position-ms="clock.positionMs.value"
              class="h-full"
            />
            <ReplayElementsPanel
              v-else
              :get-doc="getIframeDoc"
              :external-selected-el="selectedIframeEl"
              class="h-full"
            />
          </div>
        </div>
      </div>

      <ReplayTimeline
        :clock="clock"
        :network-events="session.networkEvents"
        :console-events="session.consoleEvents"
        :perf-events="session.perfEvents"
        @seek="onSeek"
        @play="onPlay"
        @pause="onPause"
      />
    </template>

    <ReplaySessionPicker
      v-model:open="pickerOpen"
      @select="handlePickerSelect"
      @open-from-disk="openFromDisk"
    />
  </div>
</template>
