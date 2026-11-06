<script setup lang="ts">
import { nextTick, ref } from "vue";
import { clearDrawerQuery } from "@/modules/console/public";
import { provideDrawerHost, provideDrawerToolbarSlot } from "@/shared/drawer/toolbarSlot";
import { useDrawerStore } from "@/stores/drawer.store";
import DrawerBody from "./DrawerBody.vue";
import DrawerResizeEdge from "./DrawerResizeEdge.vue";
import DrawerViewSwitch from "./DrawerViewSwitch.vue";
import DrawerWindowActions from "./DrawerWindowActions.vue";

/**
 * The console drawer: one surface that grows out of the timeline tray, with one header row
 * (view switch, the view's own controls, window actions) and one resize edge. `joined` squares
 * its foot onto the strip below it.
 */
const props = defineProps<{ joined: boolean }>();
const emit = defineEmits<{ popout: [view: "logs" | "console"]; requestMainFocus: [] }>();

const drawer = useDrawerStore();
const root = ref<HTMLElement | null>(null);
const toolbarSlot = provideDrawerToolbarSlot();

function bindToolbar(element: unknown) {
  toolbarSlot.value = element instanceof HTMLElement ? element : null;
}
provideDrawerHost("drawer");

function hide() {
  drawer.close();
  emit("requestMainFocus");
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const mod = event.ctrlKey || event.metaKey;
  if (event.key === "Escape") {
    event.preventDefault();
    if (clearDrawerQuery(drawer.currentView)) return;
    drawer.setFocused(false);
    emit("requestMainFocus");
    return;
  }
  if (event.altKey && !mod && /^Digit[1-9]$/.test(event.code)) {
    const view = drawer.docked[Number(event.code.slice(5)) - 1];
    if (view) {
      event.preventDefault();
      drawer.setView(view);
    }
    return;
  }
  if (mod && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    drawer.resizeBy(event.key === "ArrowUp" ? 80 : -80);
  }
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget;
  if (next instanceof Node && root.value?.contains(next)) return;
  drawer.setFocused(false);
}

defineExpose({
  focus() {
    void nextTick(() => {
      const list = root.value?.querySelector<HTMLElement>('[role="listbox"]:not([hidden])');
      (list ?? root.value)?.focus({ preventScroll: true });
    });
  },
});
</script>

<template>
  <section
    ref="root"
    tabindex="-1"
    aria-label="Console drawer"
    class="relative flex flex-col bg-surface-0 shadow-bevel outline-none"
    :class="[
      props.joined ? 'rounded-t-well' : 'rounded-well',
      drawer.maximized ? 'min-h-0 flex-1' : 'shrink-0',
    ]"
    :style="drawer.maximized ? undefined : { height: `${drawer.heightPx}px` }"
    @keydown="onKeydown"
    @focusin="drawer.setFocused(true)"
    @focusout="onFocusOut"
  >
    <DrawerResizeEdge v-if="!drawer.maximized" />
    <header
      class="flex min-h-9 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-subtle px-2 py-1"
    >
      <DrawerViewSwitch />
      <div :ref="bindToolbar" class="flex min-w-0 flex-1 items-center" />
      <DrawerWindowActions @popout="emit('popout', drawer.currentView)" @hide="hide" />
    </header>
    <DrawerBody :views="drawer.docked" :current="drawer.currentView" />
  </section>
</template>
