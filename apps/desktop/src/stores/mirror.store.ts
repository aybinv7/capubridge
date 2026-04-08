import { ref, computed } from "vue";
import { defineStore } from "pinia";

export type MirrorSide = "left" | "right";

export interface MirrorSettings {
  fps: 5 | 10 | 15 | 30;
  recordQuality: "720p" | "1080p" | "1440p";
  recordBitrate: 4 | 8 | 16 | 20;
}

export const useMirrorStore = defineStore("mirror", () => {
  const isOpen = ref(false);
  const side = ref<MirrorSide>("right");
  const width = ref(272);
  const isDetached = ref(false);
  const isStreaming = ref(false);
  const isRecording = ref(false);
  const laserMode = ref(false);
  const alwaysOnTop = ref(false);
  const deviceWidth = ref(0);
  const deviceHeight = ref(0);

  const settings = ref<MirrorSettings>({
    fps: 10,
    recordQuality: "1080p",
    recordBitrate: 8,
  });

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
    width.value = Math.max(200, Math.min(480, w));
  }
  function setDeviceSize(w: number, h: number) {
    deviceWidth.value = w;
    deviceHeight.value = h;
    // Compute ideal width to fit a 9/19 phone frame, capped sensibly
    if (h > 0) {
      const idealWidth = Math.round((w / h) * 520);
      width.value = Math.max(220, Math.min(400, idealWidth));
    }
  }

  return {
    isOpen,
    side,
    width,
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
