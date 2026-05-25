<script setup lang="ts">
import { ref, computed } from "vue";
import { Activity, ChevronDown, Circle, Database, Globe, Terminal, Wifi } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRecordingSession } from "@/composables/useRecordingSession";
import { useRecordingStore } from "@/stores/recording.store";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import type { RecordingConfig } from "@/types/replay.types";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const recordingStore = useRecordingStore();
const targetsStore = useTargetsStore();
const { activeClient } = useCDP();
const { start } = useRecordingSession();

const label = ref("Session " + new Date().toLocaleTimeString());
const trackRrweb = ref(true);
const trackNetwork = ref(true);
const trackConsole = ref(true);
const trackPerf = ref(true);
const trackLocalStorage = ref(true);
const trackIndexedDB = ref(true);
const trackSqlite = ref(false);
const storageOpen = ref(false);
const reloadTarget = ref(false);

const selectedCdpTarget = computed(() => {
  const target = targetsStore.selectedTarget;
  if (!target) return null;
  if (target.source === "local" && !target.webSocketDebuggerUrl) return null;
  return target.webSocketDebuggerUrl ? target : null;
});
const hasTarget = computed(() => activeClient.value !== null || selectedCdpTarget.value !== null);
const hasDatabaseTrack = computed(
  () => trackLocalStorage.value || trackIndexedDB.value || trackSqlite.value,
);
const canStart = computed(
  () =>
    !recordingStore.isRecording &&
    (trackRrweb.value ||
      trackNetwork.value ||
      trackConsole.value ||
      trackPerf.value ||
      hasDatabaseTrack.value),
);

