<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import TitleBar from "./TitleBar.vue";
import ConnectionBar from "./ConnectionBar.vue";
import Sidebar from "./Sidebar.vue";
import StatusBar from "./StatusBar.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import MirrorPanel from "@/modules/mirror/MirrorPanel.vue";
import { useMirrorStore } from "@/stores/mirror.store";
import { useInspectStore } from "@/stores/inspect.store";

const commandPaletteOpen = ref(false);
const mirrorStore = useMirrorStore();
const inspectStore = useInspectStore();
const router = useRouter();
let unlistenInspectRequest: (() => void) | null = null;
let unlistenInspectHover: (() => void) | null = null;
let unlistenInspectSelect: (() => void) | null = null;
let unlistenInspectLeave: (() => void) | null = null;
let unlistenInspectClose: (() => void) | null = null;

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
  } catch {}
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    commandPaletteOpen.value = true;
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onMounted(async () => {
  try {
    const { listen } = await import("@tauri-apps/api/event");
    unlistenInspectRequest = await listen("capubridge:open-inspect", async () => {
      await router.push("/inspect/elements");
      inspectStore.inspectMode = true;
    });
    unlistenInspectHover = await listen<{ x: number; y: number }>(
      "capubridge:inspect-hover",
      (event) => {
        if (!inspectStore.inspectMode) return;
        inspectStore.setMirrorHoverPoint(event.payload.x, event.payload.y);
      },
    );
    unlistenInspectSelect = await listen<{ x: number; y: number }>(
      "capubridge:inspect-select",
      (event) => {
        if (!inspectStore.inspectMode) return;
        inspectStore.setMirrorSelectPoint(event.payload.x, event.payload.y);
      },
    );
    unlistenInspectLeave = await listen("capubridge:inspect-leave", () => {
      if (!inspectStore.inspectMode) return;
      inspectStore.clearMirrorHoverPoint();
    });
    unlistenInspectClose = await listen("capubridge:close-inspect", () => {
      inspectStore.clearMirrorHoverPoint();
      inspectStore.inspectMode = false;
    });
  } catch {}
});

watch(
  () => inspectStore.inspectMode,
  (enabled) => {
    void syncInspectModeToDetached(enabled);
  },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
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
  <div class="flex flex-col h-screen overflow-hidden bg-background dark">
    <!-- Title bar with window controls -->
    <TitleBar @open-command-palette="commandPaletteOpen = true" />

    <!-- Main area: [mirror-left?] + sidebar + content + [mirror-right?] -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Mirror panel on left -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 -translate-x-full"
        leave-to-class="opacity-0 -translate-x-full"
      >
        <MirrorPanel v-if="showMirrorLeft" />
      </Transition>

      <!-- Sidebar -->
      <Sidebar />

      <!-- Content column -->
      <div
        class="flex flex-1 flex-col border-t border-l border-border/40 rounded-tl-2xl overflow-hidden bg-surface-1 min-w-0"
      >
        <main class="flex-1 overflow-hidden">
          <RouterView />
        </main>

        <StatusBar />
      </div>

      <!-- Mirror panel on right -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 translate-x-full"
        leave-to-class="opacity-0 translate-x-full"
      >
        <MirrorPanel v-if="showMirrorRight" />
      </Transition>
    </div>
  </div>

  <CommandPalette :open="commandPaletteOpen" @close="commandPaletteOpen = false" />
</template>
