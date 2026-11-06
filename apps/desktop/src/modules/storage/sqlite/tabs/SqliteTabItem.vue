<script setup lang="ts">
import type { Component } from "vue";
import { X } from "lucide-vue-next";
import { Surface } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";

/**
 * One tab of the strip: a Cladd `Surface`, raised and pressed while active with a 2 px line in
 * the selection colour. A preview tab's name is italic. A dot says it holds unsaved changes.
 * Click selects, double-click keeps, middle-click closes; the close button stays out of the tab
 * order (the strip's keys reach it).
 */
const props = defineProps<{
  id: string;
  label: string;
  icon: Component;
  active: boolean;
  preview?: boolean;
  staged?: number;
  closable?: boolean;
  /** Icon-only tabs (the Overview) name themselves in a tooltip. */
  iconOnly?: boolean;
  controls?: string;
}>();

const emit = defineEmits<{ select: []; close: []; keep: [] }>();

function onAuxclick(event: MouseEvent) {
  if (event.button !== 1 || !props.closable) return;
  event.preventDefault();
  emit("close");
}

const hint = (): string | null => {
  if (props.iconOnly) return props.label;
  if (props.preview)
    return "Preview: the next table you open replaces it. Double-click to keep it.";
  return null;
};
</script>

<template>
  <HintTooltip :text="hint()">
    <Surface
      :id="`sqlite-tab-${id}`"
      role="tab"
      :aria-selected="active"
      :aria-controls="controls"
      :aria-label="iconOnly ? label : undefined"
      :tabindex="active ? 0 : -1"
      :data-tab-id="id"
      :variant="active ? 'solid' : 'transparent'"
      :pressed="active"
      :outline="active"
      hoverable
      class="group/tab relative h-7 shrink-0 cursor-default rounded-cladd-md outline-none focus-visible:ring-1 focus-visible:ring-ring"
      :class="[
        iconOnly ? 'w-8' : 'min-w-24 max-w-50 flex-[0_1_12.5rem]',
        active
          ? 'after:absolute after:inset-x-2 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-signal-select'
          : '',
      ]"
      content-class-name="flex h-full min-w-0 items-center gap-1.5 px-2"
      @click="emit('select')"
      @dblclick="emit('keep')"
      @auxclick="onAuxclick"
      @mousedown.middle.prevent
    >
      <component
        :is="icon"
        :size="13"
        :stroke-width="1.8"
        class="shrink-0"
        :class="active ? 'text-foreground' : 'text-muted-foreground'"
        aria-hidden="true"
      />
      <template v-if="!iconOnly">
        <span
          class="min-w-0 flex-1 truncate font-mono text-xs"
          :class="[preview ? 'italic' : '', active ? 'text-foreground' : 'text-muted-foreground']"
        >
          {{ label }}
        </span>
        <span
          v-if="staged"
          class="size-1.5 shrink-0 rounded-full bg-signal-mark"
          role="img"
          :aria-label="staged === 1 ? '1 change not saved' : `${staged} changes not saved`"
        />
        <IconAction
          v-if="closable"
          size="xs"
          :label="`Close ${label}`"
          tabindex="-1"
          class="-mr-1 shrink-0 opacity-0 transition-opacity duration-120 group-hover/tab:opacity-100 focus-visible:opacity-100"
          :class="active ? 'opacity-100' : ''"
          @click.stop="emit('close')"
          @dblclick.stop
        >
          <X :stroke-width="1.8" />
        </IconAction>
      </template>
    </Surface>
  </HintTooltip>
</template>
