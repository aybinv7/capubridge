import { watch, onUnmounted, type Ref } from "vue";
import { useLocalWebviewStore } from "@/stores/localWebview.store";

export function useModalGuard(open: Ref<boolean>): void {
  const store = useLocalWebviewStore();
  let held = false;

  function acquire() {
    if (held) return;
    held = true;
    store.acquireModalGuard();
  }

  function release() {
    if (!held) return;
    held = false;
    store.releaseModalGuard();
  }

  watch(
    open,
    (isOpen) => {
      if (isOpen) acquire();
      else release();
    },
    { immediate: true },
  );

  onUnmounted(release);
}
