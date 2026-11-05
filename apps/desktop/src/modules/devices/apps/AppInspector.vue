<script setup lang="ts">
import { computed } from "vue";
import { CircleStop, Eraser, Play, Trash2 } from "lucide-vue-next";
import { Button, Chip, Spinner } from "@capubridge/cladd";
import type { AdbPackage, AdbPackageDetails } from "@/types/adb.types";
import AppIcon from "@/shared/apps/AppIcon.vue";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import { installDateWords, updateDateWords } from "@/shared/format/dates";
import AppFolderList from "@/shared/apps/AppFolderList.vue";
import AppSizeBreakdown from "@/shared/apps/AppSizeBreakdown.vue";
import { appDisplayName, knownValue } from "@/shared/apps/appIdentity";
import { appFolders } from "@/shared/apps/appFolders";
import { uninstallLabel, type AppAction } from "@/shared/apps/appActions";

const props = defineProps<{
  serial: string;
  app: AdbPackage;
  details: AdbPackageDetails | undefined;
  loadingDetails: boolean;
  detailsError: unknown;
  busy: boolean;
}>();

const emit = defineEmits<{
  launch: [];
  action: [action: AppAction];
  openFiles: [path: string];
  retryDetails: [];
}>();

const name = computed(() => appDisplayName(props.app));

const folders = computed(() => appFolders(props.app, props.details));
const facts = computed(() => {
  const details = props.details;
  const versionName = knownValue(details?.versionName);
  const versionCode = knownValue(details?.versionCode);
  const version = versionName ? `${versionName}${versionCode ? ` (${versionCode})` : ""}` : null;
  const sdk =
    details?.targetSdkVersion || details?.minSdkVersion
      ? `Targets API ${details.targetSdkVersion ?? "?"}, runs from API ${details.minSdkVersion ?? "?"}`
      : null;
  const installed = knownValue(details?.firstInstallTime);
  const updated = updateDateWords(installed, knownValue(details?.lastUpdateTime));
  return [
    { label: "Version", value: version, mono: true, raw: null },
    { label: "Android", value: sdk, mono: false, raw: null },
    {
      label: "Installed by",
      value: knownValue(details?.installerPackageName),
      mono: true,
      raw: null,
    },
    { label: "Installed", value: installDateWords(installed), mono: false, raw: installed },
    ...(updated
      ? [
          {
            label: "Updated",
            value: updated,
            mono: false,
            raw: knownValue(details?.lastUpdateTime),
          },
        ]
      : []),
  ];
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
    <header class="flex items-start gap-3">
      <AppIcon
        :serial="props.serial"
        :apk-path="props.app.apkPath"
        :package-name="props.app.packageName"
        :icon-path="props.app.iconPath"
        :label="name"
        size="md"
        :class="{ 'opacity-50 grayscale': !props.app.enabled }"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h2 class="truncate text-base font-medium text-foreground">{{ name }}</h2>
        <span class="flex min-w-0 items-center gap-1">
          <span class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
            {{ props.app.packageName }}
          </span>
          <CopyAction :value="props.app.packageName" label="Copy package name" />
        </span>
        <span class="flex flex-wrap gap-1">
          <Chip v-if="props.app.system" size="xs">System app</Chip>
          <Chip v-if="!props.app.enabled" size="xs" color="yellow">Disabled</Chip>
        </span>
      </div>
    </header>

    <div class="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant="solid-fill"
        content-class-name="gap-1.5 px-3 [&>svg]:size-3.5"
        @click="emit('launch')"
      >
        <Play :stroke-width="1.8" />
        Open
      </Button>
      <Button
        size="sm"
        variant="transparent"
        :disabled="props.busy"
        content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
        @click="emit('action', 'forceStop')"
      >
        <CircleStop :stroke-width="1.8" />
        Force stop
      </Button>
      <Button
        size="sm"
        variant="transparent"
        :disabled="props.busy"
        content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
        @click="emit('action', 'clearData')"
      >
        <Eraser :stroke-width="1.8" />
        Clear data
      </Button>
      <Button
        size="sm"
        variant="transparent"
        :outline="false"
        color="red"
        :disabled="props.busy"
        content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
        @click="emit('action', 'uninstall')"
      >
        <Trash2 :stroke-width="1.8" />
        {{ uninstallLabel(props.app.system) }}
      </Button>
    </div>

    <div v-if="props.loadingDetails" class="flex items-center gap-2 text-xs text-muted-foreground">
      <Spinner size="xs" />
      Reading the app's details
    </div>
    <div
      v-else-if="props.detailsError"
      class="flex items-start gap-3 rounded-control bg-surface-cut px-3 py-2.5 shadow-cut"
      role="alert"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <p class="text-xs text-foreground">The phone did not send this app's details.</p>
        <p class="font-mono text-2xs break-all text-error">{{ props.detailsError }}</p>
      </div>
      <Button size="sm" variant="transparent" @click="emit('retryDetails')">Try again</Button>
    </div>
    <template v-else>
      <dl class="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-xs">
        <template v-for="fact in facts" :key="fact.label">
          <dt class="text-muted-foreground">{{ fact.label }}</dt>
          <dd
            class="min-w-0 truncate"
            :class="[
              fact.mono && fact.value ? 'font-mono' : '',
              fact.value ? 'text-foreground' : 'text-[var(--fg-subtle)]',
            ]"
            :title="fact.raw ?? fact.value ?? undefined"
          >
            {{ fact.value ?? "Unknown" }}
          </dd>
        </template>
      </dl>
      <AppSizeBreakdown :details="props.details" />
    </template>

    <section class="flex flex-col gap-1.5" aria-label="Folders">
      <h3 class="text-xs text-muted-foreground">Folders</h3>
      <AppFolderList :folders="folders" @open="emit('openFiles', $event)" />
    </section>
  </div>
</template>
