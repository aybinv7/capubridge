<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import BottomDock from "@/components/dock/BottomDock.vue";
import TimelineStrip from "@/shared/components/timeline/TimelineStrip.vue";
import TitleBar from "./TitleBar.vue";
import Sidebar from "./Sidebar.vue";
import { useRailPeek } from "./useRailPeek";
import CommandPalette from "@/components/command/CommandPalette.vue";
import { useCoreCommands } from "@/app/useCoreCommands";
import { useReloadShortcut } from "@/app/useReloadShortcut";
import { useDataAppCommands } from "@/modules/storage/public";
import { useCommandsStore } from "@/stores/commands.store";
import MirrorPanel from "@/modules/mirror/MirrorPanel.vue";
import { clearDockOpenRequest, dockOpenEventName, readDockOpenRequest } from "@/lib/dock-events";
import { isDockWindowOpen } from "@/lib/dock-windows";
import { useMirrorStore } from "@/stores/mirror.store";
import { useInspectStore } from "@/stores/inspect.store";
import { useDockStore } from "@/stores/dock.store";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useUIStore } from "@/stores/ui.store";
import { restoreSelectedDeviceSerial } from "@/composables/useSessionPersistence";
import { useOverlayGuard } from "@/composables/useOverlayGuard";
import { useActiveContextStore } from "@/stores/activeContext.store";
import type { ADBDevice } from "@/types/adb.types";
import type { DockTab } from "@/types/dock.types";
import { invokeCommand, listenEvent } from "@/runtime/ipc";

const mainContentRef = ref<HTMLElement | null>(null);
const bottomDockRef = ref<InstanceType<typeof BottomDock> | null>(null);
const mirrorStore = useMirrorStore();
const inspectStore = useInspectStore();
const dockStore = useDockStore();
const timelineStrip = useTimelineStripStore();
const devicesStore = useDevicesStore();
const uiStore = useUIStore();
const router = useRouter();
const railPeek = useRailPeek(computed(() => uiStore.railHidden));
const railShown = computed(() => !uiStore.railHidden || railPeek.peeking.value);
useOverlayGuard();
useActiveContextStore();
const commandsStore = useCommandsStore();
useCoreCommands();
useDataAppCommands();
useReloadShortcut();
let unlistenInspectRequest: (() => void) | null = null;
let unlistenInspectHover: (() => void) | null = null;
let unlistenInspectSelect: (() => void) | null = null;
let unlistenInspectLeave: (() => void) | null = null;
let unlistenInspectClose: (() => void) | null = null;
let removeDockOpenListener: (() => void) | null = null;

const showMirrorLeft = computed(
  () => mirrorStore.isOpen && !mirrorStore.isDetached && mirrorStore.side === "left",
);
const showMirrorRight = computed(
  () => mirrorStore.isOpen && !mirrorStore.isDetached && mirrorStore.side === "right",
);

async function syncInspectModeToDetached(enabled: boolean) {
  try {
    const { emitTo } = await import("@tauri-apps/api/event");
    await emitTo("mirror-detached", "capubridge:set-inspect-mode", { enabled });
  } catch (error) {
    console.warn("Failed to synchronize detached inspect mode", error);
  }
}

function focusMainContent() {
  mainContentRef.value?.focus({ preventScroll: true });
}

async function focusDock() {
  await nextTick();
  bottomDockRef.value?.focusDock();
}

function openDock(tab?: DockTab) {
  dockStore.openDock(tab);
  clearDockOpenRequest();
  void focusDock();
}

function handleDockOpenRequest(event: Event) {
  const customEvent = event as CustomEvent<{ tab?: DockTab }>;
  openDock(customEvent.detail?.tab);
}

function onKeydown(event: KeyboardEvent) {
  commandsStore.handleKeydown(event);
}

watch(
  () => dockStore.isOpen,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) void focusDock();
    if (!isOpen && wasOpen) focusMainContent();
  },
);

function onResize() {
  dockStore.syncToViewport();
}

function pickStartupDevice(devices: ADBDevice[]) {
  const savedSerial = restoreSelectedDeviceSerial();
  if (savedSerial) {
    const savedDevice = devices.find((device) => device.serial === savedSerial);
    if (savedDevice) {
      return savedDevice;
    }
  }

  return devices.find((device) => device.status === "online") ?? null;
}

async function bootstrapRuntime() {
  try {
    await devicesStore.refreshDevices();
  } catch (error) {
    console.warn("Failed to refresh devices during app startup", error);
  }

  const startupDevice = pickStartupDevice(devicesStore.devices);
  if (startupDevice) {
    await devicesStore.selectDevice(startupDevice);
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
  window.addEventListener(dockOpenEventName, handleDockOpenRequest as EventListener);
  removeDockOpenListener = () => {
    window.removeEventListener(dockOpenEventName, handleDockOpenRequest as EventListener);
  };

  const pendingDockTab = readDockOpenRequest();
  if (pendingDockTab) {
    openDock(pendingDockTab);
  }

  void bootstrapRuntime();
  dockStore.reconcilePoppedOut(isDockWindowOpen).catch((error: unknown) => {
    console.error("[dock] could not check popped-out windows", error);
  });

  // Best-effort cleanup of any malformed `.capu` files or orphaned `_work` dirs
  // left behind by a previous crashed/buggy recording session.
  void (async () => {
    try {
      await invokeCommand("recording_cleanup_orphans");
    } catch (error) {
      console.warn("Failed to clean orphaned recording files", error);
      // Non-fatal — user can still record
    }
  })();
});

