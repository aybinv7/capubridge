import { computed, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { useMirrorStore } from "@/stores/mirror.store";

const STREAM_HORIZONTAL_PADDING_PX = 16;
const PANEL_MIN_WIDTH_PX = 220;
const PANEL_MAX_WIDTH_PX = 560;

export function useMirrorViewportWidth(streamAreaRef: Ref<HTMLElement | null>) {
  const mirrorStore = useMirrorStore();
  const streamAreaHeight = ref(0);
  let resizeObserver: ResizeObserver | null = null;

  function syncStreamAreaHeight() {
    streamAreaHeight.value = streamAreaRef.value?.clientHeight ?? 0;
  }

  function observeElement(next: HTMLElement | null, prev: HTMLElement | null) {
    if (prev && resizeObserver) {
      resizeObserver.unobserve(prev);
    }

    if (next && resizeObserver) {
      resizeObserver.observe(next);
    }

    syncStreamAreaHeight();
  }

  onMounted(() => {
    syncStreamAreaHeight();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        syncStreamAreaHeight();
      });

      if (streamAreaRef.value) {
        resizeObserver.observe(streamAreaRef.value);
      }
    }

    window.addEventListener("resize", syncStreamAreaHeight);
  });

  onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    window.removeEventListener("resize", syncStreamAreaHeight);
  });

  watch(
    () => streamAreaRef.value,
    (next, prev) => {
      observeElement(next, prev);
    },
    { flush: "post" },
  );

  const fittedPanelWidth = computed(() => {
    if (!streamAreaHeight.value) {
      return mirrorStore.preferredWidth;
    }

    const nextWidth =
      Math.round(streamAreaHeight.value * mirrorStore.aspectRatio) + STREAM_HORIZONTAL_PADDING_PX;

    return Math.min(PANEL_MAX_WIDTH_PX, Math.max(PANEL_MIN_WIDTH_PX, nextWidth));
  });

  const panelWidth = computed(() => Math.max(mirrorStore.preferredWidth, fittedPanelWidth.value));

  return {
    panelWidth,
  };
}
