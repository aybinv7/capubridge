<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import { Surface, SurfaceCut } from "@capubridge/cladd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const PANE_DEFAULT = 380;
const SETTLE = "cubic-bezier(0, 1, 0.2, 1)";

/**
 * The grid beside its record pane, as every Data tab lays it out. The grid sits in a recessed
 * well (`SurfaceCut`); the record pane is raised one level above the workspace (`Surface +1`).
 * One width for the pane across Data (persisted), 280–960 px, the grid never under 30 %; a
 * double-click on the handle puts the pane back to its default width. `maximized` lets the pane
 * fill the split: it moves (teleported, never remounted) into an overlay that covers the whole
 * split, the grid stays mounted under it (inert), and its edge travels across with Cladd's
 * settle curve.
 */
const props = defineProps<{
  paneOpen: boolean;
  maximized?: boolean;
}>();

defineSlots<{ grid: () => unknown; pane: (props: { maximized: boolean }) => unknown }>();

interface PanelHandle {
  resize: (size: number) => void;
}

const root = ref<HTMLElement | null>(null);
const paneBox = ref<HTMLElement | null>(null);
const overlay = ref<HTMLElement | null>(null);
const overlayId = `record-overlay-${useId()}`;
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
      overlay.value?.animate([{ clipPath: closed }, { clipPath: open }], {
        duration: 500,
        easing: SETTLE,
      });
      return;
    }
    const leaving = overlay.value?.animate([{ clipPath: open }, { clipPath: closed }], {
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
        <div
          class="h-full min-h-0 pb-2 pl-2"
          :class="paneOpen ? '' : 'pr-2'"
          :inert="expanded || undefined"
        >
          <SurfaceCut class="h-full min-h-0 rounded-well" content-class-name="h-full min-h-0">
            <slot name="grid" />
          </SurfaceCut>
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
          <div ref="paneBox" class="h-full min-h-0 pr-2 pb-2">
            <Teleport defer :to="`#${overlayId}`" :disabled="!expanded">
              <Surface
                variant="solid"
                level="+1"
                outline
                class="h-full min-h-0 overflow-hidden rounded-well"
                content-class-name="flex h-full min-h-0 flex-col"
                :data-maximized="expanded || undefined"
              >
                <slot name="pane" :maximized="expanded" />
              </Surface>
            </Teleport>
          </div>
        </ResizablePanel>
      </template>
    </ResizablePanelGroup>
    <div
      :id="overlayId"
      ref="overlay"
      class="absolute inset-0 z-10 flex-col bg-surface-0 px-2 pb-2"
      :class="expanded ? 'flex' : 'hidden'"
    />
  </div>
</template>
