<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  Circle,
  ChevronDown,
  Smartphone,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
  ScreenShare,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import DeviceManagerModal from "@/components/DeviceManagerModal.vue";
import { Search } from "lucide-vue-next";
import { useDevicesStore } from "@/stores/devices.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useSourceStore } from "@/stores/source.store";
import { useCDP } from "@/composables/useCDP";
import { useSessionPersistence } from "@/composables/useSessionPersistence";
import TargetSelector from "./TargetSelector.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const isMaximized = ref(false);
const emit = defineEmits<{ openCommandPalette: [] }>();

const clock = ref("");
const deviceModalOpen = ref(false);
const sourceMode = ref<"device" | "chrome">("device");
const chromePortInput = ref(9223);
const showManualInput = ref(false);
const showRelaunchDialog = ref(false);
const autoConnectAttempted = ref(false);

const devicesStore = useDevicesStore();
const { refreshTargets } = useCDP();
const sourceStore = useSourceStore();
const mirrorStore = useMirrorStore();

const mirrorEnabled = computed(() => devicesStore.selectedDevice?.status === "online");

// Persistence — reads/writes localStorage, auto-selects restored device & target
const { restoreSourceMode, saveChromePort, restoreChromePort } = useSessionPersistence(sourceMode);

const activeDeviceLabel = computed(() => {
  const d = devicesStore.selectedDevice;
  if (!d) return { model: "No device", id: "" };
  return { model: d.model, id: d.serial };
});

const deviceStatusColor = computed(() => {
  const d = devicesStore.selectedDevice;
  if (!d) return "bg-muted-foreground/30";
  if (d.status === "online") return "bg-status-success";
  return "bg-status-warning";
});

function onSelectDeviceFromModal(serial: string) {
  const device = devicesStore.devices.find((d) => d.serial === serial);
  if (device) {
    devicesStore.selectDevice(device);
  }
}

function switchToChrome() {
  sourceMode.value = "chrome";
}

function switchToDevice() {
  sourceMode.value = "device";
}

async function handleChromeLaunch() {
  const success = await sourceStore.launchChrome();
  if (success) {
    toast.success("Chrome launched", {
      description: `Debug port: ${sourceStore.getChromeSource()?.port}`,
    });
  } else {
    toast.error("Failed to launch Chrome", {
      description: sourceStore.chromeError ?? "Unknown error",
    });
  }
}

async function handleChromeRelaunch() {
  showRelaunchDialog.value = false;
  const success = await sourceStore.launchChrome();
  if (success) {
    toast.success("Chrome relaunched", {
      description: "All Chrome windows were closed and a new debug instance was started.",
    });
  } else {
    toast.error("Failed to relaunch Chrome", {
      description: sourceStore.chromeError ?? "Unknown error",
    });
  }
}

async function handleChromeConnect() {
  const success = await sourceStore.connectChrome(chromePortInput.value);
  if (success) {
    saveChromePort(chromePortInput.value);
    toast.success("Connected to Chrome", {
      description: `Port: ${chromePortInput.value}`,
    });
  } else {
    toast.error("Failed to connect", {
      description: sourceStore.chromeError ?? "Unknown error",
    });
  }
}

async function handleChromeDisconnect() {
  await sourceStore.disconnectChrome();
  toast.info("Chrome disconnected");
}

// autoLaunch = true when restoring session: launch automatically if not found
async function tryAutoConnect(autoLaunch = false) {
  if (autoConnectAttempted.value || sourceStore.hasChromeSource) return;
  autoConnectAttempted.value = true;

  // Try the standard auto-connect first (checks CHROME_CDP_PORT)
  const result = await sourceStore.autoConnectChrome();

  if (result === "connected") {
    toast.success("Chrome connected", {
      description: `Found existing debug instance on port ${sourceStore.getChromeSource()?.port}`,
    });
    return;
  }

  // If not found on default port, try the last-used port from session
  const savedPort = restoreChromePort();
  if (savedPort && savedPort !== chromePortInput.value) {
    chromePortInput.value = savedPort;
    const reconnected = await sourceStore.connectChrome(savedPort);
    if (reconnected) {
      toast.success("Chrome reconnected", { description: `Port: ${savedPort}` });
      return;
    }
  }

  if (result === "needs_relaunch") {
    if (autoLaunch) {
      await handleChromeRelaunch();
    } else {
      showRelaunchDialog.value = true;
    }
  } else {
    // "not_found"
    if (autoLaunch) {
      await handleChromeLaunch();
    } else {
      toast.info("No Chrome debug instance found", {
        description: "Click Launch to start Chrome in debug mode.",
      });
    }
  }
}

