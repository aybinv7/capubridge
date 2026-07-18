import { computed, ref } from "vue";
import type { MirrorSource } from "./mirrorTypes";

interface MirrorStoreState {
  isStreaming: boolean;
  isRecording: boolean;
}

export function createMirrorStreamState(store: MirrorStoreState) {
  const useScrcpyCanvas = ref(false);
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  const canvasElement = ref<HTMLCanvasElement | null>(null);
  const streamSource = ref<MirrorSource | null>(null);
  const isAndroidStream = computed(() => streamSource.value === "adb");

  function prepareStart() {
    error.value = null;
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    streamSource.value = null;
    store.isStreaming = false;
  }

  function selectSource(source: MirrorSource) {
    streamSource.value = source;
  }

  function markConnected() {
    useScrcpyCanvas.value = true;
    isConnected.value = true;
    store.isStreaming = true;
  }

  function markDisconnected(options: { reason?: string | null; clearRecording?: boolean } = {}) {
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    streamSource.value = null;
    store.isStreaming = false;
    if (options.clearRecording) store.isRecording = false;
    if (options.reason !== undefined) error.value = options.reason;
  }

  function setCanvasElement(element: HTMLCanvasElement | null) {
    canvasElement.value = element;
  }

  return {
    useScrcpyCanvas,
    isConnected,
    error,
    canvasElement,
    streamSource,
    isAndroidStream,
    prepareStart,
    selectSource,
    markConnected,
    markDisconnected,
    setCanvasElement,
  };
}
