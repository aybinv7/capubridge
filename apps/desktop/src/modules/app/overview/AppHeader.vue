<script setup lang="ts">
import { LayoutList, RefreshCw } from "lucide-vue-next";
import { Chip, StatusDot } from "@capubridge/cladd";
import type { AdbPackage } from "@/types/adb.types";
import AppIcon from "@/shared/apps/AppIcon.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { StatusMark } from "@/shared/perf/statusMark";

const props = defineProps<{
  serial: string;
  packageName: string;
  name: string;
  entry: AdbPackage | null;
  apkPath: string;
  runLabel: string;
  runMark: StatusMark;
  version: string | null;
  refreshing: boolean;
}>();

const emit = defineEmits<{ refresh: []; showInApps: [] }>();
</script>

<template>
  <header class="flex items-center gap-3.5">
    <AppIcon
      :serial="props.serial"
      :apk-path="props.apkPath"
      :package-name="props.packageName"
      :icon-path="props.entry?.iconPath ?? null"
      :label="props.name"
      size="md"
      class="!size-11 shrink-0 !rounded-well"
      :class="{ 'opacity-50 grayscale': props.entry?.enabled === false }"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <h1 class="truncate text-xl font-medium text-foreground" :title="props.packageName">
        {{ props.name }}
      </h1>
      <div class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <StatusDot :color="props.runMark.color" :variant="props.runMark.variant" />
        <span class="shrink-0">{{ props.runLabel }}</span>
        <template v-if="props.version">
          <span aria-hidden="true" class="text-[var(--fg-subtle)]">·</span>
          <span class="truncate font-mono text-2xs">Version {{ props.version }}</span>
        </template>
        <Chip v-if="props.entry?.system" size="xs" class="ml-1">System app</Chip>
        <Chip v-if="props.entry?.enabled === false" size="xs" color="yellow" class="ml-1">
          Disabled
        </Chip>
      </div>
    </div>
    <IconAction
      label="Show in the phone's app list"
      hint="Device › Apps, where every app can be stopped, cleared or uninstalled"
      class="shrink-0"
      @click="emit('showInApps')"
    >
      <LayoutList :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Refresh the app's details"
      :loading="props.refreshing"
      class="shrink-0"
      @click="emit('refresh')"
    >
      <RefreshCw :stroke-width="1.8" />
    </IconAction>
  </header>
</template>
