<script setup lang="ts">
import { computed, watch } from "vue";
import { useDocumentVisibility, useNow } from "@vueuse/core";
import ProvenanceTag from "@/components/gate/ProvenanceTag.vue";
import { formatAge } from "./changeWords";
import type { DataProvenance } from "./dataFrame.types";

/** Where the rows came from and how old they are: `live · read 12 s ago`. */
const props = defineProps<{ provenance: DataProvenance; readAt: number | null; verb?: string }>();

const visibility = useDocumentVisibility();
const { now, pause, resume } = useNow({ interval: 5000, controls: true });

watch(visibility, (state) => (state === "hidden" ? pause() : resume()), { immediate: true });

const detail = computed(() => {
  if (props.readAt === null) return undefined;
  return `${props.verb ?? "read"} ${formatAge(now.value.getTime() - props.readAt)}`;
});
</script>

<template>
  <ProvenanceTag :kind="props.provenance" :detail="detail" />
</template>
