import { computed, onUnmounted, watch } from "vue";
import { useSqliteFilesStore } from "@/modules/storage/stores/useSqliteFilesStore";
import { useSqliteUnsavedStore } from "@/modules/storage/stores/useSqliteUnsavedStore";
import { closeWindowQuestion } from "./sqliteUnsavedQuestion";

/**
 * Asks before the window closes while SQLite edits are staged or an opened file's changes are
 * not written to it. The close request is only listened to while there is something to lose,
 * so a normal close is never touched; the question is the system's own dialog, since the
 * window is going away.
 */
export function useSqliteCloseGuard(): void {
  const unsaved = useSqliteUnsavedStore();
  const files = useSqliteFilesStore();
  const question = computed(() =>
    closeWindowQuestion(
      unsaved.total,
      files.files.filter((file) => file.unsaved).map((file) => file.original),
    ),
  );
  let stop: (() => void) | null = null;
  let generation = 0;

  async function listen() {
    const mine = ++generation;
    try {
      const [{ getCurrentWindow }, { ask }] = await Promise.all([
        import("@tauri-apps/api/window"),
        import("@tauri-apps/plugin-dialog"),
      ]);
      const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        const asked = question.value;
        if (!asked) return;
        let close: boolean;
        try {
          close = await ask(asked.text, {
            title: asked.title,
            kind: "warning",
            okLabel: asked.confirmLabel,
            cancelLabel: "Keep it open",
          });
        } catch (error) {
          console.error("[sqlite] could not ask before closing", error);
          close = true;
        }
        if (close) unsaved.discardAll();
        else event.preventDefault();
      });
      if (mine === generation) stop = unlisten;
      else unlisten();
    } catch (error) {
      console.error("[sqlite] could not watch the window close", error);
    }
  }

  function forget() {
    generation += 1;
    stop?.();
    stop = null;
  }

  watch(
    () => question.value !== null,
    (needed) => (needed ? void listen() : forget()),
    { immediate: true },
  );
  onUnmounted(forget);
}
