import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";
import { DEFAULT_WEB_VIEWPORT, isWebViewport, type WebViewport } from "@/lib/web-viewport";

const LS_MIRROR_LAYOUT = "capubridge:mirror-layout";
const LS_MIRROR_SETTINGS = "capubridge:mirror-settings";
const LS_WEB_VIEWPORT = "capubridge:web-viewport";
const LS_WEB_PANEL_WIDTH = "capubridge:mirror-web-width";

/** A web preview can take most of the window; the main area keeps at least this much. */
export const WEB_PANEL_MIN_WIDTH = 280;
export const MAIN_AREA_MIN_WIDTH = 420;

function isPanelWidth(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= WEB_PANEL_MIN_WIDTH;
}

type MirrorLayout = { side: MirrorSide; width: number };

function isMirrorLayout(value: unknown): value is MirrorLayout {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.side === "left" || candidate.side === "right") &&
    typeof candidate.width === "number" &&
    candidate.width >= 220 &&
    candidate.width <= 560
  );
}

function isMirrorSettings(value: unknown): value is MirrorSettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    [5, 10, 15, 30].includes(candidate.fps as number) &&
    ["720p", "1080p", "1440p"].includes(candidate.recordQuality as string) &&
    [4, 8, 16, 20].includes(candidate.recordBitrate as number)
  );
}

export type MirrorSide = "left" | "right";

export interface MirrorSettings {
  fps: 5 | 10 | 15 | 30;
  recordQuality: "720p" | "1080p" | "1440p";
  recordBitrate: 4 | 8 | 16 | 20;
}

export const useMirrorStore = defineStore("mirror", () => {
  const savedLayout = readPersisted<MirrorLayout>(
    LS_MIRROR_LAYOUT,
    { side: "right", width: 330 },
    isMirrorLayout,
  );
  const isOpen = ref(false);
  const side = ref<MirrorSide>(savedLayout.side);
  const width = ref(savedLayout.width);
  const preferredWidth = ref(savedLayout.width);
  const isDetached = ref(false);
  const isStreaming = ref(false);
  const isRecording = ref(false);
  const laserMode = ref(false);
  const alwaysOnTop = ref(false);
  const deviceWidth = ref(0);
  const deviceHeight = ref(0);

  const settings = ref<MirrorSettings>(
    readPersisted<MirrorSettings>(
      LS_MIRROR_SETTINGS,
      { fps: 10, recordQuality: "1080p", recordBitrate: 8 },
      isMirrorSettings,
    ),
  );
  const webPanelWidth = ref(readPersisted<number>(LS_WEB_PANEL_WIDTH, 640, isPanelWidth));
  const webViewport = ref<WebViewport>(
    readPersisted<WebViewport>(LS_WEB_VIEWPORT, DEFAULT_WEB_VIEWPORT, isWebViewport),
  );

  watch([side, preferredWidth], ([nextSide, nextWidth]) => {
    writePersisted(LS_MIRROR_LAYOUT, { side: nextSide, width: nextWidth });
  });

  watch(settings, (next) => writePersisted(LS_MIRROR_SETTINGS, next), { deep: true });
  watch(webViewport, (next) => writePersisted(LS_WEB_VIEWPORT, next));
  watch(webPanelWidth, (next) => writePersisted(LS_WEB_PANEL_WIDTH, next));

  const aspectRatio = computed(() =>
    deviceWidth.value && deviceHeight.value ? deviceWidth.value / deviceHeight.value : 9 / 19.5,
  );

  function open() {
    isOpen.value = true;
  }
  function close() {
    isOpen.value = false;
    isStreaming.value = false;
  }
  function toggle() {
    isOpen.value = !isOpen.value;
    if (!isOpen.value) isStreaming.value = false;
  }
  function setSide(s: MirrorSide) {
    side.value = s;
  }
  function setWidth(w: number) {
    const nextWidth = Math.max(220, Math.min(560, w));
    width.value = nextWidth;
    preferredWidth.value = nextWidth;
  }
  function setWebPanelWidth(next: number, maxWidth: number) {
    const ceiling = Math.max(WEB_PANEL_MIN_WIDTH, maxWidth);
    webPanelWidth.value = Math.round(Math.min(ceiling, Math.max(WEB_PANEL_MIN_WIDTH, next)));
  }
  /**
   * Records the size of what the screen shows. A phone stream also re-fits the column to it; a
   * web preview leaves the column at the width the user dragged it to.
   */
  function setDeviceSize(w: number, h: number, fitColumn = true) {
    deviceWidth.value = w;
    deviceHeight.value = h;
    if (fitColumn && h > 0) {
      const idealWidth = Math.round((w / h) * 680);
      const nextPreferredWidth = Math.max(220, Math.min(460, idealWidth));
      preferredWidth.value = nextPreferredWidth;
      width.value = Math.max(width.value, nextPreferredWidth);
    }
  }

  return {
    isOpen,
    side,
    width,
    preferredWidth,
    isDetached,
    isStreaming,
    isRecording,
    laserMode,
    alwaysOnTop,
    deviceWidth,
    deviceHeight,
    settings,
    webViewport,
    webPanelWidth,
    aspectRatio,
    open,
    close,
    toggle,
    setSide,
    setWidth,
    setDeviceSize,
    setWebPanelWidth,
  };
});
