import { onScopeDispose, shallowRef, watch, type Ref } from "vue";
import type { OPFSDomain } from "@capubridge/cdp-protocol";
import { withReadTimeout } from "@/modules/storage/frame/useDataPresence";
import { loadViewerContent } from "@/shared/file-viewer/loadContent";
import type { FileBytes, ViewerState } from "@/shared/file-viewer/viewerContent";
import { kindFromName } from "@/shared/file-viewer/viewerKinds";
import type { OpfsRow } from "./opfsModel";

/**
 * Videos and recordings are read through DevTools in 8 MB Base64 chunks, so the pane stops well
 * below the Device viewer's budget; larger ones are saved with Download.
 */
export const OPFS_MEDIA_PREVIEW_CAP = 32 * 1024 * 1024;

const STEP_SETTLE_MS = 140;
const READ_TIMEOUT_MS = 30_000;
const IDLE: ViewerState = { status: "idle" };

/** The file as read: a new read of the same unchanged file keeps its preview. */
function versionOf(row: OpfsRow | null): string | null {
  return row ? `${row.path}|${row.size}|${row.lastModified}|${row.locked}` : null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Whether the pane refuses a file before reading it, and the state that says so. */
export function refusedPreview(row: Pick<OpfsRow, "name" | "size">): ViewerState | null {
  const kind = kindFromName(row.name);
  if (kind === "video" || kind === "audio") {
    if (row.size !== null && row.size > OPFS_MEDIA_PREVIEW_CAP) {
      return { status: "too-large", kind, cap: OPFS_MEDIA_PREVIEW_CAP, size: row.size };
    }
  }
  return null;
}

/**
 * What the pane shows for the file it follows: read from the phone through DevTools with the
 * shared viewer's budget per kind. A read that finishes after the pane moved on is dropped, a
 * quick run of arrow keys reads only the file it stops on, and nothing is read while the app is
 * away (the read runs when it returns).
 */
export function useOpfsPreview(options: {
  row: Ref<OpfsRow | null>;
  paused: Ref<boolean>;
  domain: () => OPFSDomain;
}) {
  const state = shallowRef<ViewerState>(IDLE);
  let requestId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function load(row: OpfsRow, id: number) {
    try {
      const domain = options.domain();
      const outcome = await loadViewerContent(row.name, row.size ?? 0, async (maxBytes) => {
        const bytes = await withReadTimeout(
          domain.readFileBytes(row.path, { offset: 0, length: maxBytes }),
          READ_TIMEOUT_MS,
        );
        if (id !== requestId) throw new Error("Another file was opened");
        const view: FileBytes = new Uint8Array(bytes);
        return view;
      });
      if (id === requestId) state.value = outcome;
    } catch (error) {
      if (id === requestId) state.value = { status: "error", message: errorText(error) };
    }
  }

  function start(row: OpfsRow | null, settle: boolean) {
    clearTimeout(timer);
    const id = ++requestId;
    if (!row || row.kind === "directory" || row.locked) {
      state.value = IDLE;
      return;
    }
    const refused = refusedPreview(row);
    if (refused) {
      state.value = refused;
      return;
    }
    state.value = { status: "loading" };
    if (options.paused.value) return;
    if (settle) timer = setTimeout(() => void load(row, id), STEP_SETTLE_MS);
    else void load(row, id);
  }

  watch(
    () => versionOf(options.row.value),
    (version, previous) =>
      start(options.row.value, version !== null && previous !== undefined && previous !== null),
    { immediate: true },
  );

  watch(
    () => options.paused.value,
    (paused) => {
      if (!paused && state.value.status === "loading") start(options.row.value, false);
    },
  );

  function retry() {
    start(options.row.value, false);
  }

  onScopeDispose(() => {
    requestId += 1;
    clearTimeout(timer);
    state.value = IDLE;
  });

  return { state, retry };
}
