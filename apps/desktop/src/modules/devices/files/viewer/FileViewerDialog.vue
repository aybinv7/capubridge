<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { Dialog } from "@capubridge/cladd";
import { isEditableTarget } from "@/lib/commands/editable";
import ViewerBody from "@/shared/file-viewer/ViewerBody.vue";
import type { ViewerActions } from "@/shared/file-viewer/viewerActions";
import type { ViewerState } from "@/shared/file-viewer/viewerContent";
import { viewerKeyAction } from "@/shared/file-viewer/viewerCopy";
import type { DeviceFileListEntry } from "../filePaths";
import ViewerHeader from "./ViewerHeader.vue";
import type { GalleryPosition } from "./gallery";

const NOT_THE_SELECTED_APP =
  "To browse its tables, select the app that owns it, then open Data › SQLite. That screen lists the databases in the app's own folder.";

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

const router = useRouter();
const findSignal = ref(0);

const actions = computed<ViewerActions>(() => ({
  openOnComputer: true,
  chooseApp: true,
  download: true,
  database: props.databaseRoute
    ? { canOpen: true }
    : { canOpen: false, hint: NOT_THE_SELECTED_APP },
}));

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

async function openDatabase() {
  const route = props.databaseRoute;
  if (!route) return;
  open.value = false;
  await router.push(route);
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
        :name="props.entry.name"
        :path="props.entry.path"
        :state="props.state"
        :find-signal="findSignal"
        :actions="actions"
        @retry="emit('retry')"
        @download="forEntry('download')"
        @open-on-computer="forEntry('openOnComputer')"
        @choose-app="forEntry('chooseApp')"
        @open-database="openDatabase"
      />
    </template>
  </Dialog>
</template>
