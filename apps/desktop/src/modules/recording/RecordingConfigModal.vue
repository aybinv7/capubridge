<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Activity, ChevronRight, Database, MonitorPlay, Terminal, Wifi } from "lucide-vue-next";
import { Button, Dialog, Input, Switch } from "@capubridge/cladd";
import { useRecordingSession } from "@/composables/useRecordingSession";
import { useRecordingStore } from "@/stores/recording.store";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import type { RecordingConfig } from "@/types/replay.types";
import RecordingTrackRow from "./RecordingTrackRow.vue";

const open = defineModel<boolean>("open", { required: true });

const recordingStore = useRecordingStore();
const targetsStore = useTargetsStore();
const { activeClient } = useCDP();
const { start } = useRecordingSession();

const label = ref("");
const trackRrweb = ref(true);
const trackNetwork = ref(true);
const trackConsole = ref(true);
const trackPerf = ref(true);
const trackLocalStorage = ref(true);
const trackIndexedDB = ref(true);
const trackSqlite = ref(false);
const storageOpen = ref(false);
const reloadTarget = ref(false);

watch(open, (isOpen) => {
  if (isOpen) label.value = `Session ${new Date().toLocaleTimeString()}`;
});

const selectedCdpTarget = computed(() => {
  const target = targetsStore.selectedTarget;
  if (!target?.webSocketDebuggerUrl) return null;
  return target;
});
const hasTarget = computed(() => activeClient.value !== null || selectedCdpTarget.value !== null);
const targetName = computed(() => selectedCdpTarget.value?.title?.trim() || "the selected page");
const hasDatabaseTrack = computed(
  () => trackLocalStorage.value || trackIndexedDB.value || trackSqlite.value,
);
const domReplayOn = computed(() => trackRrweb.value && hasTarget.value);
const canStart = computed(
  () =>
    !recordingStore.isRecording &&
    (domReplayOn.value ||
      trackNetwork.value ||
      trackConsole.value ||
      trackPerf.value ||
      hasDatabaseTrack.value),
);

function setAllDatabases(value: boolean) {
  trackLocalStorage.value = value;
  trackIndexedDB.value = value;
  trackSqlite.value = false;
}

async function handleStart() {
  if (!canStart.value) return;
  const config: RecordingConfig = {
    label: label.value.trim() || "Unnamed session",
    tracks: {
      rrweb: domReplayOn.value,
      network: trackNetwork.value,
      console: trackConsole.value,
      perf: trackPerf.value,
      databases: hasDatabaseTrack.value,
    },
    databaseTracks: {
      localStorage: trackLocalStorage.value,
      indexedDB: trackIndexedDB.value,
      sqlite: trackSqlite.value,
    },
    reloadTarget: reloadTarget.value && domReplayOn.value,
  };
  open.value = false;
  await start(config);
}
</script>

<template>
  <Dialog
    v-model:open="open"
    aria-label="Record a session"
    data-overlay
    class="w-[440px] max-w-[calc(100vw-48px)]"
    content-class-name="flex flex-col gap-0 p-0"
  >
    <header class="flex flex-col gap-1 px-5 pt-5 pb-4">
      <h2 class="flex items-center gap-2 text-sm font-medium text-foreground">
        <span class="size-2 rounded-full bg-signal-rec" aria-hidden="true" />
        Record a session
      </h2>
      <p class="text-xs text-muted-foreground">
        Captures {{ targetName }} until you press stop. You can replay it later, step by step.
      </p>
    </header>

    <div class="flex flex-col gap-1.5 px-5 pb-4">
      <span class="text-2xs text-muted-foreground">Name</span>
      <Input v-model="label" size="md" placeholder="Login flow on a slow network" auto-focus />
    </div>

    <div class="flex flex-col gap-px border-y border-border-subtle px-2.5 py-2">
      <RecordingTrackRow
        :icon="MonitorPlay"
        title="Screen replay"
        :hint="hasTarget ? 'Every change on the page, to scrub through' : 'Needs a connected page'"
        :checked="domReplayOn"
        :disabled="!hasTarget"
        @update:checked="trackRrweb = $event"
      />
      <RecordingTrackRow
        :icon="Wifi"
        title="Network"
        hint="Requests and responses"
        :checked="trackNetwork"
        @update:checked="trackNetwork = $event"
      />
      <RecordingTrackRow
        :icon="Terminal"
        title="Console"
        hint="Logs, warnings and errors"
        :checked="trackConsole"
        @update:checked="trackConsole = $event"
      />
      <RecordingTrackRow
        :icon="Activity"
        title="Performance"
        hint="CPU, memory, heap and DOM size"
        :checked="trackPerf"
        @update:checked="trackPerf = $event"
      />
      <RecordingTrackRow
        :icon="Database"
        title="Storage"
        :hint="storageOpen ? 'Choose which stores to follow' : 'Web storage and app databases'"
        :checked="hasDatabaseTrack"
        @update:checked="setAllDatabases"
      >
        <template #trailing>
          <button
            type="button"
            class="grid size-6 place-items-center rounded-control text-[var(--fg-subtle)] hover:bg-cladd-surface-hover hover:text-foreground"
            :aria-label="storageOpen ? 'Hide storage options' : 'Show storage options'"
            :aria-expanded="storageOpen"
            @click.prevent="storageOpen = !storageOpen"
          >
            <ChevronRight
              :size="14"
              :stroke-width="1.8"
              class="transition-transform duration-150"
              :class="storageOpen ? 'rotate-90' : ''"
            />
          </button>
        </template>
      </RecordingTrackRow>
      <template v-if="storageOpen">
        <RecordingTrackRow
          nested
          title="Local storage"
          hint="A snapshot, then every change"
          :checked="trackLocalStorage"
          @update:checked="trackLocalStorage = $event"
        />
        <RecordingTrackRow
          nested
          title="IndexedDB"
          hint="A snapshot, then every change"
          :checked="trackIndexedDB"
          @update:checked="trackIndexedDB = $event"
        />
        <RecordingTrackRow
          nested
          title="Native SQLite"
          hint="The app's own databases, read every 5 seconds"
          :checked="trackSqlite"
          @update:checked="trackSqlite = $event"
        />
      </template>
    </div>

    <footer class="flex items-center gap-3 px-5 py-3.5">
      <label
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs"
        :class="domReplayOn ? 'text-muted-foreground' : 'pointer-events-none opacity-45'"
        title="Starts the replay from a clean, complete page"
      >
        <Switch
          size="sm"
          :model-value="reloadTarget && domReplayOn"
          :disabled="!domReplayOn"
          aria-label="Reload the page first"
          @update:model-value="reloadTarget = $event === true"
        />
        <span class="truncate">Reload the page first</span>
      </label>
      <Button variant="transparent" size="sm" content-class-name="px-3" @click="open = false">
        Cancel
      </Button>
      <Button
        variant="solid"
        color="red"
        size="sm"
        content-class-name="gap-2 px-3"
        :disabled="!canStart"
        @click="handleStart"
      >
        <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
        Start recording
      </Button>
    </footer>
  </Dialog>
</template>
