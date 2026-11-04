<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useRecordingStore } from "@/stores/recording.store";
import { useDockStore } from "@/stores/dock.store";

const context = useActiveContextStore();
const devicesStore = useDevicesStore();
const mirrorStore = useMirrorStore();
const recordingStore = useRecordingStore();
const dockStore = useDockStore();

const adb = computed(() => {
  switch (devicesStore.adbServerStatus) {
    case "running":
      return { label: "adb", dot: "bg-success", title: "ADB server running" };
    case "starting":
      return { label: "adb starting", dot: "bg-warning", title: "Starting ADB server" };
    case "error":
      return { label: "adb error", dot: "bg-error", title: devicesStore.error ?? "ADB error" };
    default:
      return { label: "adb", dot: "bg-[var(--fg-subtle)]", title: "ADB status unknown" };
  }
});

const deviceText = computed(() => {
  if (context.kind === "local") return "This PC";
  if (context.kind === "chrome") return "Chrome";
  const device = context.device;
  if (!device) return "no device";
  return `${device.model} · ${device.serial}${device.status === "online" ? "" : ` · ${device.status}`}`;
});

const cdp = computed(() => {
  switch (context.targetStatus) {
    case "connected":
      return { label: "cdp live", tone: "text-signal-live" };
    case "connecting":
      return { label: "cdp connecting", tone: "text-warning" };
    case "error":
    case "disconnected":
      return { label: `cdp ${context.targetStatus}`, tone: "text-error" };
    case "idle":
      return { label: "cdp attached", tone: "text-muted-foreground" };
    default:
      return { label: "no target", tone: "text-[var(--fg-subtle)]" };
  }
});

const mirrorText = computed(() => {
  if (!mirrorStore.isOpen) return null;
  return mirrorStore.isStreaming ? "mirror streaming" : "mirror idle";
});

const elapsedMs = ref(0);
let ticker: ReturnType<typeof setInterval> | null = null;

function stopTicker() {
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
}

watch(
  () => recordingStore.isRecording,
  (recording) => {
    stopTicker();
    if (!recording) return;
    const tick = () => {
      elapsedMs.value = recordingStore.startedAt ? Date.now() - recordingStore.startedAt : 0;
    };
    tick();
    ticker = setInterval(tick, 1000);
  },
  { immediate: true },
);

onUnmounted(stopTicker);

const timecode = computed(() => {
  const total = Math.floor(elapsedMs.value / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});
</script>

<template>
  <footer
    class="flex h-6 shrink-0 items-center gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-chrome)] px-2.5 font-mono text-2xs text-muted-foreground"
    aria-label="Status"
  >
    <span class="flex items-center gap-1.5" :title="adb.title">
      <span class="h-1.5 w-1.5 rounded-full" :class="adb.dot" />
      {{ adb.label }}
    </span>
    <span class="truncate" :title="deviceText">{{ deviceText }}</span>
    <span :class="cdp.tone">{{ cdp.label }}</span>

    <span class="flex-1" />

    <span v-if="mirrorText">{{ mirrorText }}</span>
    <span
      v-if="recordingStore.isRecording"
      class="flex items-center gap-1.5 text-signal-rec"
      aria-live="polite"
    >
      <span class="h-2 w-2 rounded-sm bg-signal-rec" />
      REC {{ timecode }}
    </span>
    <button
      type="button"
      class="flex items-center gap-1 rounded-sm px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
      :class="dockStore.hasUnread && 'text-foreground'"
      title="Toggle dock (Ctrl+J)"
      @click="dockStore.toggleDock()"
    >
      <span v-if="dockStore.hasUnread" class="h-1.5 w-1.5 rounded-full bg-signal-select" />
      console
    </button>
  </footer>
</template>
