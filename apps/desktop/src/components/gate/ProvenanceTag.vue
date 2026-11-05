<script setup lang="ts">
import { computed } from "vue";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import { PROVENANCE, type Provenance } from "@/lib/provenance";

const props = defineProps<{
  kind: Provenance;
  detail?: string;
  /** A plainer word for the kind ("on the phone" for a one-time read). */
  label?: string;
  class?: HTMLAttributes["class"];
}>();

const meta = computed(() => PROVENANCE[props.kind]);
const text = computed(() =>
  props.detail
    ? `${props.label ?? meta.value.label} · ${props.detail}`
    : (props.label ?? meta.value.label),
);
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-sm bg-surface-cut px-1.5 font-mono text-2xs text-muted-foreground shadow-cut',
        props.class,
      )
    "
    :title="meta.description"
    :data-provenance="kind"
  >
    <span v-if="kind === 'live'" class="size-1.5 rounded-full bg-signal-live" aria-hidden="true" />
    <span
      v-else
      class="size-2.5 rounded-sm bg-surface-2"
      :class="kind === 'cached' ? 'border-b border-dotted border-[var(--fg-subtle)]' : meta.utility"
      aria-hidden="true"
    />
    {{ text }}
  </span>
</template>
