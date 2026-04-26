<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { FolderOpen, AlertCircle, Loader2 } from "lucide-vue-next";
import { open as openFilePicker } from "@tauri-apps/plugin-dialog";
import { useRoute } from "vue-router";
import { useTimelineClock } from "@/composables/useTimelineClock";
import { useReplaySession } from "@/composables/useReplaySession";
import { Button } from "@/components/ui/button";
import ReplayPlayer from "./ReplayPlayer.vue";
import ReplayTimeline from "./ReplayTimeline.vue";
import ReplayNetworkLane from "./ReplayNetworkLane.vue";
import ReplayConsoleLane from "./ReplayConsoleLane.vue";

const route = useRoute();
const { session, isLoading, error, load } = useReplaySession();

const clock = useTimelineClock(0);

const playerRef = ref<InstanceType<typeof ReplayPlayer> | null>(null);
const activePane = ref<"network" | "console">("network");

onMounted(() => {
  const filePath = route.query.file as string | undefined;
  if (filePath) loadFile(filePath);
});

async function loadFile(filePath: string) {
  clock.pause();
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

async function openPicker() {
  const selected = await openFilePicker({
    title: "Open .capu session",
    filters: [{ name: "Capu sessions", extensions: ["capu"] }],
    multiple: false,
    directory: false,
  });
  if (typeof selected === "string") await loadFile(selected);
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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

function formatDuration(ms: number): string {
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
    <div
      v-if="isLoading"
      class="flex flex-1 items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 class="w-5 h-5 animate-spin" />
      <span class="text-sm">Loading session…</span>
    </div>

    <div
      v-else-if="error"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <AlertCircle class="w-8 h-8 text-destructive" />
      <p class="text-sm">Failed to load session</p>
      <p class="text-[11px] text-muted-foreground/60 max-w-sm text-center">{{ error }}</p>
      <Button variant="outline" size="sm" class="mt-2" @click="openPicker">
        <FolderOpen class="w-3.5 h-3.5 mr-1.5" />
        Open another file
      </Button>
    </div>

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
        <FolderOpen class="w-3.5 h-3.5 mr-1.5" />
        Open .capu file
      </Button>
    </div>

    <template v-else>
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
        <Button variant="outline" size="sm" class="h-6 text-[11px] px-2" @click="openPicker">
          <FolderOpen class="w-3 h-3 mr-1" />
          Open
        </Button>
      </div>

      <div class="flex flex-1 min-h-0">
        <div class="flex-1 min-w-0 p-2">
          <ReplayPlayer ref="playerRef" :events="session.rrwebEvents" class="h-full" />
        </div>

        <div class="w-80 shrink-0 border-l border-border/20 flex flex-col min-h-0">
          <div class="flex-none flex border-b border-border/20">
            <button
              class="flex-1 py-1.5 text-[11px] font-medium transition-colors"
              :class="
                activePane === 'network'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-muted-foreground/50 hover:text-foreground'
              "
              @click="activePane = 'network'"
            >
              Network
            </button>
            <button
              class="flex-1 py-1.5 text-[11px] font-medium transition-colors"
              :class="
                activePane === 'console'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-muted-foreground/50 hover:text-foreground'
              "
              @click="activePane = 'console'"
            >
              Console
            </button>
          </div>

          <div class="flex-1 min-h-0">
            <ReplayNetworkLane
              v-if="activePane === 'network'"
              :events="session.networkEvents"
              :position-ms="clock.positionMs.value"
              class="h-full"
            />
            <ReplayConsoleLane
              v-else
              :events="session.consoleEvents"
              :position-ms="clock.positionMs.value"
              class="h-full"
            />
          </div>
        </div>
      </div>

      <ReplayTimeline
        :clock="clock"
        :network-events="session.networkEvents"
        :console-events="session.consoleEvents"
        @seek="onSeek"
        @play="onPlay"
        @pause="onPause"
      />
    </template>
  </div>
</template>
