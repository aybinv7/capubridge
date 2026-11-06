<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const PANE_DEFAULT = 380;
const SETTLE = "cubic-bezier(0, 1, 0.2, 1)";

/**
 * The grid beside its record pane, as every Data tab lays it out: one width for the pane
 * across Data (persisted), 280–960 px, the grid never under 30 %. A double-click on the handle
 * puts the pane back to its default width. `maximized` lets the pane fill the split: the grid
 * stays mounted under it (inert), and the pane's edge travels across with Cladd's settle curve.
 */
const props = defineProps<{
  paneOpen: boolean;
  maximized?: boolean;
}>();

interface PanelHandle {
  resize: (size: number) => void;
}

const root = ref<HTMLElement | null>(null);
const paneBox = ref<HTMLElement | null>(null);
const panel = ref<PanelHandle | null>(null);
const expanded = ref(props.maximized === true);

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Resolves when the animation ends, whether it finished or was cancelled by a newer one. */
function settled(animation: Animation): Promise<void> {
  return new Promise((done) => {
    animation.onfinish = () => done();
    animation.oncancel = () => done();
  });
}

function paneOffset(): number | null {
  const box = paneBox.value;
  const host = root.value;
  const slot = box?.parentElement;
  if (!box || !host || !slot) return null;
  return Math.max(0, slot.getBoundingClientRect().left - host.getBoundingClientRect().left);
}

watch(
  () => props.maximized === true,
  async (next) => {
    const offset = paneOffset();
    if (offset === null || reducedMotion()) {
      expanded.value = next;
      return;
    }
    const closed = `inset(0 0 0 ${offset}px)`;
    const open = "inset(0 0 0 0px)";
    if (next) {
      expanded.value = true;
      await nextTick();
      paneBox.value?.animate([{ clipPath: closed }, { clipPath: open }], {
        duration: 500,
        easing: SETTLE,
      });
      return;
    }
    const leaving = paneBox.value?.animate([{ clipPath: open }, { clipPath: closed }], {
      duration: 200,
      easing: "ease-in-out",
    });
    if (leaving) await settled(leaving);
    expanded.value = props.maximized === true;
  },
);

function resetWidth() {
  panel.value?.resize(PANE_DEFAULT);
}
</script>

<template>
  <div ref="root" class="relative flex min-h-0 flex-1">
    <ResizablePanelGroup
      direction="horizontal"
      auto-save-id="capubridge:data-record-pane-size:v2"
      class="min-h-0 flex-1"
    >
      <ResizablePanel id="data-rows-grid" :order="1" :min-size="30" class="min-h-0">
        <div class="h-full min-h-0" :inert="expanded || undefined">
          <slot name="grid" />
        </div>
      </ResizablePanel>
      <template v-if="paneOpen">
        <ResizableHandle
          class="w-2 bg-transparent before:absolute before:inset-y-4 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring"
          @dblclick="resetWidth"
        />
        <ResizablePanel
          id="data-rows-pane"
          ref="panel"
          :order="2"
          size-unit="px"
          :default-size="PANE_DEFAULT"
          :min-size="280"
          :max-size="960"
          class="min-h-0"
        >
          <div
            ref="paneBox"
            class="h-full min-h-0"
            :class="expanded ? 'absolute inset-0 z-10' : ''"
            :data-maximized="expanded || undefined"
          >
            <slot name="pane" :maximized="expanded" />
          </div>
        </ResizablePanel>
      </template>
    </ResizablePanelGroup>
  </div>
</template>
