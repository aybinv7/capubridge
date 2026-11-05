<script setup lang="ts">
import { ref } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { Dialog } from "@capubridge/cladd";
import { isEditableTarget } from "@/lib/commands/editable";
import type { DeviceFileListEntry } from "../filePaths";
import ViewerBody from "./ViewerBody.vue";
import ViewerHeader from "./ViewerHeader.vue";
import type { GalleryPosition } from "./gallery";
import type { ViewerState } from "./viewerContent";
import { viewerKeyAction } from "./viewerCopy";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  entry: DeviceFileListEntry | null;
  state: ViewerState;
  position: GalleryPosition;
  databaseRoute: RouteLocationRaw | null;
}>();

const emit = defineEmits<{
  step: [direction: "prev" | "next"];
  retry: [];
  download: [entry: DeviceFileListEntry];
  openOnComputer: [entry: DeviceFileListEntry];
  chooseApp: [entry: DeviceFileListEntry];
}>();

const findSignal = ref(0);

function focusOwnsArrows(target: EventTarget | null): boolean {
  return isEditableTarget(target) || target instanceof HTMLMediaElement;
}

function onKeydown(event: KeyboardEvent) {
  const action = viewerKeyAction(event, focusOwnsArrows(event.target));
  if (action === "find") {
    event.preventDefault();
    findSignal.value += 1;
    return;
  }
  if (!action || props.position.total < 2 || props.position.index < 0) return;
  event.preventDefault();
  emit("step", action);
}

function forEntry(action: "download" | "openOnComputer" | "chooseApp") {
  const entry = props.entry;
  if (!entry) return;
  if (action === "download") emit("download", entry);
  else if (action === "openOnComputer") emit("openOnComputer", entry);
  else emit("chooseApp", entry);
}
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :aria-label="props.entry ? `Preview of ${props.entry.name}` : 'File preview'"
    class="h-[calc(100vh-64px)] w-[calc(100vw-64px)] max-w-none"
    content-class-name="flex h-full flex-col gap-0 p-0"
    @keydown="onKeydown"
  >
    <template v-if="props.entry">
      <ViewerHeader
        :entry="props.entry"
        :state="props.state"
        :position="props.position"
        @step="emit('step', $event)"
        @download="forEntry('download')"
        @open-on-computer="forEntry('openOnComputer')"
        @choose-app="forEntry('chooseApp')"
        @close="open = false"
      />
      <ViewerBody
        :entry="props.entry"
        :state="props.state"
        :find-signal="findSignal"
        :database-route="props.databaseRoute"
        @retry="emit('retry')"
        @download="forEntry('download')"
        @open-on-computer="forEntry('openOnComputer')"
        @choose-app="forEntry('chooseApp')"
        @navigated="open = false"
      />
    </template>
  </Dialog>
</template>
