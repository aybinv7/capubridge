<script setup lang="ts">
import { computed, watch } from "vue";
import { useDocumentVisibility, useNow } from "@vueuse/core";
import { StatusDot } from "@capubridge/cladd";
import ProvenanceTag from "@/components/gate/ProvenanceTag.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { formatAge } from "./changeWords";
import type { DataProvenance } from "./dataFrame.types";

/**
 * Where the rows came from and how old they are. Rows the change watcher keeps current read
 * `live · read 12 s ago` with the live dot; a one-time read of the phone is a hollow dot and
 * `read 12 s ago`, with "read once" explained on hover.
 */
const props = defineProps<{
  provenance: DataProvenance;
  readAt: number | null;
  verb?: string;
  watched?: boolean;
}>();

const oneTime = computed(() => props.provenance === "live" && !props.watched);

const visibility = useDocumentVisibility();
const { now, pause, resume } = useNow({ interval: 5000, controls: true });

watch(visibility, (state) => (state === "hidden" ? pause() : resume()), { immediate: true });

const detail = computed(() => {
  if (props.readAt === null) return undefined;
  return `${props.verb ?? "read"} ${formatAge(now.value.getTime() - props.readAt)}`;
});
</script>

<template>
  <HintTooltip
    v-if="oneTime"
    text="Read once from the phone. The app may have changed it since; read again to see."
  >
    <span
      class="inline-flex h-5 shrink-0 items-center gap-1.5 px-1 font-mono text-2xs text-muted-foreground"
      tabindex="0"
      data-provenance="read-once"
    >
      <StatusDot variant="hollow" size="xs" />
      {{ detail ?? "read once" }}
    </span>
  </HintTooltip>
  <ProvenanceTag v-else :kind="props.provenance" :detail="detail" />
</template>