watch(
  () => sourceMode.value,
  (mode) => {
    if (mode === "chrome") {
      tryAutoConnect();
    }
  },
);

let timer: ReturnType<typeof setInterval>;
let appWindow: any = null;

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    appWindow = getCurrentWebviewWindow();
    isMaximized.value = await appWindow.isMaximized();
    appWindow.onResized(async () => {
      isMaximized.value = await appWindow.isMaximized();
    });
  } catch {
    appWindow = null;
  }

  // Restore persisted session
  const savedMode = restoreSourceMode();
  const savedPort = restoreChromePort();
  if (savedPort) chromePortInput.value = savedPort;
  sourceMode.value = savedMode;
  if (savedMode === "chrome") {
    // Auto-connect and auto-launch if needed — fire-and-forget, errors handled inside
    tryAutoConnect(/* autoLaunch */ true).catch(() => {});
  }
});

async function minimize() {
  await appWindow?.minimize();
}

async function toggleMaximize() {
  if (!appWindow) return;
  if (isMaximized.value) {
    await appWindow.unmaximize();
    isMaximized.value = false;
  } else {
    await appWindow.maximize();
    isMaximized.value = true;
  }
}

async function close() {
  await appWindow?.close();
}

onMounted(() => {
  updateClock();
  timer = setInterval(updateClock, 1000);
});
onUnmounted(() => clearInterval(timer));

