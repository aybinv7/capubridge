<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { useDrawerStore } from "@/stores/drawer.store";

const STEP = 24;
const BIG_STEP = 80;

/**
 * The drawer's one resize edge, along its top. Drag it (height applied once per frame), use
 * ↑/↓ while it has focus (Shift for bigger steps), or double-click it to jump between the
 * smallest and tallest height.
 */
const drawer = useDrawerStore();
let frame = 0;
let pending: number | null = null;
let stopDrag: (() => void) | null = null;

function apply() {
  frame = 0;
  if (pending !== null) drawer.setHeight(pending);
  pending = null;
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  const startY = event.clientY;
  const startHeight = drawer.heightPx;
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  const previousSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";

  const onMove = (move: PointerEvent) => {
    pending = startHeight + (startY - move.clientY);
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const onUp = () => {
    stopDrag?.();
    if (frame) cancelAnimationFrame(frame);
    apply();
  };
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointercancel", onUp);
  stopDrag = () => {
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", onUp);
    target.removeEventListener("pointercancel", onUp);
    document.body.style.userSelect = previousSelect;
    stopDrag = null;
  };
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  const step = event.shiftKey ? BIG_STEP : STEP;
  drawer.resizeBy(event.key === "ArrowUp" ? step : -step);
}

onBeforeUnmount(() => {
  stopDrag?.();
  if (frame) cancelAnimationFrame(frame);
});
</script>

<template>
  <div
    class="group absolute inset-x-6 -top-1 z-10 flex h-2 cursor-row-resize items-center justify-center outline-none"
    role="separator"
    aria-orientation="horizontal"
    aria-label="Resize the console"
    :aria-valuenow="drawer.heightPx"
    tabindex="0"
    @pointerdown="onPointerDown"
    @dblclick="drawer.toggleHeightPreset()"
    @keydown="onKeydown"
  >
    <span
      class="h-0.5 w-10 rounded-full bg-border-default opacity-0 transition-opacity duration-120 group-hover:opacity-100 group-focus-visible:bg-signal-select group-focus-visible:opacity-100"
      aria-hidden="true"
    />
  </div>
</template>
