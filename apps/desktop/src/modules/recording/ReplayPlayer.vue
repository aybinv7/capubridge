<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Replayer } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import type { RrwebCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  events: RrwebCapuEvent[];
  targetUrl?: string | null;
  inspectActive?: boolean;
}>();

const emit = defineEmits<{
  /** Raw iframe Element — panel extracts data itself */
  inspectSelect: [el: Element];
}>();

const containerRef = ref<HTMLElement | null>(null);
let replayer: Replayer | null = null;
let resizeObs: ResizeObserver | null = null;

// Current scale state — updated by applyScale, read by inspect hit-test
let scaleState = { scale: 1, tx: 0, ty: 0, fw: 0, fh: 0 };

function applyScale(container: HTMLElement, wrapper: HTMLElement) {
  const cw = container.offsetWidth;
  const ch = container.offsetHeight;
  const rw = wrapper.offsetWidth;
  const rh = wrapper.offsetHeight;
  if (!cw || !ch || !rw || !rh) return;
  const scale = Math.min(cw / rw, ch / rh);
  const tx = Math.round((cw - rw * scale) / 2);
  const ty = Math.round((ch - rh * scale) / 2);
  scaleState = { scale, tx, ty, fw: rw, fh: rh };
  wrapper.style.position = "absolute";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.transformOrigin = "0 0";
  wrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

// ── Iframe access ─────────────────────────────────────────────────────────────
function getIframe(): HTMLIFrameElement | undefined {
  return (replayer as unknown as { iframe?: HTMLIFrameElement }).iframe;
}

// ── Base tag injection ────────────────────────────────────────────────────────
function injectBaseTag() {
  if (!props.targetUrl || !replayer) return;
  try {
    const doc = getIframe()?.contentDocument;
    if (!doc?.head) return;
    const origin = new URL(props.targetUrl).origin;
    doc.querySelectorAll("base").forEach((b) => b.remove());
    const base = doc.createElement("base");
    base.href = origin + "/";
    doc.head.prepend(base);
  } catch {
    /* URL parse / sandbox — ignore */
  }
}

// ── Inspect overlay ────────────────────────────────────────────────────────────
interface InspectHit {
  x: number;
  y: number;
  w: number;
  h: number;
  tag: string;
  id: string;
  cls: string;
}
const hit = ref<InspectHit | null>(null);
const mouseContainerPos = ref({ x: 0, y: 0 });

function iframeCoords(e: MouseEvent): { ix: number; iy: number } | null {
  const container = containerRef.value;
  if (!container) return null;
  const cr = container.getBoundingClientRect();
  const lx = e.clientX - cr.left;
  const ly = e.clientY - cr.top;
  mouseContainerPos.value = { x: lx, y: ly };
  const { scale, tx, ty, fw, fh } = scaleState;
  const ix = (lx - tx) / scale;
  const iy = (ly - ty) / scale;
  if (ix < 0 || iy < 0 || ix > fw || iy > fh) return null;
  return { ix, iy };
}

function onInspectMove(e: MouseEvent) {
  if (!props.inspectActive || !replayer) return;
  const coords = iframeCoords(e);
  if (!coords) {
    hit.value = null;
    return;
  }

  const doc = getIframe()?.contentDocument;
  if (!doc) {
    hit.value = null;
    return;
  }

  const el = doc.elementFromPoint(coords.ix, coords.iy) as HTMLElement | null;
  if (!el || el === doc.documentElement || el === doc.body) {
    hit.value = null;
    return;
  }

  const { scale, tx, ty } = scaleState;
  const r = el.getBoundingClientRect();
  hit.value = {
    x: r.left * scale + tx,
    y: r.top * scale + ty,
    w: r.width * scale,
    h: r.height * scale,
    tag: el.tagName.toLowerCase(),
    id: el.id ?? "",
    cls: (typeof el.className === "string" ? el.className : "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(" "),
  };
}

function onInspectLeave() {
  hit.value = null;
}

function onInspectClick(e: MouseEvent) {
  if (!props.inspectActive || !replayer) return;
  const coords = iframeCoords(e);
  if (!coords) return;

  const doc = getIframe()?.contentDocument;
  if (!doc) return;

  const el = doc.elementFromPoint(coords.ix, coords.iy) as HTMLElement | null;
  if (!el || el === doc.documentElement || el === doc.body) return;

  emit("inspectSelect", el);
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(() => {
  if (!containerRef.value || props.events.length === 0) return;

  const rawEvents = props.events.map((e) => e.data) as eventWithTime[];

  replayer = new Replayer(rawEvents, {
    root: containerRef.value,
    skipInactive: true,
    speed: 1,
    mouseTail: false,
    showWarning: false,
    showDebug: false,
  } as any);

  replayer.on("fullsnapshot-reconstructed", () => setTimeout(injectBaseTag, 0));
  replayer.pause(0);
  setTimeout(injectBaseTag, 100);

  const wrapper = containerRef.value.querySelector(".replayer-wrapper") as HTMLElement | null;
  if (!wrapper) return;

  applyScale(containerRef.value, wrapper);
  resizeObs = new ResizeObserver(() => applyScale(containerRef.value!, wrapper));
  resizeObs.observe(containerRef.value);
});

onUnmounted(() => {
  resizeObs?.disconnect();
  resizeObs = null;
  replayer?.destroy();
  replayer = null;
});

function seekTo(ms: number) {
  replayer?.pause(ms);
}
function play(fromMs?: number) {
  if (fromMs !== undefined) {
    replayer?.play(fromMs);
  } else {
    replayer?.play();
  }
}
function pause(atMs?: number) {
  replayer?.pause(atMs);
}
function getIframeDoc(): Document | null {
  return getIframe()?.contentDocument ?? null;
}

defineExpose({ seekTo, play, pause, getIframeDoc });
</script>

<template>
  <div class="relative w-full h-full overflow-hidden bg-black rounded-md">
    <div ref="containerRef" class="absolute inset-0" />

    <!-- Inspect overlay — absorbs mouse events when active -->
    <div
      v-if="inspectActive"
      class="absolute inset-0 z-10 cursor-crosshair"
      @mousemove="onInspectMove"
      @mouseleave="onInspectLeave"
      @click="onInspectClick"
    >
      <!-- Element highlight box -->
      <div
        v-if="hit"
        class="absolute pointer-events-none border-2 border-sky-400 bg-sky-400/10"
        :style="{
          left: hit.x + 'px',
          top: hit.y + 'px',
          width: hit.w + 'px',
          height: hit.h + 'px',
        }"
      />

      <!-- Info badge — follows mouse -->
      <div
        v-if="hit"
        class="absolute pointer-events-none z-20 max-w-[280px] rounded-md bg-background/95 border border-border/40 shadow-lg px-2 py-1.5 text-[11px] leading-snug"
        :style="{
          left: Math.min(mouseContainerPos.x + 12, 9999) + 'px',
          top: Math.min(mouseContainerPos.y + 12, 9999) + 'px',
        }"
      >
        <span class="font-mono font-semibold text-sky-400">{{ hit.tag }}</span>
        <span v-if="hit.id" class="font-mono text-violet-400">#{{ hit.id }}</span>
        <span v-if="hit.cls" class="font-mono text-muted-foreground/70 ml-0.5"
          >.{{ hit.cls.replace(/\s+/g, ".") }}</span
        >
        <div class="text-[10px] text-muted-foreground/50 mt-0.5">
          {{ Math.round(hit.w / scaleState.scale) }} × {{ Math.round(hit.h / scaleState.scale) }} px
        </div>
      </div>

      <!-- Inspect mode badge -->
      <div
        class="absolute top-2 left-2 rounded px-1.5 py-0.5 bg-sky-500/90 text-white text-[10px] font-semibold tracking-wide pointer-events-none"
      >
        INSPECT
      </div>
    </div>

    <div
      v-if="events.length === 0"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40"
    >
      <p class="text-sm">No DOM events recorded</p>
      <p class="text-[11px]">Enable the DOM replay track when recording</p>
    </div>
  </div>
</template>
