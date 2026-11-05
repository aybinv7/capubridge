import { nextTick, type Ref } from "vue";
import { useCDP } from "@/composables/useCDP";
import { resolveViewport } from "@/lib/web-viewport";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useMirrorStore } from "@/stores/mirror.store";
import type { CDPTarget } from "@/types/cdp.types";

/**
 * Emulates the chosen device or free size in the local preview. The native preview fills the
 * drawn screen, so the page is laid out at the emulated size and scaled down to fit it, the way
 * Chrome's device mode zooms.
 */
export function useLocalWebviewViewport(
  target: Readonly<Ref<CDPTarget | null>>,
  screen: Readonly<Ref<HTMLElement | null>>,
) {
  const mirrorStore = useMirrorStore();
  const localWebviewStore = useLocalWebviewStore();
  const { connectToTarget } = useCDP();
  let applySequence = 0;

  function isLocal(candidate: CDPTarget | null): candidate is CDPTarget {
    return candidate?.source === "local";
  }

  function syncSize() {
    if (!isLocal(target.value)) return;
    const metrics = resolveViewport(mirrorStore.webViewport);
    mirrorStore.setDeviceSize(metrics.width, metrics.height, false);
  }

  async function apply() {
    const current = target.value;
    if (!isLocal(current)) return;
    const sequence = ++applySequence;
    try {
      const ready = await localWebviewStore.ensureCdpTarget(current);
      if (!ready.webSocketDebuggerUrl || sequence !== applySequence) return;
      const client = await connectToTarget(ready);
      await nextTick();
      const element = screen.value;
      if (!element || sequence !== applySequence) return;
      const metrics = resolveViewport(mirrorStore.webViewport);
      const rect = element.getBoundingClientRect();
      const scale = rect.width > 0 ? Math.min(1, rect.width / metrics.width) : 1;
      const results = await Promise.allSettled([
        client.send("Emulation.setDeviceMetricsOverride", {
          width: metrics.width,
          height: metrics.height,
          deviceScaleFactor: metrics.dpr,
          mobile: metrics.mobile,
          scale,
        }),
        client.send("Emulation.setTouchEmulationEnabled", {
          enabled: metrics.mobile,
          maxTouchPoints: metrics.mobile ? 1 : 0,
        }),
        client.send("Emulation.setEmitTouchEventsForMouse", {
          enabled: metrics.mobile,
          configuration: metrics.mobile ? "mobile" : "desktop",
        }),
      ]);
      for (const result of results) {
        if (result.status === "rejected") {
          console.warn("Local preview emulation step failed", result.reason);
        }
      }
    } catch (error) {
      console.warn("Local preview emulation skipped: DevTools unavailable", error);
    }
  }

  async function syncAndApply() {
    syncSize();
    await apply();
  }

  return { syncSize, apply, syncAndApply };
}
