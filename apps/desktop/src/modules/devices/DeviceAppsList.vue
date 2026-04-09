<script setup lang="ts">
import { Eraser, Package, Play, StopCircle, Trash2 } from "lucide-vue-next";
import type { AdbPackage } from "@/types/adb.types";
import AppIcon from "./AppIcon.vue";

type AppAction = "forceStop" | "clearData" | "uninstall";

const props = defineProps<{
  serial: string;
  appsView: "grid" | "table";
  gridColumns: string;
  apps: AdbPackage[];
  selectedPackageName: string | null;
}>();

const emit = defineEmits<{
  select: [app: AdbPackage];
  launch: [app: AdbPackage];
  action: [payload: { app: AdbPackage; action: AppAction }];
}>();

function appDisplayName(app: AdbPackage): string {
  const label = app.label?.trim();
  return label && label.length > 0 ? label : app.packageName;
}

function pkgDomain(pkg: string): string {
  const parts = pkg.split(".");
  return parts.slice(0, Math.min(2, parts.length - 1)).join(".");
}

function packageKind(app: AdbPackage): "System" | "User" {
  return app.system ? "System" : "User";
}

function selectApp(app: AdbPackage) {
  emit("select", app);
}

function launchApp(app: AdbPackage) {
  emit("launch", app);
}

function promptAction(app: AdbPackage, action: AppAction) {
  emit("action", { app, action });
}
</script>

<template>
  <div v-if="appsView === 'grid'" class="h-full overflow-y-auto">
    <div
      v-if="apps.length === 0"
      class="flex h-40 flex-col items-center justify-center gap-2 text-center"
    >
      <Package class="h-8 w-8 text-muted-foreground/10" />
      <p class="text-sm text-muted-foreground/35">No packages match the current filters</p>
    </div>

    <div
      v-else
      class="grid gap-px bg-border/20 p-0"
      :style="{
        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
      }"
    >
      <button
        v-for="app in apps"
        :key="app.packageName"
        class="group relative flex flex-col gap-3 bg-surface-1 p-4 text-left transition-all"
        :class="
          selectedPackageName === app.packageName
            ? 'z-10 bg-surface-3 ring-1 ring-inset ring-border/40'
            : 'hover:bg-surface-2'
        "
        @click="selectApp(app)"
      >
        <div class="flex flex-col items-center justify-center gap-6">
          <AppIcon
            :serial="serial"
            :apk-path="app.apkPath"
            :package-name="app.packageName"
            :icon-path="app.iconPath"
            size="md"
            :class="{ 'opacity-60 grayscale': !app.enabled }"
          />

          <div class="min-w-0 text-center">
            <div class="truncate text-xs font-medium text-foreground">
              {{ appDisplayName(app) }}
            </div>
          </div>
        </div>
      </button>
    </div>
  </div>

  <div v-else class="h-full overflow-auto">
    <table class="w-full border-separate border-spacing-0 text-xs">
      <thead class="sticky top-0 z-10">
        <tr class="bg-surface-2/95 backdrop-blur-sm">
          <th
            class="w-10 border-b border-border/20 px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40"
          />
          <th
            class="border-b border-border/20 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40"
          >
            Package
          </th>
          <th
            class="w-24 border-b border-border/20 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40"
          >
            Type
          </th>
          <th
            class="w-24 border-b border-border/20 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40"
          >
            Status
          </th>
          <th
            class="hidden border-b border-border/20 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40 xl:table-cell"
          >
            APK Path
          </th>
          <th class="w-24 border-b border-border/20 px-3 py-2.5" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="app in apps"
          :key="app.packageName"
          class="group cursor-pointer border-b border-border/10 transition-colors"
          :class="
            selectedPackageName === app.packageName ? 'bg-surface-3' : 'hover:bg-surface-2/60'
          "
          @click="selectApp(app)"
        >
          <td class="px-4 py-2.5">
            <AppIcon
              :serial="serial"
              :apk-path="app.apkPath"
              :package-name="app.packageName"
              :icon-path="app.iconPath"
              size="sm"
              :class="{ 'opacity-60 grayscale': !app.enabled }"
            />
          </td>
          <td class="px-3 py-2.5">
            <div class="font-medium text-foreground/90">
              {{ appDisplayName(app) }}
            </div>
            <div class="mt-0.5 max-w-xs truncate font-mono text-[10px] text-muted-foreground/40">
              {{ app.packageName }}
            </div>
          </td>
          <td class="px-3 py-2.5 text-muted-foreground/60">
            {{ packageKind(app) }}
          </td>
          <td class="px-3 py-2.5">
            <span
              class="rounded-full px-1.5 py-0.5 text-[10px]"
              :class="
                app.enabled
                  ? 'bg-emerald-500/10 text-emerald-400/80'
                  : 'bg-muted/20 text-muted-foreground/60'
              "
            >
              {{ app.enabled ? "Enabled" : "Disabled" }}
            </span>
          </td>
          <td class="hidden px-3 py-2.5 xl:table-cell">
            <span class="block max-w-sm truncate font-mono text-[10px] text-muted-foreground/30">
              {{ app.apkPath }}
            </span>
          </td>
          <td class="px-3 py-2.5">
            <div
              class="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button
                title="Open app"
                class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-primary/10 hover:text-primary"
                @click.stop="launchApp(app)"
              >
                <Play class="h-3.5 w-3.5" />
              </button>
              <button
                title="Force stop"
                class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-amber-400/10 hover:text-amber-400"
                @click.stop="promptAction(app, 'forceStop')"
              >
                <StopCircle class="h-3.5 w-3.5" />
              </button>
              <button
                title="Clear data"
                class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-orange-400/10 hover:text-orange-400"
                @click.stop="promptAction(app, 'clearData')"
              >
                <Eraser class="h-3.5 w-3.5" />
              </button>
              <button
                title="Uninstall"
                class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-red-400/10 hover:text-red-400"
                @click.stop="promptAction(app, 'uninstall')"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
