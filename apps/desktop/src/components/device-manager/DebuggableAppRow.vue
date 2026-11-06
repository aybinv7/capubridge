<script setup lang="ts">
import type { CDPTarget } from "@/types/cdp.types";
import type { LinkPresentation } from "@/lib/gates/link";
import { LINK_TONE_MARK } from "@/components/gate/linkTone";
import AppIcon from "@/shared/apps/AppIcon.vue";

const props = defineProps<{
  target: CDPTarget;
  serial: string;
  label: string | null;
  apkPath: string;
  iconPath: string | null;
  active: boolean;
  link: LinkPresentation | null;
}>();

const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <button
    type="button"
    data-roving-item
    :data-current="props.active || undefined"
    :aria-current="props.active ? 'true' : undefined"
    class="flex w-full min-w-0 items-center gap-2.5 rounded-control py-1.5 pr-2.5 pl-3 text-left outline-none transition-colors duration-120 focus-visible:ring-1 focus-visible:ring-ring"
    :class="props.active ? 'bg-cladd-surface-next shadow-bevel' : 'hover:bg-cladd-surface-hover'"
    :title="props.active ? props.link?.description : 'Use this app without a WebView'"
    @click="emit('select')"
  >
    <span
      class="size-1.5 shrink-0"
      :class="props.active && props.link ? LINK_TONE_MARK[props.link.tone] : 'rounded-full'"
      aria-hidden="true"
    />
    <AppIcon
      v-if="props.target.packageName"
      :serial="props.serial"
      :package-name="props.target.packageName"
      :apk-path="props.apkPath"
      :icon-path="props.iconPath"
      size="sm"
      class="!size-6 shrink-0 !rounded-[6px]"
    />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-sm text-foreground">
        {{ props.label || props.target.packageName }}
      </span>
      <span v-if="props.label" class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
        {{ props.target.packageName }}
      </span>
    </span>
    <span v-if="props.active && props.link" class="shrink-0 text-xs text-muted-foreground">
      {{ props.link.label }}
    </span>
  </button>
</template>
