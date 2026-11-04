<script setup lang="ts">
import { computed } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";
import { useAppPackages } from "@/composables/useAppPackages";
import type { CDPTarget } from "@/types/cdp.types";
import type { LinkPresentation } from "@/lib/gates/link";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import TargetAppGroup from "./TargetAppGroup.vue";
import type { TargetGroup } from "./targetGroups";

const props = defineProps<{
  serial: string;
  deviceName: string;
  groups: TargetGroup[];
  selectedTargetId: string | null;
  link: LinkPresentation;
  scanning: boolean;
}>();

const emit = defineEmits<{
  rescan: [];
  select: [target: CDPTarget];
  inspect: [target: CDPTarget];
  detach: [target: CDPTarget];
}>();

const serialRef = computed(() => props.serial);
const { getCachedPackage } = useAppPackages(serialRef);

const targetCount = computed(() =>
  props.groups.reduce((total, group) => total + group.targets.length, 0),
);

const decorated = computed(() =>
  props.groups.map((group) => {
    const cached = group.packageName ? getCachedPackage(group.packageName) : null;
    return {
      group,
      label: cached?.label?.trim() || null,
      apkPath: cached?.apkPath ?? "",
      iconPath: cached?.iconPath ?? null,
    };
  }),
);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex h-8 shrink-0 items-center gap-2 px-5">
      <span class="text-xs text-muted-foreground">WebViews</span>
      <span v-if="targetCount" class="font-mono text-2xs text-[var(--fg-subtle)]">
        {{ targetCount }}
      </span>
      <Spinner v-if="props.scanning && targetCount" size="xs" />
      <span class="flex-1" />
      <IconAction
        label="Scan for WebViews"
        size="sm"
        position="top"
        :disabled="props.scanning"
        @click="emit('rescan')"
      >
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
    </div>

    <div
      v-if="props.groups.length"
      class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4"
      data-target-list
    >
      <TargetAppGroup
        v-for="entry in decorated"
        :key="entry.group.packageName ?? 'unknown'"
        :group="entry.group"
        :serial="props.serial"
        :app-label="entry.label"
        :apk-path="entry.apkPath"
        :icon-path="entry.iconPath"
        :selected-target-id="props.selectedTargetId"
        :link="props.link"
        @select="emit('select', $event)"
        @inspect="emit('inspect', $event)"
        @detach="emit('detach', $event)"
      />
    </div>

    <div
      v-else-if="props.scanning"
      class="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"
      aria-live="polite"
    >
      <Spinner size="xs" /> Scanning {{ props.deviceName }} for WebViews
    </div>

    <div v-else class="flex flex-1 flex-col items-center justify-center gap-2 px-10 text-center">
      <p class="text-sm text-foreground">No debuggable WebViews on {{ props.deviceName }}</p>
      <p class="max-w-sm text-xs text-muted-foreground">
        Open your app on the device and keep it in front. Any debuggable build appears here with no
        code change; release builds need WebView debugging turned on.
      </p>
      <Button
        variant="solid"
        surface-level="+2"
        size="sm"
        class="mt-1"
        content-class-name="gap-1.5 px-3 [&>svg]:size-3.5"
        @click="emit('rescan')"
      >
        <RefreshCw :stroke-width="1.8" />
        Scan again
      </Button>
    </div>
  </div>
</template>
