import { watch, type Ref } from "vue";

/**
 * Runs an action that needs the list on screen (a delete asked for from the sidebar before the
 * list was opened): at once when the list is read, once the read settles when it is still being
 * read, and never when the read fails, calling `onFailed` instead. A newer action replaces one
 * still waiting.
 */
export function useWhenRead(pending: Ref<boolean>, error: Ref<unknown>, onFailed: () => void) {
  let queued: (() => void) | null = null;

  watch([pending, error], ([isPending, failure]) => {
    if (!queued) return;
    if (!isPending) {
      const task = queued;
      queued = null;
      task();
    } else if (failure) {
      queued = null;
      onFailed();
    }
  });

  function run(task: () => void) {
    if (!pending.value) task();
    else if (error.value) onFailed();
    else queued = task;
  }

  return { run };
}
