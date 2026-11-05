import { computed, ref, watch, type Ref } from "vue";
import { useElementSize } from "@vueuse/core";
import {
  clampOffset,
  fitScale,
  wheelFactor,
  zoomAt,
  zoomStep,
  type Point,
  type Size,
  type ZoomState,
} from "./zoomMath";

/**
 * Zoom and pan for one image in a viewport: fit by default, 100% on demand, wheel zoom around the
 * cursor, drag to pan. While in fit mode the image refits as the window resizes.
 */
export function useImageZoom(viewport: Ref<HTMLElement | null>, natural: Ref<Size | null>) {
  const { width, height } = useElementSize(viewport);
  const fitted = ref(true);
  const view = ref<ZoomState>({ scale: 1, x: 0, y: 0 });
  const dragging = ref(false);
  let dragFrom: Point | null = null;

  const viewportSize = computed<Size>(() => ({ width: width.value, height: height.value }));
  const fit = computed(() => (natural.value ? fitScale(natural.value, viewportSize.value) : 1));
  const isActual = computed(() => !fitted.value && Math.abs(view.value.scale - 1) < 0.0001);
  const canPan = computed(() => {
    const image = natural.value;
    if (!image) return false;
    return (
      image.width * view.value.scale > viewportSize.value.width + 1 ||
      image.height * view.value.scale > viewportSize.value.height + 1
    );
  });

  watch(
    [fit, fitted],
    () => {
      if (fitted.value) view.value = { scale: fit.value, x: 0, y: 0 };
      else if (natural.value)
        view.value = clampOffset(view.value, natural.value, viewportSize.value);
    },
    { immediate: true },
  );

  function centredPoint(event: MouseEvent): Point {
    const rect = viewport.value?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    };
  }

  function apply(factor: number, point: Point) {
    if (!natural.value) return;
    fitted.value = false;
    view.value = zoomAt(view.value, factor, point, natural.value, viewportSize.value);
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    apply(wheelFactor(event.deltaY, event.deltaMode, event.ctrlKey), centredPoint(event));
  }

  function zoomBy(direction: 1 | -1) {
    apply(zoomStep(view.value.scale, direction) / view.value.scale, { x: 0, y: 0 });
  }

  function showFit() {
    fitted.value = true;
  }

  function showActual(point: Point = { x: 0, y: 0 }) {
    apply(1 / view.value.scale, point);
  }

  function toggleActual(event?: MouseEvent) {
    if (isActual.value) showFit();
    else showActual(event ? centredPoint(event) : undefined);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !canPan.value) return;
    dragging.value = true;
    dragFrom = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging.value || !dragFrom || !natural.value) return;
    const next = {
      scale: view.value.scale,
      x: view.value.x + event.clientX - dragFrom.x,
      y: view.value.y + event.clientY - dragFrom.y,
    };
    dragFrom = { x: event.clientX, y: event.clientY };
    view.value = clampOffset(next, natural.value, viewportSize.value);
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragging.value) return;
    dragging.value = false;
    dragFrom = null;
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture(event.pointerId);
  }

  return {
    view,
    fitted,
    isActual,
    canPan,
    dragging,
    onWheel,
    zoomBy,
    showFit,
    toggleActual,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
