<script setup lang="ts">
import { computed } from "vue";
import {
  AppWindow,
  BatteryCharging,
  Database,
  ExternalLink,
  FolderOpen,
  Globe,
  Package2,
  Play,
  ShieldCheck,
  SquareStack,
  StopCircle,
  Trash2,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdbPackage, AdbPackageDetails } from "@/types/adb.types";
import type {
  AppBatteryStats,
  AppCapacitorInfo,
  AppMemInfo,
  AppNetworkStats,
  AppPermissionsData,
} from "@/types/app-inspector.types";
import AppIcon from "@/modules/devices/AppIcon.vue";
import AppPermissionsTab from "./AppPermissionsTab.vue";

const props = defineProps<{
  serial: string;
  packageName: string;
  targetTitle: string;
  targetUrl: string;
  packageInfo: AdbPackage | null;
  details: AdbPackageDetails | undefined;
  memInfo: AppMemInfo | null;
  networkStats: AppNetworkStats | null;
  batteryStats: AppBatteryStats | null;
  capacitorInfo: AppCapacitorInfo | null;
  permissions: AppPermissionsData | null;
  isDetailsLoading: boolean;
  isPermissionsLoading: boolean;
  permissionsError: string | null;
}>();

const emit = defineEmits<{
  launch: [];
  forceStop: [];
  clearData: [];
  browseInternal: [];
  browseExternal: [];
  openIndexedDb: [];
  openSqlite: [];
  openCapacitor: [];
  refreshPermissions: [];
}>();

function displayName() {
  const label = props.packageInfo?.label?.trim();
  return label || props.packageName;
}

