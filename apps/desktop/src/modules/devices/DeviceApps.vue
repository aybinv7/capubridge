<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  LayoutGrid,
  List,
  StopCircle,
  Trash2,
  X,
  RefreshCw,
  AlertCircle,
  Loader2,
  Package,
  HardDrive,
  Eraser,
} from "lucide-vue-next";
import { useQuery } from "@tanstack/vue-query";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useDevicesStore } from "@/stores/devices.store";
import { useAdb } from "@/composables/useAdb";
import type { AdbPackage } from "@/types/adb.types";
import AppIcon from "./AppIcon.vue";
import { toast } from "vue-sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const devicesStore = useDevicesStore();
const { listPackages } = useAdb();

const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");

const {
  data: packages,
  isLoading,
  isError,
  error,
  refetch,
} = useQuery({
  queryKey: computed(() => ["packages", serial.value]),
  queryFn: () => listPackages(serial.value),
  enabled: computed(() => !!serial.value),
  staleTime: 60_000,
});

const appsView = ref<"grid" | "table">("grid");
const appsSearch = ref("");
const selectedApp = ref<AdbPackage | null>(null);

// Segments too generic to be meaningful as display names
const GENERIC_SEGMENTS = new Set([
  "android",
  "app",
  "application",
  "mobile",
  "phone",
  "tablet",
  "wear",
  "auto",
  "tv",
  "launcher",
  "client",
  "main",
  "core",
  "lite",
  "pro",
]);

function displayName(pkg: string): string {
  const parts = pkg.split(".").filter((p) => p.length > 0);
  // Walk backward to find a meaningful segment
  let segment = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const s = parts[i]!;
    if (!GENERIC_SEGMENTS.has(s.toLowerCase()) || i === 0) {
      segment = s;
      break;
    }
  }
  if (!segment) segment = parts[parts.length - 1] ?? pkg;
  // Split on underscores, camelCase boundaries, and digit transitions
  segment = segment.replace(/_/g, " ");
  segment = segment.replace(/([a-zA-Z])(\d)/g, "$1 $2");
  segment = segment.replace(/([a-z])([A-Z])/g, "$1 $2");
  return segment
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Short domain like "com.twitter" or "io.ionic"
function pkgDomain(pkg: string): string {
  const parts = pkg.split(".");
  return parts.slice(0, Math.min(2, parts.length - 1)).join(".");
}

const filteredApps = computed(() => {
  if (!packages.value) return [];
  const q = appsSearch.value.toLowerCase().trim();
  if (!q) return packages.value;
  return packages.value.filter((p) => p.packageName.toLowerCase().includes(q));
});

// --- App actions ---
type DialogAction = "forceStop" | "clearData" | "uninstall" | null;
const pendingAction = ref<DialogAction>(null);
const isActing = ref(false);

const confirmDialogConfig = computed(() => {
  const app = selectedApp.value;
  if (!app) return null;
  const name = displayName(app.packageName);
  if (pendingAction.value === "forceStop") {
    return {
      title: `Force Stop "${name}"?`,
      description: "This will kill all running processes for this app.",
      confirmText: "Force Stop",
      variant: "default" as const,
    };
  }
  if (pendingAction.value === "clearData") {
    return {
      title: `Clear Data for "${name}"?`,
      description:
        "This will permanently delete all app data, cache, and settings. The app will be reset to a fresh install state.",
      confirmText: "Clear Data",
      variant: "destructive" as const,
    };
  }
  if (pendingAction.value === "uninstall") {
    return {
      title: `Uninstall "${name}"?`,
      description: "This will permanently remove the app and all its data from the device.",
      confirmText: "Uninstall",
      variant: "destructive" as const,
    };
  }
  return null;
});

function promptAction(app: AdbPackage, action: DialogAction) {
  selectedApp.value = app;
  pendingAction.value = action;
}

