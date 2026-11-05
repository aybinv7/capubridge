import { computed, onScopeDispose, ref, shallowRef, watch, type ComputedRef, type Ref } from "vue";
import { invokeCommand } from "@/runtime/ipc/client";
import type { DeviceFileListEntry } from "./filePaths";
import { galleryEntries, galleryNeighbour, galleryPosition } from "./viewer/gallery";
import { loadViewerContent } from "./viewer/loadContent";
import { useDatabaseRoute } from "./viewer/useDatabaseRoute";
import type { FileBytes, ViewerState } from "./viewer/viewerContent";

const STEP_SETTLE_MS = 140;
const RELEASE_AFTER_CLOSE_MS = 260;
const IDLE: ViewerState = { status: "idle" };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The in-app viewer: which file is open, its loading state, and previous / next over the folder's
 * files. Reads go through `adb_read_file_bytes` with a budget per kind; a read that finishes after
 * the user has moved on is dropped, and stepping waits a moment so holding an arrow key does not
 * queue a read per file. Content is released shortly after the dialog closes, once its exit
 * animation is done, so large media does not stay in memory.
 */
export function useFileViewer(serial: Ref<string>, entries: ComputedRef<DeviceFileListEntry[]>) {
  const open = ref(false);
  const entry = shallowRef<DeviceFileListEntry | null>(null);
  const state = shallowRef<ViewerState>(IDLE);
  let requestId = 0;
  let stepTimer: ReturnType<typeof setTimeout> | undefined;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;

  const gallery = computed(() => galleryEntries(entries.value));
  const position = computed(() => galleryPosition(gallery.value, entry.value?.path ?? null));
  const databaseRoute = useDatabaseRoute(serial, entry, state);

  async function load(target: DeviceFileListEntry) {
    const id = ++requestId;
    state.value = { status: "loading" };
    try {
      const outcome = await loadViewerContent(target.name, target.size, async (maxBytes) => {
        const buffer = await invokeCommand("adb_read_file_bytes", {
          serial: serial.value,
          path: target.path,
          maxBytes,
        });
        if (id !== requestId) throw new Error("A newer file was opened");
        const bytes: FileBytes = new Uint8Array(buffer);
        return bytes;
      });
      if (id === requestId) state.value = outcome;
    } catch (error) {
      if (id === requestId) state.value = { status: "error", message: errorText(error) };
    }
  }

  function begin(target: DeviceFileListEntry) {
    clearTimeout(stepTimer);
    clearTimeout(releaseTimer);
    requestId += 1;
    entry.value = target;
    state.value = { status: "loading" };
    open.value = true;
  }

  function show(target: DeviceFileListEntry): Promise<void> {
    begin(target);
    return load(target);
  }

  function step(direction: "prev" | "next") {
    const target = galleryNeighbour(gallery.value, entry.value?.path ?? null, direction);
    if (!target) return;
    begin(target);
    stepTimer = setTimeout(() => void load(target), STEP_SETTLE_MS);
  }

  function retry() {
    if (entry.value) void show(entry.value);
  }

  function close() {
    open.value = false;
  }

  watch(open, (isOpen) => {
    if (isOpen) return;
    requestId += 1;
    clearTimeout(stepTimer);
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      state.value = IDLE;
      entry.value = null;
    }, RELEASE_AFTER_CLOSE_MS);
  });

  onScopeDispose(() => {
    requestId += 1;
    clearTimeout(stepTimer);
    clearTimeout(releaseTimer);
  });

  return { open, entry, state, position, databaseRoute, show, step, retry, close };
}
