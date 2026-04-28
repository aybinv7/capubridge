<script setup lang="ts">
import { Zap, CheckCircle2, XCircle, RefreshCw, Loader2, Puzzle, Code2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AppCapacitorInfo } from "@/types/app-inspector.types";

defineProps<{
  info: AppCapacitorInfo | null;
  isLoading: boolean;
}>();

const emit = defineEmits<{ refresh: [] }>();

function pluginShortName(name: string): string {
  return (
    name
      .split(".")
      .filter((s) => s.toLowerCase() !== "plugin" && s.toLowerCase() !== "capacitor")
      .pop() ?? name
  );
}

const KNOWN_PLUGINS: Record<string, { label: string; desc: string }> = {
  Camera: { label: "Camera", desc: "Photo/video capture" },
  Filesystem: { label: "Filesystem", desc: "File system access" },
  Geolocation: { label: "Geolocation", desc: "GPS & location" },
  PushNotifications: { label: "Push", desc: "Push notifications" },
  LocalNotifications: { label: "Local Notifications", desc: "Scheduled alerts" },
  Haptics: { label: "Haptics", desc: "Vibration feedback" },
  StatusBar: { label: "Status Bar", desc: "UI status bar control" },
  SplashScreen: { label: "Splash Screen", desc: "App launch screen" },
  Browser: { label: "Browser", desc: "In-app web browser" },
  App: { label: "App", desc: "App lifecycle events" },
  Network: { label: "Network", desc: "Network connectivity" },
  Preferences: { label: "Preferences", desc: "Key-value storage" },
  Keyboard: { label: "Keyboard", desc: "Software keyboard" },
  Dialog: { label: "Dialog", desc: "Native dialogs" },
  Device: { label: "Device", desc: "Device hardware info" },
  Share: { label: "Share", desc: "Native share sheet" },
  Clipboard: { label: "Clipboard", desc: "Clipboard access" },
  Toast: { label: "Toast", desc: "Native toast messages" },
  BarcodeScanner: { label: "Barcode Scanner", desc: "QR/barcode scanning" },
  FirebasePush: { label: "Firebase Push", desc: "Firebase messaging" },
};

function enrichPlugin(raw: string) {
  const short = pluginShortName(raw);
  const known = KNOWN_PLUGINS[short];
  return {
    raw,
    short,
    label: known?.label ?? short,
    desc: known?.desc ?? null,
  };
}
</script>

<template>
  <div class="p-4 space-y-5">
    <div class="flex items-center justify-between">
      <div class="text-xs font-medium text-foreground/60">Capacitor detection</div>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 px-2 text-[11px]"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        <Loader2 v-if="isLoading" class="h-3 w-3 animate-spin" />
        <RefreshCw v-else class="h-3 w-3" />
      </Button>
    </div>

    <div v-if="isLoading && !info" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-xl bg-muted/20" />
    </div>

    <div
      v-else-if="!info && !isLoading"
      class="flex flex-col items-center justify-center gap-2 py-10"
    >
      <Zap class="h-8 w-8 text-muted-foreground/15" />
      <div class="text-xs text-muted-foreground/35">Detection will run automatically</div>
    </div>

    <template v-else-if="info">
      <div
        class="rounded-xl border px-4 py-4"
        :class="
          info.isCapacitor ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-border/20 bg-surface-2'
        "
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            :class="info.isCapacitor ? 'bg-cyan-500/15' : 'bg-muted/20'"
          >
            <Zap
              class="h-5 w-5"
              :class="info.isCapacitor ? 'text-cyan-400' : 'text-muted-foreground/30'"
            />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span
                class="text-sm font-semibold"
                :class="info.isCapacitor ? 'text-cyan-300' : 'text-foreground/50'"
              >
                {{ info.isCapacitor ? "Capacitor App" : "Not a Capacitor App" }}
              </span>
              <CheckCircle2 v-if="info.isCapacitor" class="h-4 w-4 text-cyan-400" />
              <XCircle v-else class="h-4 w-4 text-muted-foreground/25" />
            </div>
            <div class="mt-0.5 text-[10px] text-muted-foreground/40">
              {{ info.isCapacitor ? "Hybrid WebView bridge detected" : "Native Android app" }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="info.bridgeActivity" class="space-y-1.5">
        <div class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/35">
          Bridge Activity
        </div>
        <div class="rounded-lg border border-border/20 bg-surface-2 px-3 py-2.5">
          <div class="flex items-center gap-2">
            <Code2 class="h-3.5 w-3.5 shrink-0 text-cyan-400/60" />
            <span class="break-all font-mono text-[11px] text-foreground/70">
              {{ info.bridgeActivity }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="info.version"
        class="flex items-center justify-between rounded-lg border border-border/20 bg-surface-2 px-3 py-2.5"
      >
        <span class="text-xs text-muted-foreground/50">Capacitor version</span>
        <Badge variant="outline" class="font-mono text-[11px] border-cyan-500/20 text-cyan-400/80">
          v{{ info.version }}
        </Badge>
      </div>

      <Separator v-if="info.isCapacitor" class="opacity-20" />

      <div v-if="info.isCapacitor" class="space-y-2">
        <div class="flex items-center justify-between">
          <div
            class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/35"
          >
            <Puzzle class="h-3 w-3" />
            Detected plugins
            <span class="rounded-full bg-muted/20 px-1.5 py-0.5 text-[9px]">{{
              info.plugins.length
            }}</span>
          </div>
        </div>

        <div
          v-if="info.plugins.length === 0"
          class="rounded-lg border border-border/15 bg-surface-2 px-3 py-4 text-center"
        >
          <div class="text-[10px] text-muted-foreground/30">
            No plugins detected from package manifest.
          </div>
          <div class="mt-1 text-[10px] text-muted-foreground/20">
            Plugin detection requires debug builds or rooted devices for full accuracy.
          </div>
        </div>

        <div v-else class="space-y-1">
          <div
            v-for="plugin in info.plugins.map(enrichPlugin)"
            :key="plugin.raw"
            class="flex items-center gap-2.5 rounded-lg border border-border/15 bg-surface-2 px-3 py-2"
          >
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-500/10"
            >
              <Puzzle class="h-3 w-3 text-cyan-400/60" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] font-medium text-foreground/75">{{ plugin.label }}</div>
              <div v-if="plugin.desc" class="text-[10px] text-muted-foreground/40">
                {{ plugin.desc }}
              </div>
              <div v-else class="truncate font-mono text-[9px] text-muted-foreground/30">
                {{ plugin.raw }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="!info.isCapacitor"
        class="rounded-xl border border-border/15 bg-surface-2 px-4 py-5 text-center"
      >
        <div class="text-[10px] leading-relaxed text-muted-foreground/35">
          This app does not appear to use Capacitor. Capacitor is detected by the presence of
          <span class="font-mono text-muted-foreground/50">BridgeActivity</span> or
          <span class="font-mono text-muted-foreground/50">com.getcapacitor</span>
          in the package manifest.
        </div>
      </div>
    </template>
  </div>
</template>
