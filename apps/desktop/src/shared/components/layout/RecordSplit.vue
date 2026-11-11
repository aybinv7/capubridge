<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from "vue";
import { Surface, SurfaceCut } from "@capubridge/cladd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const SETTLE = "cubic-bezier(0, 1, 0.2, 1)";

/**
 * A list with its record pane, as every Data tab and Network lays it out: beside the list, or
 * below it (`placement`) for wide tables. The list sits in a recessed well (`SurfaceCut`); the
 * record pane is raised one level above it (`Surface +1`) and scrolls on its own.
 * One persisted pane size per `saveId` and placement (Data shares them), the list never under
 * 30 %; a double-click on the handle puts the pane back to its default size. `maximized` lets the
 * pane fill the split: it moves (teleported, never remounted) into an overlay that covers the
 * whole split, the grid stays mounted under it (inert), and its edge travels across with Cladd's
 * settle curve.
 */
const props = withDefaults(
  defineProps<{
    paneOpen: boolean;
    maximized?: boolean;
    placement?: "side" | "bottom";
    /** Where the pane size persists. */
    saveId?: string;
    /** Prefix of the two panel ids, unique per split on a page. */
    panelPrefix?: string;
    paneDefault?: number;
    paneMin?: number;
    paneMax?: number;
  }>(),
  {
    maximized: false,
    placement: "side",
    saveId: "capubridge:data-record-pane-size:v2",
    panelPrefix: "data-rows",
    paneDefault: 380,
    paneMin: 280,
    paneMax: 960,
  },
);

/** A pane below the list is measured in height, which a window has less of than width. */
const BOTTOM_SIZES = { default: 300, min: 160, max: 720 } as const;

const below = computed(() => props.placement === "bottom");
const sizes = computed(() =>
  below.value
    ? BOTTOM_SIZES
    : { default: props.paneDefault, min: props.paneMin, max: props.paneMax },
);
const groupSaveId = computed(() => (below.value ? `${props.saveId}:bottom` : props.saveId));

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
  const pane = slot.getBoundingClientRect();
  const whole = host.getBoundingClientRect();
  return Math.max(0, below.value ? pane.top - whole.top : pane.left - whole.left);
}

watch(
  () => props.maximized === true,
  async (next) => {
    const offset = paneOffset();
    if (offset === null || reducedMotion()) {
      expanded.value = next;
      return;
    }
    const closed = below.value ? `inset(${offset}px 0 0 0)` : `inset(0 0 0 ${offset}px)`;
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
  panel.value?.resize(sizes.value.default);
}

const SIDE_HANDLE =
  "w-2 bg-transparent before:absolute before:inset-y-4 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring";
const BOTTOM_HANDLE =
  "h-2 w-full cursor-row-resize bg-transparent data-[orientation=vertical]:h-2 before:absolute before:inset-x-4 before:top-1/2 before:h-px before:-translate-y-1/2 before:rounded-full before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring";
</script>

<template>
  <div ref="root" class="relative flex min-h-0 flex-1">
    <ResizablePanelGroup
      :key="props.placement"
      :direction="below ? 'vertical' : 'horizontal'"
      :auto-save-id="groupSaveId"
      class="min-h-0 flex-1"
    >
      <ResizablePanel :id="`${props.panelPrefix}-grid`" :order="1" :min-size="30" class="min-h-0">
        <div
          class="isolate h-full min-h-0"
          :class="[below ? 'px-2' : 'pb-2 pl-2', paneOpen ? '' : below ? 'pb-2' : 'pr-2']"
          :inert="expanded || undefined"
        >
          <SurfaceCut class="h-full min-h-0 rounded-well" content-class-name="h-full min-h-0">
            <slot name="grid" />
          </SurfaceCut>
        </div>
      </ResizablePanel>
      <template v-if="paneOpen">
        <ResizableHandle :class="below ? BOTTOM_HANDLE : SIDE_HANDLE" @dblclick="resetWidth" />
        <ResizablePanel
          :id="`${props.panelPrefix}-pane`"
          ref="panel"
          :order="2"
          size-unit="px"
          :default-size="sizes.default"
          :min-size="sizes.min"
          :max-size="sizes.max"
          class="min-h-0"
        >
          <div ref="paneBox" class="h-full min-h-0 pb-2" :class="below ? 'px-2' : 'pr-2'">
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
      class="absolute inset-0 z-30 flex-col bg-surface-0 px-2 pb-2"
      :class="expanded ? 'flex' : 'hidden'"
    />
  </div>
</template>
