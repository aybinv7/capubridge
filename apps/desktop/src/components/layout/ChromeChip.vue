<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Globe, Loader2, Play, XCircle, Link } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useSourceStore } from "@/stores/source.store";

const sourceStore = useSourceStore();

function saveChromePort(port: number) {
  localStorage.setItem("capubridge:chrome-port", String(port));
}

function restoreChromePort(): number | null {
  const saved = localStorage.getItem("capubridge:chrome-port");
  if (!saved) return null;
  const port = parseInt(saved, 10);
  return isNaN(port) ? null : port;
}

const portInput = ref(9223);
const showPortInput = ref(false);
const autoConnectAttempted = ref(false);

async function tryAutoConnect() {
  if (autoConnectAttempted.value || sourceStore.hasChromeSource) return;
  autoConnectAttempted.value = true;

  const savedPort = restoreChromePort();
  if (savedPort) portInput.value = savedPort;

  const result = await sourceStore.autoConnectChrome();

  if (result === "connected") {
    toast.success("Chrome connected", {
      description: `Port ${sourceStore.getChromeSource()?.port}`,
    });
    return;
  }

  if (savedPort && savedPort !== portInput.value) {
    const ok = await sourceStore.connectChrome(savedPort);
    if (ok) {
      toast.success("Chrome reconnected", { description: `Port ${savedPort}` });
    }
  }
}

async function handleLaunch() {
  const ok = await sourceStore.launchChrome();
  if (ok) {
    toast.success("Chrome launched", {
      description: `Debug port ${sourceStore.getChromeSource()?.port}`,
    });
  } else {
    toast.error("Failed to launch Chrome", {
      description: sourceStore.chromeError ?? "Unknown error",
    });
  }
}

async function handleConnect() {
  const ok = await sourceStore.connectChrome(portInput.value);
  if (ok) {
    saveChromePort(portInput.value);
    showPortInput.value = false;
    toast.success("Connected to Chrome", { description: `Port ${portInput.value}` });
  } else {
    toast.error("Connection failed", {
      description: sourceStore.chromeError ?? "Unknown error",
    });
  }
}

async function handleDisconnect() {
  await sourceStore.disconnectChrome();
  toast.info("Chrome disconnected");
}

onMounted(() => {
  tryAutoConnect().catch(() => {});
});
</script>

<template>
  <!-- Connected -->
  <button
    v-if="sourceStore.hasChromeSource"
    @click="handleDisconnect"
    class="group flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border/30 bg-surface-2 hover:border-border/50 hover:bg-surface-3 transition-colors"
    style="-webkit-app-region: no-drag"
    title="Disconnect Chrome"
  >
    <span class="w-1.5 h-1.5 rounded-full bg-status-success shrink-0" />
    <Globe :size="10" class="text-muted-foreground/50 shrink-0" />
    <span class="text-[11px] text-foreground/70">Local</span>
    <span class="font-mono text-[9px] text-muted-foreground/35"
      >:{{ sourceStore.getChromeSource()?.port }}</span
    >
    <XCircle
      :size="10"
      class="text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors"
    />
  </button>

  <!-- Checking -->
  <div
    v-else-if="sourceStore.chromeStatus === 'checking'"
    class="flex items-center gap-1.5 h-7 px-2.5 text-[11px] text-muted-foreground/35"
    style="-webkit-app-region: no-drag"
  >
    <Loader2 :size="10" class="animate-spin shrink-0" />
    <span>Checking…</span>
  </div>

  <!-- Idle / launch -->
  <div v-else class="flex items-center gap-1" style="-webkit-app-region: no-drag">
    <button
      class="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border/30 bg-surface-2 hover:border-border/50 hover:bg-surface-3 transition-colors text-[11px] text-muted-foreground/45 hover:text-foreground/70 disabled:opacity-40"
      :disabled="sourceStore.chromeStatus === 'launching'"
      @click="handleLaunch"
    >
      <Loader2
        v-if="sourceStore.chromeStatus === 'launching'"
        :size="10"
        class="animate-spin shrink-0"
      />
      <Play v-else :size="10" class="shrink-0" />
      <Globe :size="10" class="shrink-0" />
      <span>Local</span>
    </button>

    <button
      class="h-5 px-1 text-[10px] text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors"
      @click="showPortInput = !showPortInput"
      title="Connect to custom port"
    >
      <Link :size="9" />
    </button>

    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      leave-active-class="transition-all duration-100 ease-in"
      enter-from-class="opacity-0 -translate-x-2"
      leave-to-class="opacity-0 -translate-x-2"
    >
      <div v-if="showPortInput" class="flex items-center gap-1">
        <input
          v-model.number="portInput"
          type="number"
          class="w-14 h-6 text-[11px] px-1.5 bg-surface-2 border border-border/30 rounded-md font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
          placeholder="9223"
          @keydown.enter="handleConnect"
        />
        <button
          class="h-6 px-2 rounded-md bg-surface-2 border border-border/30 text-[11px] text-foreground/60 hover:bg-surface-3 hover:text-foreground transition-colors disabled:opacity-50"
          :disabled="sourceStore.chromeStatus === 'launching'"
          @click="handleConnect"
        >
          Connect
        </button>
      </div>
    </Transition>
  </div>
</template>
