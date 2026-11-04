<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, Globe } from "lucide-vue-next";
import type { CDPTarget } from "@/types/cdp.types";
import type { LinkPresentation } from "@/lib/gates/link";
import AppIcon from "@/modules/devices/AppIcon.vue";
import TargetRow from "./TargetRow.vue";
import type { TargetGroup } from "./targetGroups";

const props = defineProps<{
  group: TargetGroup;
  serial: string;
  appLabel: string | null;
  apkPath: string;
  iconPath: string | null;
  selectedTargetId: string | null;
  link: LinkPresentation;
}>();

const emit = defineEmits<{
  select: [target: CDPTarget];
  inspect: [target: CDPTarget];
  detach: [target: CDPTarget];
}>();

const primary = computed(() =>
  props.group.targets.filter(
    (target) => target.type === "page" || target.id === props.selectedTargetId,
  ),
);
const secondary = computed(() =>
  props.group.targets.filter(
    (target) => target.type !== "page" && target.id !== props.selectedTargetId,
  ),
);
const showSecondary = ref(false);
const visibleSecondary = computed(() =>
  showSecondary.value || primary.value.length === 0 ? secondary.value : [],
);
const secondaryLabel = computed(() => {
  const count = secondary.value.length;
  return `${count} ${count === 1 ? "worker or frame" : "workers and frames"}`;
});
const title = computed(() => props.appLabel || props.group.packageName || "Other WebViews");
</script>

<template>
  <section class="flex flex-col gap-0.5" :aria-label="title">
    <header class="flex items-center gap-2.5 px-1 pt-1 pb-1.5">
      <AppIcon
        v-if="props.group.packageName"
        :serial="props.serial"
        :package-name="props.group.packageName"
        :apk-path="props.apkPath"
        :icon-path="props.iconPath"
        size="sm"
        class="!size-7 !rounded-inner"
      />
      <span
        v-else
        class="flex size-7 shrink-0 items-center justify-center rounded-inner bg-surface-2 text-muted-foreground"
      >
        <Globe :size="14" :stroke-width="1.8" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-medium text-foreground">{{ title }}</span>
        <span
          v-if="props.group.packageName && props.appLabel"
          class="truncate font-mono text-2xs text-[var(--fg-subtle)]"
        >
          {{ props.group.packageName }}
        </span>
      </span>
      <span
        v-if="props.group.hasActive"
        class="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-2xs text-signal-select"
      >
        In use
      </span>
    </header>

    <TargetRow
      v-for="target in [...primary, ...visibleSecondary]"
      :key="target.id"
      :target="target"
      :active="target.id === props.selectedTargetId"
      :link="target.id === props.selectedTargetId ? props.link : null"
      @select="emit('select', target)"
      @inspect="emit('inspect', target)"
      @detach="emit('detach', target)"
    />

    <button
      v-if="secondary.length && primary.length"
      type="button"
      data-roving-item
      class="flex items-center gap-1.5 self-start rounded-control px-3 py-1 text-2xs text-[var(--fg-subtle)] outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      :aria-expanded="showSecondary"
      @click="showSecondary = !showSecondary"
    >
      <ChevronRight
        :size="12"
        class="transition-transform duration-120"
        :class="showSecondary && 'rotate-90'"
      />
      {{ showSecondary ? "Hide" : "Show" }} {{ secondaryLabel }}
    </button>
  </section>
</template>
