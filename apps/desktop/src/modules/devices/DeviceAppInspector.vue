<script setup lang="ts">
import {
  Database,
  Eraser,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Loader2,
  Package,
  Play,
  Shield,
  Smartphone,
  StopCircle,
  Trash2,
  X,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AdbPackage, AdbPackageDetails } from "@/types/adb.types";
import AppIcon from "./AppIcon.vue";

type AppAction = "forceStop" | "clearData" | "uninstall";

interface QuickPathEntry {
  key: string;
  label: string;
  path: string;
}

const props = defineProps<{
  serial: string;
  app: AdbPackage | null;
  details: AdbPackageDetails | undefined;
  selectedTotalSize: number | null;
  quickPaths: QuickPathEntry[];
  isLoadingDetails: boolean;
  isDetailsError: boolean;
  detailsError: unknown;
  isActing: boolean;
}>();

const emit = defineEmits<{
  clearSelection: [];
  openFiles: [path: string];
  launch: [];
  action: [action: AppAction];
  retryDetails: [];
}>();

function appDisplayName(app: AdbPackage): string {
  const label = app.label?.trim();
  return label && label.length > 0 ? label : app.packageName;
}

function packageKind(app: AdbPackage): "System" | "User" {
  return app.system ? "System" : "User";
}

function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) {
    return "—";
  }
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function formatTimestamp(value?: string | null): string {
  return value || "—";
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col border-l border-border/20 bg-surface-1">
    <div class="flex h-11 shrink-0 items-center justify-between border-b border-border/20 px-4">
      <span class="truncate text-xs font-medium text-foreground/70">
        {{ app ? appDisplayName(app) : "Package inspector" }}
      </span>
      <button
        v-if="app"
        class="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-surface-3 hover:text-muted-foreground"
        @click="emit('clearSelection')"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <template v-if="app">
      <ScrollArea class="min-h-0 flex-1">
        <div class="space-y-5 p-5">
          <div class="flex flex-col items-center gap-3 py-2">
            <AppIcon
              :serial="serial"
              :apk-path="app.apkPath"
              :package-name="app.packageName"
              :icon-path="app.iconPath"
              size="lg"
              :class="{ 'opacity-60 grayscale': !app.enabled }"
            />
            <div class="text-center">
              <div class="text-sm font-semibold text-foreground">
                {{ appDisplayName(app) }}
              </div>
              <div
                class="mt-1 break-all font-mono text-[11px] leading-relaxed text-muted-foreground/50"
              >
                {{ app.packageName }}
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-1.5">
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                :class="
                  app.system ? 'bg-amber-500/10 text-amber-300/80' : 'bg-primary/10 text-primary/80'
                "
              >
                {{ packageKind(app) }}
              </span>
              <span
                class="rounded-full px-2 py-0.5 text-[10px]"
                :class="
                  app.enabled
                    ? 'bg-emerald-500/10 text-emerald-400/80'
                    : 'bg-muted/20 text-muted-foreground/60'
                "
              >
                {{ app.enabled ? "Enabled" : "Disabled" }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg border border-border/20 bg-surface-2 p-3">
              <div
                class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/40"
              >
                <Package class="h-3 w-3" />
                Version
              </div>
              <div class="mt-2 text-sm font-medium text-foreground/85">
                {{ details?.versionName || "Unknown" }}
              </div>
              <div class="mt-1 text-[10px] text-muted-foreground/45">
                code {{ details?.versionCode || "—" }}
              </div>
            </div>

            <div class="rounded-lg border border-border/20 bg-surface-2 p-3">
              <div
                class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/40"
              >
                <Database class="h-3 w-3" />
                Storage
              </div>
              <div class="mt-2 text-sm font-medium text-foreground/85">
                {{ formatBytes(selectedTotalSize) }}
              </div>
              <div class="mt-1 text-[10px] text-muted-foreground/45">app + data + cache</div>
            </div>

            <div class="rounded-lg border border-border/20 bg-surface-2 p-3">
              <div
                class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/40"
              >
                <Smartphone class="h-3 w-3" />
                SDK
              </div>
              <div class="mt-2 text-sm font-medium text-foreground/85">
                min {{ details?.minSdkVersion ?? "—" }}
              </div>
              <div class="mt-1 text-[10px] text-muted-foreground/45">
                target {{ details?.targetSdkVersion ?? "—" }}
              </div>
            </div>

            <div class="rounded-lg border border-border/20 bg-surface-2 p-3">
              <div
                class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/40"
              >
                <Shield class="h-3 w-3" />
                Installer
              </div>
              <div class="mt-2 truncate text-sm font-medium text-foreground/85">
                {{ details?.installerPackageName || "Unknown" }}
              </div>
              <div class="mt-1 text-[10px] text-muted-foreground/45">source package</div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Timeline
            </div>
            <div class="rounded-lg border border-border/20 bg-surface-2 divide-y divide-border/20">
              <div class="flex items-center justify-between gap-4 px-3 py-2.5 text-[11px]">
                <span class="text-muted-foreground/45">First install</span>
                <span class="text-right text-foreground/75">
                  {{ formatTimestamp(details?.firstInstallTime) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-4 px-3 py-2.5 text-[11px]">
                <span class="text-muted-foreground/45">Last update</span>
                <span class="text-right text-foreground/75">
                  {{ formatTimestamp(details?.lastUpdateTime) }}
                </span>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Sizes
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-lg border border-border/20 bg-surface-2 px-3 py-2.5">
                <div class="text-[10px] text-muted-foreground/40">APK</div>
                <div class="mt-1 text-xs font-medium text-foreground/80">
                  {{ formatBytes(details?.appSize) }}
                </div>
              </div>
              <div class="rounded-lg border border-border/20 bg-surface-2 px-3 py-2.5">
                <div class="text-[10px] text-muted-foreground/40">Data</div>
                <div class="mt-1 text-xs font-medium text-foreground/80">
                  {{ formatBytes(details?.dataSize) }}
                </div>
              </div>
              <div class="rounded-lg border border-border/20 bg-surface-2 px-3 py-2.5">
                <div class="text-[10px] text-muted-foreground/40">Cache</div>
                <div class="mt-1 text-xs font-medium text-foreground/80">
                  {{ formatBytes(details?.cacheSize) }}
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Paths
            </div>
            <div class="space-y-2">
              <div
                v-for="pathEntry in quickPaths"
                :key="pathEntry.key"
                class="rounded-lg border border-border/20 bg-surface-2 px-3 py-2.5"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-[10px] text-muted-foreground/40">
                      {{ pathEntry.label }}
                    </div>
                    <div class="mt-1 break-all font-mono text-[11px] text-muted-foreground/65">
                      {{ pathEntry.path }}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
                    @click="emit('openFiles', pathEntry.path)"
                  >
                    <ExternalLink class="h-3 w-3" />
                    Browse
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="isLoadingDetails"
            class="flex items-center gap-2 rounded-lg border border-border/20 bg-surface-2 px-3 py-2.5 text-xs text-muted-foreground/45"
          >
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            Loading package details…
          </div>

          <div
            v-else-if="isDetailsError"
            class="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400"
          >
            <div class="font-medium">Could not load package details</div>
            <div class="mt-1 font-mono text-[10px] text-red-400/65">
              {{ detailsError }}
            </div>
            <Button
              variant="ghost"
              size="sm"
              class="mt-2 h-7 px-2 text-red-400 hover:text-red-300"
              @click="emit('retryDetails')"
            >
              Retry
            </Button>
          </div>

          <div class="space-y-1.5">
            <div class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Actions
            </div>

            <button
              class="group flex w-full items-center gap-2.5 rounded-lg border border-border/20 bg-surface-2 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
              @click="emit('launch')"
            >
              <div
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10"
              >
                <Play class="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <div class="text-xs font-medium text-foreground/80 group-hover:text-foreground">
                  Open App
                </div>
                <div class="text-[10px] text-muted-foreground/40">
                  Launch on the connected device
                </div>
              </div>
            </button>

            <button
              class="group flex w-full items-center gap-2.5 rounded-lg border border-border/20 bg-surface-2 px-3 py-2 text-left transition-colors hover:border-sky-500/30 hover:bg-sky-500/5"
              @click="emit('openFiles', details?.dataDir ?? `/data/data/${app.packageName}`)"
            >
              <div
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/10"
              >
                <FolderOpen class="h-3.5 w-3.5 text-sky-400" />
              </div>
              <div>
                <div class="text-xs font-medium text-foreground/80 group-hover:text-foreground">
                  Browse Internal Data
                </div>
                <div class="text-[10px] text-muted-foreground/40">Jump to the app sandbox path</div>
              </div>
            </button>

            <button
              class="group flex w-full items-center gap-2.5 rounded-lg border border-border/20 bg-surface-2 px-3 py-2 text-left transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/5"
              @click="
                emit(
                  'openFiles',
                  details?.externalDataDir ?? `/sdcard/Android/data/${app.packageName}`,
                )
              "
            >
              <div
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/10"
              >
                <HardDrive class="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div>
                <div class="text-xs font-medium text-foreground/80 group-hover:text-foreground">
                  Browse Android/data
                </div>
                <div class="text-[10px] text-muted-foreground/40">
                  Jump to the app external storage folder
                </div>
              </div>
            </button>

            <button
              :disabled="isActing"
              class="group flex w-full items-center gap-2.5 rounded-lg border border-border/20 bg-surface-2 px-3 py-2 text-left transition-colors hover:border-amber-500/30 hover:bg-amber-500/5 disabled:cursor-not-allowed disabled:opacity-40"
              @click="emit('action', 'forceStop')"
            >
              <div
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10"
              >
                <StopCircle class="h-3.5 w-3.5 text-amber-400" />
              </div>
              <div>
                <div class="text-xs font-medium text-foreground/80 group-hover:text-foreground">
                  Force Stop
                </div>
                <div class="text-[10px] text-muted-foreground/40">Kill the app process</div>
              </div>
            </button>

            <button
              :disabled="isActing"
              class="group flex w-full items-center gap-2.5 rounded-lg border border-border/20 bg-surface-2 px-3 py-2 text-left transition-colors hover:border-orange-500/30 hover:bg-orange-500/5 disabled:cursor-not-allowed disabled:opacity-40"
              @click="emit('action', 'clearData')"
            >
              <div
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500/10"
              >
                <Eraser class="h-3.5 w-3.5 text-orange-400" />
              </div>
              <div>
                <div class="text-xs font-medium text-foreground/80 group-hover:text-foreground">
                  Clear Data
                </div>
                <div class="text-[10px] text-muted-foreground/40">Remove app data and cache</div>
              </div>
            </button>

            <button
              :disabled="isActing"
              class="group flex w-full items-center gap-2.5 rounded-lg border border-border/20 bg-surface-2 px-3 py-2 text-left transition-colors hover:border-red-500/30 hover:bg-red-500/5 disabled:cursor-not-allowed disabled:opacity-40"
              @click="emit('action', 'uninstall')"
            >
              <div
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-500/10"
              >
                <Trash2 class="h-3.5 w-3.5 text-red-400" />
              </div>
              <div>
                <div class="text-xs font-medium text-red-400/80 group-hover:text-red-400">
                  Uninstall
                </div>
                <div class="text-[10px] text-muted-foreground/40">Remove from this device</div>
              </div>
            </button>
          </div>
        </div>
      </ScrollArea>
    </template>

    <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <Package class="h-10 w-10 text-muted-foreground/10" />
      <div>
        <div class="text-sm font-medium text-foreground/65">Select an app</div>
        <div class="mt-1 text-xs leading-relaxed text-muted-foreground/35">
          Pick a package to inspect install info, size data, launch actions, and jump straight into
          its filesystem paths.
        </div>
      </div>
    </div>
  </div>
</template>