function fmtBytes(bytes?: number | null) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : value >= 100 ? 0 : 1)} ${units[index]}`;
}

function fmtMs(ms?: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function fmtDetailBytes(bytes?: number | null) {
  if (bytes === null || bytes === undefined) {
    return props.isDetailsLoading ? "Loading" : "—";
  }
  return fmtBytes(bytes);
}

const totalFootprint = computed(() => {
  const details = props.details;
  if (!details) return null;
  const values = [details.appSize, details.dataSize, details.cacheSize].filter(
    (value): value is number => value !== null && value !== undefined,
  );
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
});

const networkTotal = computed(() => {
  const stats = props.networkStats;
  if (!stats) return null;
  return stats.wifiRxBytes + stats.wifiTxBytes + stats.mobileRxBytes + stats.mobileTxBytes;
});

const targetOrigin = computed(() => {
  if (!props.targetUrl) return "—";
  try {
    return new URL(props.targetUrl).origin;
  } catch {
    return props.targetUrl;
  }
});

const internalPath = computed(() => props.details?.dataDir ?? `/data/data/${props.packageName}`);
const externalPath = computed(
  () => props.details?.externalDataDir ?? `/Android/data/${props.packageName}`,
);

const storageRows = computed(() => [
  { label: "App size", value: fmtDetailBytes(props.details?.appSize) },
  { label: "Data", value: fmtDetailBytes(props.details?.dataSize) },
  { label: "Cache", value: fmtDetailBytes(props.details?.cacheSize) },
  { label: "Total", value: fmtDetailBytes(totalFootprint.value) },
]);

const infoRows = computed(() => [
  {
    label: "Version",
    value: props.details?.versionName ?? (props.isDetailsLoading ? "Loading" : "—"),
  },
  {
    label: "Version code",
    value: props.details?.versionCode ?? (props.isDetailsLoading ? "Loading" : "—"),
  },
  {
    label: "SDK",
    value: `${props.details?.minSdkVersion ?? "—"} / ${props.details?.targetSdkVersion ?? "—"}`,
  },
  {
    label: "Memory",
    value: props.memInfo ? fmtBytes(props.memInfo.totalPssKb * 1024) : "—",
  },
]);
</script>

<template>
  <div class="space-y-3 p-3">
    <section class="overflow-hidden rounded-lg border border-border/25 bg-surface-0">
      <div
        class="flex h-14 shrink-0 items-center gap-3 border-b border-border/30 bg-surface-1 px-3"
      >
        <AppIcon
          :serial="serial"
          :apk-path="details?.apkPath ?? packageInfo?.apkPath ?? ''"
          :package-name="packageName"
          :icon-path="packageInfo?.iconPath"
          size="md"
          class="shrink-0"
        />
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-2">
            <div class="truncate text-sm font-semibold text-foreground">
              {{ displayName() }}
            </div>
            <Badge
              v-if="packageInfo"
              variant="outline"
              class="h-5 border-border/35 px-1.5 text-[10px] text-muted-foreground/65"
            >
              {{ packageInfo.system ? "system" : "user" }}
            </Badge>
            <Badge
              v-if="packageInfo"
              variant="outline"
              class="h-5 border-border/35 px-1.5 text-[10px]"
              :class="packageInfo.enabled ? 'text-emerald-400' : 'text-muted-foreground/55'"
            >
              {{ packageInfo.enabled ? "enabled" : "disabled" }}
            </Badge>
            <Badge
              v-if="capacitorInfo?.isCapacitor"
              variant="outline"
              class="h-5 border-cyan-500/25 px-1.5 text-[10px] text-cyan-300"
            >
              capacitor
            </Badge>
          </div>
          <div class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/50">
            {{ packageName }}
          </div>
        </div>

        <div class="flex items-center gap-1">
          <Button size="sm" class="h-7 gap-1.5 px-2 text-xs" @click="emit('launch')">
            <Play class="h-3.5 w-3.5" />Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs"
            @click="emit('forceStop')"
          >
            <StopCircle class="h-3.5 w-3.5" />Stop
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs"
            @click="emit('clearData')"
          >
            <Trash2 class="h-3.5 w-3.5" />Clear
          </Button>
        </div>
      </div>

      <div class="flex h-9 items-center gap-2 border-b border-border/20 px-3">
        <AppWindow class="h-3.5 w-3.5 text-muted-foreground/45" />
        <span class="text-xs font-medium">App info</span>
        <span class="ml-auto text-[10px] text-muted-foreground/40">
          runtime, package, storage
        </span>
      </div>

      <div class="grid shrink-0 border-b border-border/20 bg-surface-0 text-xs md:grid-cols-4">
        <div class="min-w-0 border-r border-border/20 px-3 py-2">
          <div class="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground/40">
            <Globe class="h-3 w-3" />Origin
          </div>
          <div class="mt-1 truncate font-mono text-[11px]" :title="targetOrigin">
            {{ targetOrigin }}
          </div>
        </div>
        <div class="min-w-0 border-r border-border/20 px-3 py-2">
          <div class="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground/40">
            <SquareStack class="h-3 w-3" />Runtime
          </div>
          <div class="mt-1 truncate">
            {{ memInfo ? fmtBytes(memInfo.totalPssKb * 1024) : "—" }}
            <span class="text-muted-foreground/45">
              · {{ memInfo?.threadCount ?? "—" }} threads
            </span>
          </div>
        </div>
        <div class="min-w-0 border-r border-border/20 px-3 py-2">
          <div class="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground/40">
            <Package2 class="h-3 w-3" />Package
          </div>
          <div class="mt-1 truncate">
            {{ details?.versionName ?? "—" }}
            <span class="text-muted-foreground/45">
              · sdk {{ details?.targetSdkVersion ?? "—" }}
            </span>
          </div>
        </div>
        <div class="min-w-0 px-3 py-2">
          <div class="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground/40">
            <BatteryCharging class="h-3 w-3" />Signals
          </div>
          <div class="mt-1 truncate">
            {{ fmtBytes(networkTotal) }}
            <span class="text-muted-foreground/45">
              · fg {{ fmtMs(batteryStats?.fgCpuTimeMs) }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div class="min-w-0 border-r border-border/25">
          <div class="border-b border-border/20 bg-surface-1 px-3 py-2">
            <div class="flex items-center gap-2 text-xs font-medium">
              <Database class="h-3.5 w-3.5 text-muted-foreground/45" />
              Storage details
            </div>
          </div>
          <div class="grid border-b border-border/20 text-xs sm:grid-cols-4">
            <div
              v-for="row in storageRows"
              :key="row.label"
              class="min-w-0 border-r border-border/15 px-3 py-2 last:border-r-0"
            >
              <div class="text-[10px] uppercase text-muted-foreground/40">
                {{ row.label }}
              </div>
              <div class="mt-1 truncate font-mono text-[11px] font-medium" :title="row.value">
                {{ row.value }}
              </div>
            </div>
          </div>
          <div class="grid text-xs sm:grid-cols-2">
            <div
              v-for="row in infoRows"
              :key="row.label"
              class="flex min-w-0 items-center justify-between gap-3 border-b border-border/15 px-3 py-2"
            >
              <span class="shrink-0 text-muted-foreground/50">{{ row.label }}</span>
              <span class="min-w-0 truncate font-mono text-[11px]" :title="row.value">
                {{ row.value }}
              </span>
            </div>
          </div>
        </div>

        <div class="min-w-0">
          <div class="flex h-9 items-center gap-2 border-b border-border/20 bg-surface-1 px-3">
            <Database class="h-3.5 w-3.5 text-muted-foreground/45" />
            <span class="text-xs font-medium">Shortcuts</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 p-2">
            <Button
              variant="outline"
              size="sm"
              class="h-7 justify-start gap-1.5 text-xs"
              @click="emit('openIndexedDb')"
            >
              <Database class="h-3.5 w-3.5" />IndexedDB
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-7 justify-start gap-1.5 text-xs"
              @click="emit('openSqlite')"
            >
              <AppWindow class="h-3.5 w-3.5" />SQLite
            </Button>
            <Button
              v-if="capacitorInfo?.isCapacitor"
              variant="outline"
              size="sm"
              class="h-7 justify-start gap-1.5 text-xs"
              @click="emit('openCapacitor')"
            >
              <ShieldCheck class="h-3.5 w-3.5" />Capacitor
            </Button>
          </div>
          <div class="border-t border-border/20">
            <button
              class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-surface-2"
              @click="emit('browseInternal')"
            >
              <span class="flex min-w-0 items-center gap-2">
                <FolderOpen class="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
                <span class="min-w-0 truncate font-mono text-[11px]">{{ internalPath }}</span>
              </span>
              <ExternalLink class="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
            </button>
            <button
              class="flex w-full items-center justify-between gap-3 border-t border-border/15 px-3 py-2 text-left text-xs hover:bg-surface-2"
              @click="emit('browseExternal')"
            >
              <span class="flex min-w-0 items-center gap-2">
                <FolderOpen class="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
                <span class="min-w-0 truncate font-mono text-[11px]">{{ externalPath }}</span>
              </span>
              <ExternalLink class="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="overflow-hidden rounded-lg border border-border/25 bg-surface-0">
      <AppPermissionsTab
        :permissions="permissions"
        :is-loading="isPermissionsLoading"
        :error="permissionsError"
        @refresh="emit('refreshPermissions')"
      />
    </section>
  </div>
</template>
