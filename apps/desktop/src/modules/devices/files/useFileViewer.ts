import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from "vue";
import { toast } from "vue-sonner";
import { invokeCommand } from "@/runtime/ipc/client";
import {
  decodeBase64Text,
  fileMimeType,
  fileViewerKind,
  parseJsonViewerValue,
  type DeviceFileViewerContent,
} from "./fileKinds";
import type { DeviceFileListEntry } from "./filePaths";

/**
 * The in-app viewer for images, videos, JSON and text, with previous / next over the folder's
 * pictures and videos. Files it cannot show go to `unsupported`, which offers other ways to open.
 */
export function useFileViewer(serial: Ref<string>, entries: ComputedRef<DeviceFileListEntry[]>) {
  const open = ref(false);
  const loading = ref(false);
  const error = ref("");
  const pending = shallowRef<DeviceFileListEntry | null>(null);
  const content = shallowRef<DeviceFileViewerContent | null>(null);
  const unsupported = shallowRef<DeviceFileListEntry | null>(null);
  let requestId = 0;

  const entry = computed(() => content.value?.entry ?? pending.value);
  const gallery = computed(() =>
    entries.value.filter((item) => {
      const kind = fileViewerKind(item);
      return kind === "image" || kind === "video";
    }),
  );
  const galleryIndex = computed(() =>
    entry.value ? gallery.value.findIndex((item) => item.path === entry.value?.path) : -1,
  );

  watch(open, (isOpen) => {
    if (isOpen) return;
    requestId += 1;
    loading.value = false;
    content.value = null;
    pending.value = null;
  });

  const unsupportedOpen = computed({
    get: () => unsupported.value !== null,
    set: (value: boolean) => {
      if (!value) unsupported.value = null;
    },
  });

  async function show(target: DeviceFileListEntry) {
    const kind = fileViewerKind(target);
    if (!kind) {
      open.value = false;
      unsupported.value = target;
      return;
    }
    const id = ++requestId;
    unsupported.value = null;
    open.value = true;
    loading.value = true;
    error.value = "";
    pending.value = target;
    content.value = null;
    try {
      const file = await invokeCommand("adb_read_file", {
        serial: serial.value,
        path: target.path,
      });
      if (id !== requestId) return;
      const mime = fileMimeType(target, kind);
      const text = kind === "json" || kind === "text" ? decodeBase64Text(file.base64) : "";
      content.value = {
        entry: { ...target, size: file.size },
        kind,
        mime,
        dataUrl: `data:${mime};base64,${file.base64}`,
        text,
        jsonValue: kind === "json" ? parseJsonViewerValue(text) : null,
      };
    } catch (err) {
      if (id !== requestId) return;
      error.value = String(err);
      toast.error(`Could not open ${target.name}`, { description: String(err) });
    } finally {
      if (id === requestId) loading.value = false;
    }
  }

  function step(direction: "prev" | "next") {
    const items = gallery.value;
    if (items.length < 2) return;
    const current = Math.max(0, galleryIndex.value);
    const next =
      direction === "prev"
        ? (current - 1 + items.length) % items.length
        : (current + 1) % items.length;
    const target = items[next];
    if (target) void show(target);
  }

  function close() {
    open.value = false;
    unsupported.value = null;
  }

  return {
    open,
    loading,
    error,
    entry,
    content,
    galleryIndex,
    galleryTotal: computed(() => gallery.value.length),
    unsupported,
    unsupportedOpen,
    show,
    step,
    close,
  };
}
