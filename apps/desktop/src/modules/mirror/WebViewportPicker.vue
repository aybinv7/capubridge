<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronDown, Monitor, Scaling, Smartphone, Tablet } from "lucide-vue-next";
import { Button, Popover } from "@capubridge/cladd";
import {
  RESPONSIVE_ID,
  VIEWPORT_KIND_LABELS,
  VIEWPORT_PRESETS,
  type ViewportKind,
  type ViewportPreset,
} from "@/lib/web-viewport";

const props = defineProps<{ presetId: string; label: string }>();
const emit = defineEmits<{ choose: [presetId: string] }>();

const open = ref(false);
const anchor = ref<HTMLElement | null>(null);

const KIND_ICONS = { phone: Smartphone, tablet: Tablet, desktop: Monitor } as const;

const groups = computed(() =>
  (Object.keys(VIEWPORT_KIND_LABELS) as ViewportKind[]).map((kind) => ({
    kind,
    label: VIEWPORT_KIND_LABELS[kind],
    presets: VIEWPORT_PRESETS.filter((preset) => preset.kind === kind),
  })),
);

const triggerIcon = computed(() => {
  const preset = VIEWPORT_PRESETS.find((entry) => entry.id === props.presetId);
  return preset ? KIND_ICONS[preset.kind] : Scaling;
});

function choose(presetId: string) {
  open.value = false;
  emit("choose", presetId);
}

function dimensions(preset: ViewportPreset) {
  return `${preset.width} × ${preset.height}`;
}

const rowClass =
  "flex h-7 w-full items-center gap-2 rounded-cladd-md px-2 text-left text-xs text-foreground hover:bg-cladd-surface-hover focus-visible:bg-cladd-surface-hover focus-visible:outline-none";
</script>

<template>
  <span ref="anchor" class="inline-flex min-w-0">
    <Button
      variant="transparent"
      :outline="false"
      size="sm"
      class="min-w-0 text-xs font-normal"
      content-class-name="min-w-0 gap-1.5 px-2 [&>svg]:size-3.5 [&>svg]:shrink-0"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = !open"
    >
      <component :is="triggerIcon" :stroke-width="1.8" class="text-muted-foreground" />
      <span class="truncate text-foreground">{{ props.label }}</span>
      <ChevronDown :stroke-width="1.8" class="text-[var(--fg-subtle)]" />
    </Button>
  </span>

  <Popover
    v-model:open="open"
    :anchor-element="anchor ?? undefined"
    position="bottom-start"
    :offset="6"
    class="w-64"
    content-class-name="flex max-h-[70vh] w-full flex-col gap-px overflow-y-auto p-1.5"
    aria-label="Viewport size"
  >
    <button type="button" :class="rowClass" @click="choose(RESPONSIVE_ID)">
      <Scaling :size="14" :stroke-width="1.8" class="text-muted-foreground" />
      <span class="flex-1">Responsive</span>
      <span class="text-2xs text-[var(--fg-subtle)]">Any size</span>
      <Check
        v-if="props.presetId === RESPONSIVE_ID"
        :size="13"
        :stroke-width="2"
        class="text-foreground"
      />
    </button>

    <template v-for="group in groups" :key="group.kind">
      <span class="px-2 pt-2.5 pb-1 text-2xs text-[var(--fg-subtle)]">{{ group.label }}</span>
      <button
        v-for="preset in group.presets"
        :key="preset.id"
        type="button"
        :class="rowClass"
        @click="choose(preset.id)"
      >
        <component
          :is="KIND_ICONS[preset.kind]"
          :size="14"
          :stroke-width="1.8"
          class="text-muted-foreground"
        />
        <span class="flex-1 truncate">{{ preset.label }}</span>
        <span class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
          {{ dimensions(preset) }}
        </span>
        <Check
          v-if="props.presetId === preset.id"
          :size="13"
          :stroke-width="2"
          class="text-foreground"
        />
      </button>
    </template>
  </Popover>
</template>
