<script setup lang="ts">
import { computed } from "vue";
import { Spinner, Surface } from "@capubridge/cladd";
import { useAppPackages } from "@/composables/useAppPackages";
import type { CDPTarget } from "@/types/cdp.types";
import type { LinkPresentation } from "@/lib/gates/link";
import DebuggableAppRow from "./DebuggableAppRow.vue";

const props = defineProps<{
  serial: string;
  targets: CDPTarget[];
  selectedTargetId: string | null;
  link: LinkPresentation;
  scanning: boolean;
}>();

const emit = defineEmits<{ select: [target: CDPTarget] }>();

const serialRef = computed(() => props.serial);
const { getCachedPackage } = useAppPackages(serialRef);

const rows = computed(() =>
  props.targets
    .map((target) => {
      const cached = target.packageName ? getCachedPackage(target.packageName) : null;
      return {
        target,
        label: cached?.label?.trim() || null,
        apkPath: cached?.apkPath ?? "",
        iconPath: cached?.iconPath ?? null,
        active: target.id === props.selectedTargetId,
      };
    })
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        (a.label ?? a.target.packageName ?? "").localeCompare(
          b.label ?? b.target.packageName ?? "",
        ),
    ),
);
</script>

<template>
  <section class="flex flex-col gap-1.5" aria-label="Debuggable apps">
    <div class="flex items-center gap-2 px-2">
      <span class="text-xs text-muted-foreground">Debuggable apps</span>
      <span class="font-mono text-2xs text-[var(--fg-subtle)]">{{ props.targets.length }}</span>
      <Spinner v-if="props.scanning" size="xs" />
    </div>
    <p class="px-2 text-2xs text-[var(--fg-subtle)]">
      No WebView open. Data › SQLite, App, Logs and the screen work over ADB.
    </p>
    <Surface
      variant="solid"
      level="+1"
      outline
      class="rounded-well"
      content-class-name="flex flex-col gap-0.5 p-1.5"
    >
      <DebuggableAppRow
        v-for="row in rows"
        :key="row.target.id"
        :target="row.target"
        :serial="props.serial"
        :label="row.label"
        :apk-path="row.apkPath"
        :icon-path="row.iconPath"
        :active="row.active"
        :link="row.active ? props.link : null"
        @select="emit('select', row.target)"
      />
    </Surface>
  </section>
</template>
