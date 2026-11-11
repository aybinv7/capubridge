<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, Globe } from "lucide-vue-next";
import { Surface } from "@capubridge/cladd";
import type { CDPTarget } from "@/types/cdp.types";
import type { LinkPresentation } from "@/lib/gates/link";
import AppIcon from "@/shared/apps/AppIcon.vue";
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

const unlinked = computed(() => props.group.packageName === null);
const title = computed(() => {
  if (unlinked.value) return "Not linked to an app";
  return props.appLabel || props.group.packageName || "";
});
const subtitle = computed(() => {
  if (unlinked.value) {
    return "Android did not say which app opened these, usually because they belong to the Chrome browser.";
  }
  return props.appLabel ? props.group.packageName : null;
});
</script>

<template>
  <Surface
    as="section"
    variant="solid"
    level="+1"
    outline
    class="rounded-well"
    content-class-name="flex flex-col gap-0.5 p-1.5"
    :aria-label="title"
  >
    <header class="flex items-center gap-3 px-1.5 pt-1 pb-2">
      <AppIcon
        v-if="!unlinked && props.group.packageName"
        :serial="props.serial"
        :package-name="props.group.packageName"
        :apk-path="props.apkPath"
        :icon-path="props.iconPath"
        size="sm"
        class="!size-8 !rounded-inner"
      />
      <span
        v-else
        class="flex size-8 shrink-0 items-center justify-center rounded-inner bg-cladd-surface-next text-muted-foreground"
      >
        <Globe :size="15" :stroke-width="1.8" aria-hidden="true" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-sm font-medium text-foreground">{{ title }}</span>
        <span
          v-if="subtitle"
          class="text-2xs text-[var(--fg-subtle)]"
          :class="unlinked ? 'line-clamp-2' : 'truncate font-mono'"
        >
          {{ subtitle }}
        </span>
      </span>
    </header>

    <TargetRow
      v-for="target in [...primary, ...visibleSecondary]"
      :key="target.id"
      :target="target"
      :active="target.id === props.selectedTargetId"
      :link="target.id === props.selectedTargetId ? props.link : null"
      :app-label="props.appLabel"
      @select="emit('select', target)"
      @inspect="emit('inspect', target)"
      @detach="emit('detach', target)"
    >
      <template #app-icon>
        <AppIcon
          v-if="props.group.packageName"
          :serial="props.serial"
          :package-name="props.group.packageName"
          :apk-path="props.apkPath"
          :icon-path="props.iconPath"
          size="sm"
          class="!size-5 !rounded-[5px]"
        />
        <Globe
          v-else
          :size="14"
          :stroke-width="1.8"
          class="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </template>
    </TargetRow>

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
  </Surface>
</template>