async function executeAction() {
  const app = selectedApp.value;
  const action = pendingAction.value;
  if (!app || !action || !serial.value) return;

  const name = displayName(app.packageName);
  pendingAction.value = null;
  isActing.value = true;

  try {
    let shellCmd = "";
    if (action === "forceStop") shellCmd = `am force-stop ${app.packageName}`;
    else if (action === "clearData") shellCmd = `pm clear ${app.packageName}`;
    else if (action === "uninstall") shellCmd = `pm uninstall ${app.packageName}`;

    const result = await invoke<string>("adb_shell_command", {
      serial: serial.value,
      command: shellCmd,
    });

    if (action === "uninstall") {
      if (result.toLowerCase().includes("success")) {
        toast.success(`"${name}" uninstalled`);
        selectedApp.value = null;
        refetch();
      } else {
        toast.error(`Uninstall failed: ${result.trim()}`);
      }
    } else if (action === "clearData") {
      if (result.toLowerCase().includes("success")) {
        toast.success(`Data cleared for "${name}"`);
      } else {
        toast.error(`Clear data failed: ${result.trim()}`);
      }
    } else {
      toast.success(`"${name}" force stopped`);
    }
  } catch (err) {
    toast.error(`Action failed: ${err}`);
  } finally {
    isActing.value = false;
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="h-11 shrink-0 border-b border-border/30 bg-surface-2 flex items-center px-4 gap-3">
      <div class="flex items-center gap-2 max-w-xs flex-1">
        <Search class="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        <Input
          v-model="appsSearch"
          class="h-7 text-xs bg-transparent border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground/30"
          placeholder="Filter packages…"
        />
      </div>

      <div class="w-px h-4 bg-border/30" />

      <span v-if="packages" class="text-[11px] text-muted-foreground/40 tabular-nums shrink-0">
        {{ filteredApps.length
        }}<span v-if="appsSearch" class="text-muted-foreground/25">/{{ packages.length }}</span>
        apps
      </span>

      <div class="flex-1" />

      <Button
        variant="ghost"
        size="icon-sm"
        class="w-7 h-7 text-muted-foreground/40 hover:text-muted-foreground"
        :disabled="isLoading"
        @click="refetch"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="isLoading ? 'animate-spin' : ''" />
      </Button>

      <div class="flex gap-0.5 p-0.5 rounded-md bg-surface-3 border border-border/20">
        <button
          class="w-6 h-6 rounded flex items-center justify-center transition-colors"
          :class="
            appsView === 'grid'
              ? 'bg-surface-2 text-foreground shadow-sm'
              : 'text-muted-foreground/40 hover:text-muted-foreground/70'
          "
          @click="appsView = 'grid'"
        >
          <LayoutGrid class="w-3 h-3" />
        </button>
        <button
          class="w-6 h-6 rounded flex items-center justify-center transition-colors"
          :class="
            appsView === 'table'
              ? 'bg-surface-2 text-foreground shadow-sm'
              : 'text-muted-foreground/40 hover:text-muted-foreground/70'
          "
          @click="appsView = 'table'"
        >
          <List class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground/40"
    >
      <Loader2 class="w-4 h-4 animate-spin" />
      Loading packages…
    </div>

    <!-- Error state -->
    <div v-else-if="isError" class="flex-1 flex items-center justify-center p-8">
      <div
        class="max-w-sm w-full flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
      >
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="font-medium">Failed to load packages</div>
          <div class="mt-0.5 font-mono text-[10px] text-red-400/60 truncate">{{ error }}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="text-red-400 hover:text-red-300 h-7 px-2 shrink-0"
          @click="refetch"
        >
          Retry
        </Button>
      </div>
    </div>

    <!-- No device -->
    <div
      v-else-if="!serial"
      class="flex-1 flex items-center justify-center text-muted-foreground/25 text-sm"
    >
      No device selected
    </div>

    <!-- Content -->
    <ResizablePanelGroup v-else direction="horizontal" class="flex-1 min-h-0">
      <ResizablePanel :default-size="selectedApp ? 72 : 100" :min-size="55">
        <!-- Grid view -->
        <div v-if="appsView === 'grid'" class="h-full overflow-y-auto">
          <div
            v-if="filteredApps.length === 0"
            class="flex items-center justify-center h-32 text-muted-foreground/25 text-sm"
          >
            No packages match
          </div>
          <div
            v-else
            class="grid gap-px bg-border/20 p-0"
            style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))"
          >
            <button
              v-for="app in filteredApps"
              :key="app.packageName"
              class="group flex flex-col items-center gap-3 p-5 bg-surface-1 transition-all text-left relative"
              :class="
                selectedApp?.packageName === app.packageName
                  ? 'bg-surface-3 ring-1 ring-inset ring-border/40 z-10'
                  : 'hover:bg-surface-2'
              "
              @click="selectedApp = selectedApp?.packageName === app.packageName ? null : app"
            >
              <!-- Selected indicator -->
              <div
                v-if="selectedApp?.packageName === app.packageName"
                class="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary"
              />

              <AppIcon
                :serial="serial"
                :apk-path="app.apkPath"
                :package-name="app.packageName"
                size="md"
              />

              <div class="w-full text-center min-w-0">
                <div class="text-xs font-medium text-foreground truncate leading-snug">
                  {{ displayName(app.packageName) }}
                </div>
                <div class="text-[10px] text-muted-foreground/40 font-mono mt-0.5 truncate">
                  {{ pkgDomain(app.packageName) }}
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Table view -->
        <div v-else class="h-full overflow-auto">
          <table class="w-full text-xs border-separate border-spacing-0">
            <thead class="sticky top-0 z-10">
              <tr class="bg-surface-2/95 backdrop-blur-sm">
                <th
                  class="px-4 py-2.5 text-left text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider border-b border-border/20 w-10"
                ></th>
                <th
                  class="px-3 py-2.5 text-left text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider border-b border-border/20"
                >
                  Package
                </th>
                <th
                  class="px-3 py-2.5 text-left text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider border-b border-border/20 hidden xl:table-cell"
                >
                  APK Path
                </th>
                <th class="px-3 py-2.5 border-b border-border/20 w-24"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="app in filteredApps"
                :key="app.packageName"
                class="group cursor-pointer border-b border-border/10 transition-colors"
                :class="
                  selectedApp?.packageName === app.packageName
                    ? 'bg-surface-3'
                    : 'hover:bg-surface-2/60'
                "
                @click="selectedApp = selectedApp?.packageName === app.packageName ? null : app"
              >
                <td class="px-4 py-2.5">
                  <AppIcon
                    :serial="serial"
                    :apk-path="app.apkPath"
                    :package-name="app.packageName"
                    size="sm"
                  />
                </td>
                <td class="px-3 py-2.5">
                  <div class="font-medium text-foreground/90">
                    {{ displayName(app.packageName) }}
                  </div>
                  <div
                    class="font-mono text-[10px] text-muted-foreground/40 mt-0.5 truncate max-w-xs"
                  >
                    {{ app.packageName }}
                  </div>
                </td>
                <td class="px-3 py-2.5 hidden xl:table-cell">
                  <span
                    class="font-mono text-[10px] text-muted-foreground/30 truncate max-w-sm block"
                  >
                    {{ app.apkPath }}
                  </span>
                </td>
                <td class="px-3 py-2.5">
                  <div
                    class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end"
                  >
                    <button
                      title="Force Stop"
                      class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                      @click.stop="promptAction(app, 'forceStop')"
                    >
                      <StopCircle class="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Clear Data"
                      class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
                      @click.stop="promptAction(app, 'clearData')"
                    >
                      <Eraser class="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Uninstall"
                      class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      @click.stop="promptAction(app, 'uninstall')"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ResizablePanel>

      <!-- Detail panel -->
      <template v-if="selectedApp">
        <ResizableHandle />
        <ResizablePanel :default-size="28" :min-size="22" :max-size="42">
          <div class="flex h-full flex-col bg-surface-1 border-l border-border/20">
            <!-- Header -->
            <div
              class="h-11 flex items-center justify-between px-4 border-b border-border/20 shrink-0"
            >
              <span class="text-xs font-medium text-foreground/70 truncate">
                {{ displayName(selectedApp.packageName) }}
              </span>
              <button
                class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-surface-3 transition-colors ml-2 shrink-0"
                @click="selectedApp = null"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>

            <ScrollArea class="flex-1">
              <div class="p-5 space-y-5">
                <!-- App identity -->
                <div class="flex flex-col items-center py-4 gap-3">
                  <AppIcon
                    :serial="serial"
                    :apk-path="selectedApp.apkPath"
                    :package-name="selectedApp.packageName"
                    size="lg"
                  />
                  <div class="text-center">
                    <div class="text-sm font-semibold text-foreground">
                      {{ displayName(selectedApp.packageName) }}
                    </div>
                    <div
                      class="text-[11px] text-muted-foreground/50 font-mono mt-1 break-all leading-relaxed"
                    >
                      {{ selectedApp.packageName }}
                    </div>
                  </div>
                </div>

                <!-- APK info -->
                <div class="space-y-2">
                  <div
                    class="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium"
                  >
                    Installation
                  </div>
                  <div
                    class="rounded-lg bg-surface-2 border border-border/20 divide-y divide-border/20"
                  >
                    <div class="flex items-start gap-3 px-3 py-2.5">
                      <HardDrive class="w-3.5 h-3.5 text-muted-foreground/30 mt-0.5 shrink-0" />
                      <div class="min-w-0">
                        <div class="text-[10px] text-muted-foreground/40 mb-0.5">APK Path</div>
                        <div
                          class="text-[11px] font-mono text-muted-foreground/60 break-all leading-relaxed"
                        >
                          {{ selectedApp.apkPath }}
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-3 px-3 py-2.5">
                      <Package class="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                      <div class="min-w-0">
                        <div class="text-[10px] text-muted-foreground/40 mb-0.5">Type</div>
                        <div class="text-[11px] text-muted-foreground/60">Third-party</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="space-y-2">
                  <div
                    class="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium"
                  >
                    Actions
                  </div>
                  <div class="space-y-1.5">
                    <button
                      :disabled="isActing"
                      class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-2 border border-border/20 hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors text-left group disabled:opacity-40 disabled:cursor-not-allowed"
                      @click="promptAction(selectedApp!, 'forceStop')"
                    >
                      <div
                        class="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0"
                      >
                        <StopCircle class="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div>
                        <div
                          class="text-xs font-medium text-foreground/80 group-hover:text-foreground"
                        >
                          Force Stop
                        </div>
                        <div class="text-[10px] text-muted-foreground/40">Kill all processes</div>
                      </div>
                    </button>

                    <button
                      :disabled="isActing"
                      class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-2 border border-border/20 hover:border-orange-500/30 hover:bg-orange-500/5 transition-colors text-left group disabled:opacity-40 disabled:cursor-not-allowed"
                      @click="promptAction(selectedApp!, 'clearData')"
                    >
                      <div
                        class="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center shrink-0"
                      >
                        <Eraser class="w-3.5 h-3.5 text-orange-400" />
                      </div>
                      <div>
                        <div
                          class="text-xs font-medium text-foreground/80 group-hover:text-foreground"
                        >
                          Clear Data
                        </div>
                        <div class="text-[10px] text-muted-foreground/40">
                          Reset app to fresh state
                        </div>
                      </div>
                    </button>

                    <button
                      :disabled="isActing"
                      class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-2 border border-border/20 hover:border-red-500/30 hover:bg-red-500/5 transition-colors text-left group disabled:opacity-40 disabled:cursor-not-allowed"
                      @click="promptAction(selectedApp!, 'uninstall')"
                    >
                      <div
                        class="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center shrink-0"
                      >
                        <Trash2 class="w-3.5 h-3.5 text-red-400" />
                      </div>
                      <div>
                        <div class="text-xs font-medium text-red-400/80 group-hover:text-red-400">
                          Uninstall
                        </div>
                        <div class="text-[10px] text-muted-foreground/40">Remove from device</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </template>
    </ResizablePanelGroup>
  </div>

  <!-- Action confirmation dialog -->
  <ConfirmDialog
    v-if="confirmDialogConfig"
    :open="pendingAction !== null"
    :title="confirmDialogConfig.title"
    :description="confirmDialogConfig.description"
    :confirm-text="confirmDialogConfig.confirmText"
    :variant="confirmDialogConfig.variant"
    @confirm="executeAction"
    @cancel="pendingAction = null"
    @update:open="
      (v) => {
        if (!v) pendingAction = null;
      }
    "
  />
</template>