function updateClock() {
  const now = new Date();
  clock.value = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
</script>

<template>
  <div class="h-12 shrink-0 flex items-center select-none" style="-webkit-app-region: drag">
    <!-- Source type toggle -->
    <div
      class="flex items-center ml-2 bg-surface-2 border border-border/30 rounded-full p-0.5 gap-0.5"
      style="-webkit-app-region: no-drag"
    >
      <button
        @click="switchToDevice"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors"
        :class="
          sourceMode === 'device'
            ? 'bg-surface-3 text-foreground shadow-sm'
            : 'text-muted-foreground/60 hover:text-foreground/80'
        "
      >
        <Smartphone :size="11" />
        <span class="text-[11px]">Device</span>
      </button>
      <button
        @click="switchToChrome"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors"
        :class="
          sourceMode === 'chrome'
            ? 'bg-surface-3 text-foreground shadow-sm'
            : 'text-muted-foreground/60 hover:text-foreground/80'
        "
      >
        <Globe :size="11" />
        <span class="text-[11px]">Chrome</span>
      </button>
    </div>

    <!-- Device selector (when in device mode) -->
    <button
      v-if="sourceMode === 'device'"
      @click="deviceModalOpen = true"
      class="flex items-center gap-2 text-xs surface-interactive rounded-full ml-2 px-3 py-1.5 transition-colors border border-border/30 hover:border-border/50"
      style="-webkit-app-region: no-drag"
    >
      <Circle class="w-1.5 h-1.5" :class="deviceStatusColor" />
      <span class="font-medium text-foreground">{{ activeDeviceLabel.model }}</span>
      <span v-if="activeDeviceLabel.id" class="text-muted-foreground/50 font-mono text-2xs">{{
        activeDeviceLabel.id.slice(0, 8)
      }}</span>
      <ChevronDown class="w-3 h-3 text-muted-foreground/50" />
    </button>

    <!-- Chrome controls (when in chrome mode) -->
    <div v-else class="flex items-center gap-2 ml-2" style="-webkit-app-region: no-drag">
      <!-- Connected state -->
      <template v-if="sourceStore.hasChromeSource">
        <button
          class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border/30 bg-surface-2 transition-colors hover:border-border/50"
          @click="handleChromeDisconnect"
        >
          <Circle class="w-1.5 h-1.5 fill-status-success text-status-success" />
          <span class="text-foreground text-[11px]">Chrome</span>
          <span class="text-muted-foreground/50 font-mono text-2xs"
            >:{{ sourceStore.getChromeSource()?.port }}</span
          >
          <XCircle :size="12" class="text-muted-foreground/40 hover:text-foreground" />
        </button>
      </template>

      <!-- Checking state -->
      <template v-else-if="sourceStore.chromeStatus === 'checking'">
        <div class="flex items-center gap-1.5 text-xs px-3 py-1.5 text-muted-foreground/60">
          <Loader2 :size="11" class="animate-spin" />
          <span class="text-[11px]">Checking for Chrome…</span>
        </div>
      </template>

      <!-- Idle / error state -->
      <template v-else>
        <div class="flex items-center gap-1.5">
          <button
            class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border/30 bg-surface-2 transition-colors hover:border-border/50 disabled:opacity-50"
            @click="handleChromeLaunch"
            :disabled="sourceStore.chromeStatus === 'launching'"
          >
            <Loader2
              v-if="sourceStore.chromeStatus === 'launching'"
              :size="11"
              class="animate-spin"
            />
            <Play v-else :size="11" />
            <span class="text-[11px]">Launch Chrome</span>
          </button>

          <button
            class="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors px-1"
            @click="showManualInput = !showManualInput"
          >
            {{ showManualInput ? "hide" : "manual" }}
          </button>
        </div>

        <div v-if="showManualInput" class="flex items-center gap-1">
          <input
            v-model.number="chromePortInput"
            type="number"
            class="w-14 h-6 text-[11px] px-1.5 bg-surface-2 border border-border/30 rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="9223"
          />
          <button
            class="flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2 border border-border/30 text-[11px] text-foreground hover:bg-surface-3 transition-colors disabled:opacity-50"
            @click="handleChromeConnect"
            :disabled="sourceStore.chromeStatus === 'launching'"
          >
            <Loader2
              v-if="sourceStore.chromeStatus === 'launching'"
              :size="10"
              class="animate-spin"
            />
            Connect
          </button>
        </div>
      </template>
    </div>

    <!-- Target selector -->
    <div class="flex items-center gap-1 ml-3" style="-webkit-app-region: no-drag">
      <TargetSelector />
    </div>

    <!-- Mirror toggle -->
    <button
      class="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full text-xs transition-all border"
      :class="
        mirrorStore.isOpen
          ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
          : mirrorEnabled
            ? 'border-border/30 text-muted-foreground/60 hover:text-foreground hover:border-border/50 hover:bg-accent'
            : 'border-border/20 text-muted-foreground/25 cursor-not-allowed'
      "
      :disabled="!mirrorEnabled"
      style="-webkit-app-region: no-drag"
      :title="
        !mirrorEnabled
          ? 'Connect a device to enable mirroring'
          : mirrorStore.isOpen
            ? 'Stop mirroring'
            : 'Mirror device screen'
      "
      @click="mirrorEnabled && mirrorStore.toggle()"
    >
      <ScreenShare class="w-3.5 h-3.5" />
      <span class="text-[11px]">Mirror</span>
      <span
        v-if="mirrorStore.isOpen && mirrorStore.isStreaming"
        class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
      />
    </button>

    <div class="flex-1" />

    <!-- Center: search bar -->
    <button
      class="flex items-center gap-2.5 px-4 py-1 bg-surface-2 border border-border/30 rounded-full min-w-[320px] surface-interactive hover:border-border/50 hover:bg-surface-3 transition-colors"
      style="-webkit-app-region: no-drag"
      @click="emit('openCommandPalette')"
    >
      <Search class="w-4 h-4 text-muted-foreground/40" />
      <span class="text-sm text-muted-foreground/50 flex-1 text-left">Search…</span>
      <kbd
        class="text-[10px] text-muted-foreground/40 bg-surface-3 border border-border/30 px-2 py-0.5 rounded-lg font-mono"
        >⌘+K</kbd
      >
    </button>

    <div class="flex-1" />

    <!-- Window controls -->
    <div class="flex items-center" style="-webkit-app-region: no-drag">
      <button
        class="w-11 h-9 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-surface-2 transition-colors"
        @click="minimize"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>
      <button
        class="w-11 h-9 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-surface-2 transition-colors"
        @click="toggleMaximize"
      >
        <Maximize2 v-if="!isMaximized" class="w-3 h-3" />
        <Minimize2 v-else class="w-3 h-3" />
      </button>
      <button
        class="w-11 h-9 flex items-center justify-center text-muted-foreground/50 hover:text-[#981515] hover:bg-[#981515]/10 transition-colors"
        @click="close"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Relaunch Dialog -->
    <Dialog v-model:open="showRelaunchDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chrome is already running</DialogTitle>
          <DialogDescription>
            Capubridge needs to launch Chrome in debug mode. This will close all your current Chrome
            windows and open a new instance with debugging enabled.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="flex gap-2 sm:justify-end">
          <Button variant="outline" @click="showRelaunchDialog = false"> Cancel </Button>
          <Button variant="destructive" @click="handleChromeRelaunch">
            <Loader2
              v-if="sourceStore.chromeStatus === 'launching'"
              :size="14"
              class="animate-spin mr-1"
            />
            Close & Relaunch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <DeviceManagerModal
      :open="deviceModalOpen"
      @close="deviceModalOpen = false"
      @select-device="onSelectDeviceFromModal"
    />
  </div>
</template>
