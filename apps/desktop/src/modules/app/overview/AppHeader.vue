<script setup lang="ts">
import { LayoutList, RefreshCw } from "lucide-vue-next";
import { Chip, StatusDot } from "@capubridge/cladd";
import AppIcon from "@/shared/apps/AppIcon.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { StatusMark } from "@/shared/perf/statusMark";

const props = defineProps<{
  serial: string;
  packageName: string;
  name: string;
  iconPath: string | null;
  apkPath: string;
  system: boolean;
  enabled: boolean;
  runLabel: string;
  runMark: StatusMark;
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
      :icon-path="props.iconPath"
      :label="props.name"
      size="md"
      class="!size-11 shrink-0 !rounded-well"
      :class="{ 'opacity-50 grayscale': !props.enabled }"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <HintTooltip :text="props.packageName" position="bottom">
        <h1 class="truncate text-xl font-medium text-foreground">{{ props.name }}</h1>
      </HintTooltip>
      <div class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <StatusDot :color="props.runMark.color" :variant="props.runMark.variant" />
        <span class="shrink-0">{{ props.runLabel }}</span>
        <Chip v-if="props.system" size="xs" class="ml-1">System app</Chip>
        <Chip v-if="!props.enabled" size="xs" color="yellow" class="ml-1">Disabled</Chip>
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
      hint="Version, storage and permissions"
      :loading="props.refreshing"
      class="shrink-0"
      @click="emit('refresh')"
    >
      <RefreshCw :stroke-width="1.8" />
    </IconAction>
  </header>
</template>