onMounted(async () => {
  try {
    unlistenInspectRequest = await listenEvent("capubridge:open-inspect", async () => {
      await router.push("/inspect/elements");
      inspectStore.inspectMode = true;
    });
    unlistenInspectHover = await listenEvent("capubridge:inspect-hover", (point) => {
      if (!inspectStore.inspectMode) return;
      inspectStore.setMirrorHoverPoint(point.x, point.y);
    });
    unlistenInspectSelect = await listenEvent("capubridge:inspect-select", (point) => {
      if (!inspectStore.inspectMode) return;
      inspectStore.setMirrorSelectPoint(point.x, point.y);
    });
    unlistenInspectLeave = await listenEvent("capubridge:inspect-leave", () => {
      if (!inspectStore.inspectMode) return;
      inspectStore.clearMirrorHoverPoint();
    });
    unlistenInspectClose = await listenEvent("capubridge:close-inspect", () => {
      inspectStore.clearMirrorHoverPoint();
      inspectStore.inspectMode = false;
    });
  } catch (error) {
    console.error("Failed to subscribe to detached inspect events", error);
  }
});

watch(
  () => inspectStore.inspectMode,
  (enabled) => {
    void syncInspectModeToDetached(enabled);
  },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onResize);
  if (removeDockOpenListener) {
    removeDockOpenListener();
    removeDockOpenListener = null;
  }
  if (unlistenInspectRequest) {
    unlistenInspectRequest();
    unlistenInspectRequest = null;
  }
  if (unlistenInspectHover) {
    unlistenInspectHover();
    unlistenInspectHover = null;
  }
  if (unlistenInspectSelect) {
    unlistenInspectSelect();
    unlistenInspectSelect = null;
  }
  if (unlistenInspectLeave) {
    unlistenInspectLeave();
    unlistenInspectLeave = null;
  }
  if (unlistenInspectClose) {
    unlistenInspectClose();
    unlistenInspectClose = null;
  }
});
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-background">
    <TitleBar @open-command-palette="commandsStore.openPalette()" />

    <div class="relative flex min-h-0 flex-1 gap-2 pr-2 pb-2">
      <div
        class="order-first grid shrink-0 transition-[grid-template-columns] duration-300 ease-cladd-spring motion-reduce:transition-none"
        :class="railShown ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'"
        @pointerleave="railPeek.conceal"
        @pointerenter="railPeek.hold"
      >
        <div class="min-w-0 overflow-hidden">
          <Sidebar :inert="railShown ? undefined : true" class="h-full" />
        </div>
      </div>

      <div
        v-if="uiStore.railHidden && !railPeek.peeking.value"
        class="absolute inset-y-0 left-0 z-40 w-2"
        aria-hidden="true"
        @pointerenter="railPeek.reveal"
        @pointerleave="railPeek.hold"
      />

      <div
        class="relative order-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-surface border border-border-subtle bg-surface-0 shadow-bevel"
      >
        <main
          ref="mainContentRef"
          tabindex="-1"
          class="min-h-0 flex-1 overflow-hidden outline-none"
        >
          <RouterView />
        </main>

        <Transition
          enter-active-class="transition-opacity duration-200 ease-cladd-settle"
          leave-active-class="transition-opacity duration-150 ease-in-out"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <BottomDock
            v-if="dockStore.isOpen"
            ref="bottomDockRef"
            @request-main-focus="focusMainContent"
          />
        </Transition>

        <Transition
          enter-active-class="transition-[opacity,translate] duration-300 ease-cladd-settle"
          leave-active-class="transition-[opacity,translate] duration-200 ease-in-out"
          enter-from-class="translate-y-2 opacity-0"
          leave-to-class="translate-y-2 opacity-0"
        >
          <TimelineStrip v-if="!timelineStrip.hidden" />
        </Transition>
      </div>

      <Transition
        enter-active-class="transition-[translate,opacity] duration-500 ease-cladd-settle"
        leave-active-class="transition-[translate,opacity] duration-200 ease-in-out"
        enter-from-class="opacity-0 -translate-x-full"
        leave-to-class="opacity-0 -translate-x-full"
      >
        <MirrorPanel v-if="showMirrorLeft" class="order-1" />
      </Transition>

      <Transition
        enter-active-class="transition-[translate,opacity] duration-500 ease-cladd-settle"
        leave-active-class="transition-[translate,opacity] duration-200 ease-in-out"
        enter-from-class="opacity-0 translate-x-full"
        leave-to-class="opacity-0 translate-x-full"
      >
        <MirrorPanel v-if="showMirrorRight" class="order-3" />
      </Transition>
    </div>
  </div>

  <CommandPalette />
</template>