async function handleStart() {
  if (!canStart.value) return;
  const config: RecordingConfig = {
    label: label.value.trim() || "Unnamed session",
    tracks: {
      rrweb: trackRrweb.value && hasTarget.value,
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
    reloadTarget: reloadTarget.value,
  };
  emit("update:open", false);
  await start(config);
}
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Circle class="w-3.5 h-3.5 text-destructive" />
          New Recording
        </DialogTitle>
        <DialogDescription>
          Capture DOM replay, network, console, and storage for this session.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Session label
        </label>
        <Input v-model="label" placeholder="e.g. Login flow test" class="h-8 text-sm" />
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Capture tracks
        </label>
        <div class="space-y-1 rounded-md border border-border/30 bg-surface-1 p-2">
          <div
            class="flex items-center justify-between px-2 py-1.5 rounded-sm"
            :class="!hasTarget ? 'opacity-40' : ''"
          >
            <div class="flex items-center gap-2">
              <Globe class="w-3.5 h-3.5 text-muted-foreground" />
              <div>
                <p class="text-sm">DOM replay</p>
                <p class="text-[11px] text-muted-foreground">
                  {{ hasTarget ? "rrweb injected via CDP" : "No target connected" }}
                </p>
              </div>
            </div>
            <Switch
              :checked="trackRrweb && hasTarget"
              :disabled="!hasTarget"
              @update:checked="trackRrweb = $event"
            />
          </div>

          <div class="flex items-center justify-between px-2 py-1.5 rounded-sm">
            <div class="flex items-center gap-2">
              <Wifi class="w-3.5 h-3.5 text-muted-foreground" />
              <div>
                <p class="text-sm">Network</p>
                <p class="text-[11px] text-muted-foreground">HTTP requests & responses</p>
              </div>
            </div>
            <Switch :checked="trackNetwork" @update:checked="trackNetwork = $event" />
          </div>

          <div class="flex items-center justify-between px-2 py-1.5 rounded-sm">
            <div class="flex items-center gap-2">
              <Terminal class="w-3.5 h-3.5 text-muted-foreground" />
              <div>
                <p class="text-sm">Console</p>
                <p class="text-[11px] text-muted-foreground">Logs, warnings, errors</p>
              </div>
            </div>
            <Switch :checked="trackConsole" @update:checked="trackConsole = $event" />
          </div>

          <div class="flex items-center justify-between px-2 py-1.5 rounded-sm">
            <div class="flex items-center gap-2">
              <Activity class="w-3.5 h-3.5 text-muted-foreground" />
              <div>
                <p class="text-sm">Performance</p>
                <p class="text-[11px] text-muted-foreground">CPU, memory, heap, DOM</p>
              </div>
            </div>
            <Switch :checked="trackPerf" @update:checked="trackPerf = $event" />
          </div>

          <Collapsible v-model:open="storageOpen">
            <div class="flex items-center justify-between px-2 py-1.5 rounded-sm">
              <CollapsibleTrigger as-child>
                <button type="button" class="flex min-w-0 items-center gap-2 text-left">
                  <Database class="w-3.5 h-3.5 text-muted-foreground" />
                  <div class="min-w-0">
                    <p class="text-sm">Databases</p>
                    <p class="text-[11px] text-muted-foreground">
                      Web storage and package SQLite snapshots
                    </p>
                  </div>
                  <ChevronDown
                    class="ml-1 h-3.5 w-3.5 text-muted-foreground/50 transition-transform"
                    :class="{ '-rotate-90': !storageOpen }"
                  />
                </button>
              </CollapsibleTrigger>
              <Switch
                :checked="hasDatabaseTrack"
                @update:checked="
                  (value) => {
                    trackLocalStorage = value;
                    trackIndexedDB = value;
                    trackSqlite = false;
                  }
                "
              />
            </div>
            <CollapsibleContent>
              <div class="ml-8 mr-2 mb-1 rounded border border-border/20 bg-surface-2/40">
                <div class="flex items-center justify-between px-2 py-1.5">
                  <div>
                    <p class="text-xs">LocalStorage</p>
                    <p class="text-[10px] text-muted-foreground/50">Snapshot + change states</p>
                  </div>
                  <Switch
                    :checked="trackLocalStorage"
                    @update:checked="
                      (value) => {
                        trackLocalStorage = value;
                      }
                    "
                  />
                </div>
                <div
                  class="flex items-center justify-between border-t border-border/20 px-2 py-1.5"
                >
                  <div>
                    <p class="text-xs">IndexedDB</p>
                    <p class="text-[10px] text-muted-foreground/50">
                      SQLite artifact + timeline changes
                    </p>
                  </div>
                  <Switch
                    :checked="trackIndexedDB"
                    @update:checked="
                      (value) => {
                        trackIndexedDB = value;
                      }
                    "
                  />
                </div>
                <div
                  class="flex items-center justify-between border-t border-border/20 px-2 py-1.5"
                >
                  <div>
                    <p class="text-xs">Native SQLite</p>
                    <p class="text-[10px] text-muted-foreground/50">
                      Package databases, 5s polling
                    </p>
                  </div>
                  <Switch
                    :checked="trackSqlite"
                    @update:checked="
                      (value) => {
                        trackSqlite = value;
                      }
                    "
                  />
                </div>
                <div
                  class="flex items-center justify-between border-t border-border/20 px-2 py-1.5 opacity-45"
                >
                  <span class="text-xs">localForage</span>
                  <span class="text-[10px] text-muted-foreground/50">Next</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div v-if="trackRrweb && hasTarget" class="flex items-center justify-between">
        <div>
          <p class="text-sm">Reload page on start</p>
          <p class="text-[11px] text-muted-foreground">
            Recommended — gives rrweb a clean full-page snapshot
          </p>
        </div>
        <Switch :checked="reloadTarget" @update:checked="reloadTarget = $event" />
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" @click="emit('update:open', false)">Cancel</Button>
        <Button
          size="sm"
          :disabled="!canStart"
          class="bg-destructive hover:bg-destructive/90 text-white"
          @click="handleStart"
        >
          Start recording
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
