import { watch, type Ref } from "vue";
import type { CDPClient } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { useMirrorStore } from "@/stores/mirror.store";
import type { CDPTarget } from "@/types/cdp.types";

interface PageViewport {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

const VIEWPORT_EXPRESSION = `JSON.stringify({
  width: window.visualViewport?.width ?? window.innerWidth,
  height: window.visualViewport?.height ?? window.innerHeight,
  offsetX: window.visualViewport?.offsetLeft ?? 0,
  offsetY: window.visualViewport?.offsetTop ?? 0
})`;

function readViewport(value: unknown): PageViewport | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const viewport = {
      width: Number(parsed.width) || 0,
      height: Number(parsed.height) || 0,
      offsetX: Number(parsed.offsetX) || 0,
      offsetY: Number(parsed.offsetY) || 0,
    };
    return viewport.width > 0 && viewport.height > 0 ? viewport : null;
  } catch {
    return null;
  }
}

/**
 * A phone has no mouse, so a page on it never hovers, and DevTools' element picker, which
 * highlights what the pointer is over, shows nothing on the screen. While `enabled`, the pointer
 * over the mirrored screen is sent to the page as mouse moves, mapped from the screen to the page
 * the way the Elements picker maps it (the WebView filling the screen). At most one move per frame,
 * and none while the last one is still unanswered.
 */
export function usePageHoverForwarding(
  target: Readonly<Ref<CDPTarget | null>>,
  enabled: Readonly<Ref<boolean>>,
) {
  const mirrorStore = useMirrorStore();
  const { getClient } = useCDP();

  let viewport: PageViewport | null = null;
  let pending: { x: number; y: number } | null = null;
  let frame = 0;
  let inFlight = false;

  function client(): CDPClient | null {
    const current = target.value;
    return current ? (getClient(current.id) ?? null) : null;
  }

  async function ensureViewport(cdp: CDPClient): Promise<PageViewport | null> {
    if (viewport) return viewport;
    const result = await cdp.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
      expression: VIEWPORT_EXPRESSION,
      returnByValue: true,
    });
    viewport = readViewport(result.result.value);
    return viewport;
  }

  function toPage(x: number, y: number, page: PageViewport) {
    const width = mirrorStore.deviceWidth || page.width;
    const height = mirrorStore.deviceHeight || page.height;
    return {
      x: Math.round(page.offsetX + Math.max(0, Math.min(1, x / width)) * (page.width - 1)),
      y: Math.round(page.offsetY + Math.max(0, Math.min(1, y / height)) * (page.height - 1)),
    };
  }

  async function send() {
    frame = 0;
    const point = pending;
    pending = null;
    const cdp = client();
    if (!point || !cdp || inFlight || !enabled.value) return;
    inFlight = true;
    try {
      const page = await ensureViewport(cdp);
      if (!page) return;
      const at = toPage(point.x, point.y, page);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
    } catch (error) {
      console.warn("Could not pass the pointer to the page", error);
    } finally {
      inFlight = false;
    }
  }

  function move(x: number, y: number) {
    if (!enabled.value) return;
    pending = { x, y };
    if (frame === 0) frame = requestAnimationFrame(() => void send());
  }

  watch(
    () => [target.value?.id ?? null, mirrorStore.deviceWidth, mirrorStore.deviceHeight] as const,
    () => {
      viewport = null;
    },
  );

  watch(enabled, (on) => {
    if (on) return;
    pending = null;
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  });

  return { move };
}
