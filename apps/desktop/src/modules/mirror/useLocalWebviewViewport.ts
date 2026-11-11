import type { Ref } from "vue";
import { useCDP } from "@/composables/useCDP";
import { resolveViewport, type ViewportArea } from "@/lib/web-viewport";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useMirrorStore } from "@/stores/mirror.store";
import type { CDPTarget } from "@/types/cdp.types";
import { fitDeviceFrame } from "./deviceFrame";

/**
 * Emulates the chosen device, custom size or Responsive in the local preview. The page is laid out
 * at the emulated size and scaled down to the screen drawn for it, the way Chrome's device mode
 * zooms; Responsive is the frame's own size, so it shows at 100%.
 *
 * The scale comes from the area and the emulated size, not from measuring the drawn screen: right
 * after a switch the screen still has the previous device's size, and measuring it laid the page
 * out with the old scale.
 *
 * While `keepMouse` (an element picker may be on: ours, or DevTools' own), the mouse stays a mouse
 * even on a phone size: emulated touch has no hover, so the page would never see the pointer and
 * no picker could highlight what it is over. Chrome's device mode makes the same trade.
 */
export function useLocalWebviewViewport(
  target: Readonly<Ref<CDPTarget | null>>,
  area: Readonly<Ref<ViewportArea | null>>,
  keepMouse: Readonly<Ref<boolean>>,
) {
  const mirrorStore = useMirrorStore();
  const localWebviewStore = useLocalWebviewStore();
  const { connectToTarget } = useCDP();
  let applySequence = 0;

  function isLocal(candidate: CDPTarget | null): candidate is CDPTarget {
    return candidate?.source === "local";
  }

  function metricsNow() {
    return resolveViewport(mirrorStore.webViewport, area.value);
  }

  function syncSize() {
    if (!isLocal(target.value)) return;
    const metrics = metricsNow();
    mirrorStore.setDeviceSize(metrics.width, metrics.height, false);
  }

  function scaleFor(width: number, height: number): number {
    const room = area.value;
    if (!room) return 1;
    const fitted = fitDeviceFrame({
      areaWidth: room.width,
      areaHeight: room.height,
      deviceWidth: width,
      deviceHeight: height,
      bare: true,
    });
    return fitted.screenWidth > 0 ? Math.min(1, fitted.screenWidth / width) : 1;
  }

  async function apply() {
    const current = target.value;
    if (!isLocal(current)) return;
    const sequence = ++applySequence;
    try {
      const ready = await localWebviewStore.ensureCdpTarget(current);
      if (!ready.webSocketDebuggerUrl || sequence !== applySequence) return;
      const client = await connectToTarget(ready);
      if (sequence !== applySequence) return;
      const metrics = metricsNow();
      const results = await Promise.allSettled([
        client.send("Emulation.setDeviceMetricsOverride", {
          width: metrics.width,
          height: metrics.height,
          deviceScaleFactor: metrics.dpr,
          mobile: metrics.mobile,
          scale: scaleFor(metrics.width, metrics.height),
        }),
        client.send("Emulation.setTouchEmulationEnabled", {
          enabled: metrics.mobile,
          maxTouchPoints: metrics.mobile ? 1 : 0,
        }),
        client.send("Emulation.setEmitTouchEventsForMouse", {
          enabled: metrics.mobile && !keepMouse.value,
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
