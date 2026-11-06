import { computed, ref, shallowRef, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { DRAWER_MIN_HEIGHT, readDrawerState, writeDrawerState } from "@/lib/drawer/drawerPersist";
import { drawerViewIds, type ConsoleMode, type DrawerView } from "@/types/drawer.types";

function maxHeight(): number {
  if (typeof window === "undefined") return 560;
  return Math.max(DRAWER_MIN_HEIGHT, Math.floor(window.innerHeight * 0.7));
}

function clampHeight(height: number): number {
  return Math.min(Math.max(Math.round(height), DRAWER_MIN_HEIGHT), maxHeight());
}

function zeroUnread(): Record<DrawerView, number> {
  return { logs: 0, console: 0 };
}

/**
 * The console drawer joined to the timeline tray: whether it is open, which view it shows, its
 * height, maximised or not, and which views live in their own window. Unread counts new
 * warnings and errors that arrived while their view was out of sight.
 */
export const useDrawerStore = defineStore("drawer", () => {
  const saved = readDrawerState();

  const isOpen = ref(saved.isOpen);
  const view = ref<DrawerView>(saved.view);
  const heightPx = ref(clampHeight(saved.heightPx));
  const maximized = ref(saved.maximized);
  const isFocused = ref(false);
  const consoleMode = ref<ConsoleMode>("stream");
  const poppedOut = shallowRef<ReadonlySet<DrawerView>>(new Set());
  const unread = ref<Record<DrawerView, number>>(zeroUnread());
  /** Moves each time something asks for the Console prompt; the Console view focuses it. */
  const promptRequest = shallowRef(0);

  const docked = computed(() => drawerViewIds.filter((id) => !poppedOut.value.has(id)));
  const currentView = computed<DrawerView>(() =>
    docked.value.includes(view.value) ? view.value : (docked.value[0] ?? view.value),
  );
  const unreadTotal = computed(() => unread.value.logs + unread.value.console);

  function isLooking(target: DrawerView): boolean {
    return poppedOut.value.has(target) || (isOpen.value && currentView.value === target);
  }

  function clearUnread(target: DrawerView) {
    if (unread.value[target] !== 0) unread.value = { ...unread.value, [target]: 0 };
  }

  /** Counts new warnings and errors for `target` unless someone is looking at it. */
  function noteArrivals(target: DrawerView, count: number) {
    if (count <= 0 || isLooking(target)) return;
    unread.value = { ...unread.value, [target]: unread.value[target] + count };
  }

  function close() {
    isOpen.value = false;
    isFocused.value = false;
  }

  /** Opens the drawer, on `target` when given; a popped-out view is focused in its window instead. */
  function open(target?: DrawerView, options: { mode?: ConsoleMode } = {}) {
    if (options.mode) consoleMode.value = options.mode;
    if (target && !poppedOut.value.has(target)) view.value = target;
    if (docked.value.length === 0) return;
    isOpen.value = true;
    clearUnread(currentView.value);
  }

  function toggle(target?: DrawerView) {
    if (isOpen.value && (!target || target === currentView.value)) {
      close();
      return;
    }
    open(target);
  }

  function setView(target: DrawerView) {
    if (poppedOut.value.has(target)) return;
    view.value = target;
    clearUnread(target);
  }

  function setConsoleMode(mode: ConsoleMode) {
    consoleMode.value = mode;
  }

  /** Opens the Console view and puts the caret in its prompt. */
  function openPrompt() {
    open("console", { mode: "stream" });
    promptRequest.value += 1;
  }

  function setHeight(height: number) {
    heightPx.value = clampHeight(height);
    maximized.value = false;
  }

  function resizeBy(delta: number) {
    setHeight(heightPx.value + delta);
  }

  /** Double-click on the edge: the smallest height, or the tallest one when it is small. */
  function toggleHeightPreset() {
    const threshold = DRAWER_MIN_HEIGHT + (maxHeight() - DRAWER_MIN_HEIGHT) / 2;
    setHeight(heightPx.value > threshold ? DRAWER_MIN_HEIGHT : maxHeight());
  }

  function toggleMaximized() {
    maximized.value = !maximized.value;
  }

  function syncToViewport() {
    heightPx.value = clampHeight(heightPx.value);
  }

  function setFocused(focused: boolean) {
    isFocused.value = focused;
  }

  /** Marks `target` as living in its own window (or back in the drawer). */
  function setPoppedOut(target: DrawerView, popped: boolean) {
    const next = new Set(poppedOut.value);
    if (popped) next.add(target);
    else next.delete(target);
    poppedOut.value = next;
    clearUnread(target);
    if (docked.value.length === 0) close();
    else if (!popped) view.value = target;
  }

  /** Brings back views whose window no longer exists. */
  async function reconcilePoppedOut(isWindowOpen: (target: DrawerView) => Promise<boolean>) {
    for (const target of Array.from(poppedOut.value)) {
      if (!(await isWindowOpen(target))) setPoppedOut(target, false);
    }
  }

  watch(
    () => (isOpen.value ? currentView.value : null),
    (shown) => {
      if (shown) clearUnread(shown);
    },
  );

  watch([isOpen, view, heightPx, maximized], () => {
    writeDrawerState({
      isOpen: isOpen.value,
      view: view.value,
      heightPx: heightPx.value,
      maximized: maximized.value,
    });
  });

  return {
    isOpen,
    view,
    currentView,
    docked,
    heightPx,
    maximized,
    isFocused,
    consoleMode,
    poppedOut,
    unread,
    unreadTotal,
    isLooking,
    noteArrivals,
    clearUnread,
    open,
    close,
    toggle,
    setView,
    setConsoleMode,
    promptRequest,
    openPrompt,
    setHeight,
    resizeBy,
    toggleHeightPreset,
    toggleMaximized,
    syncToViewport,
    setFocused,
    setPoppedOut,
    reconcilePoppedOut,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDrawerStore, import.meta.hot));
}
