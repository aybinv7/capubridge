import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";

const LS_MIRROR_LAYOUT = "capubridge:mirror-layout";
const LS_MIRROR_SETTINGS = "capubridge:mirror-settings";

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
    [4, 8, 16, 20].includes(candidate.recordBitrate as number) &&
    ["phone", "desktop"].includes(candidate.chromeViewportMode as string)
  );
}

export type MirrorSide = "left" | "right";

export interface MirrorSettings {
  fps: 5 | 10 | 15 | 30;
  recordQuality: "720p" | "1080p" | "1440p";
  recordBitrate: 4 | 8 | 16 | 20;
  chromeViewportMode: "phone" | "desktop";
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
      { fps: 10, recordQuality: "1080p", recordBitrate: 8, chromeViewportMode: "phone" },
      isMirrorSettings,
    ),
  );

  watch([side, preferredWidth], ([nextSide, nextWidth]) => {
    writePersisted(LS_MIRROR_LAYOUT, { side: nextSide, width: nextWidth });
  });

  watch(settings, (next) => writePersisted(LS_MIRROR_SETTINGS, next), { deep: true });

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
  function setDeviceSize(w: number, h: number) {
    deviceWidth.value = w;
    deviceHeight.value = h;
    if (h > 0) {
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
    aspectRatio,
    open,
    close,
    toggle,
    setSide,
    setWidth,
    setDeviceSize,
  };
});
