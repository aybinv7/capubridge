<script setup lang="ts">
import { ref, computed } from "vue";
import { Circle, Globe, Terminal, Wifi } from "lucide-vue-next";
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
import { useRecordingSession } from "@/composables/useRecordingSession";
import { useRecordingStore } from "@/stores/recording.store";
import { useCDP } from "@/composables/useCDP";
import type { RecordingConfig } from "@/types/replay.types";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const recordingStore = useRecordingStore();
const { activeClient } = useCDP();
const { start } = useRecordingSession();

const label = ref("Session " + new Date().toLocaleTimeString());
const trackRrweb = ref(true);
const trackNetwork = ref(true);
const trackConsole = ref(true);
const reloadTarget = ref(false);

const hasTarget = computed(() => activeClient.value !== null);
const canStart = computed(
  () =>
    !recordingStore.isRecording && (trackRrweb.value || trackNetwork.value || trackConsole.value),
);

async function handleStart() {
  if (!canStart.value) return;
  const config: RecordingConfig = {
    label: label.value.trim() || "Unnamed session",
    tracks: {
      rrweb: trackRrweb.value && hasTarget.value,
      network: trackNetwork.value,
      console: trackConsole.value,
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
          Capture DOM replay, network, and console for this session.
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
