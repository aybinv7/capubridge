<script setup lang="ts">
import { computed, watch } from "vue";
import { useDocumentVisibility, useNow } from "@vueuse/core";
import ProvenanceTag from "@/components/gate/ProvenanceTag.vue";
import { formatAge } from "./changeWords";
import type { DataProvenance } from "./dataFrame.types";

/**
 * Where the rows came from and how old they are. Rows the change watcher keeps current read
 * `live · read 12 s ago` with the live dot; a one-time read of the phone reads
 * `on the phone · read 12 s ago`, without it.
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
  <ProvenanceTag
    :kind="oneTime ? 'cached' : props.provenance"
    :label="oneTime ? 'on the phone' : undefined"
    :detail="detail"
  />
</template>
